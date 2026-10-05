import { expect, test, type Page } from '@playwright/test';
import type { Book, LibraryBook } from '../src/types';

const fixtures = [
  ['El infinito en un junco', 'Irene Vallejo', 'pending'],
  ['El principito', 'Antoine de Saint-Exupéry', 'read'],
  ['La librería', 'Penelope Fitzgerald', 'reading'],
  ['Una habitación propia', 'Virginia Woolf', 'pending'],
  ['La elegancia del erizo', 'Muriel Barbery', 'pending'],
  ['El jardín secreto', 'Frances Hodgson Burnett', 'read'],
  ['Sobre el miedo', 'Jiddu Krishnamurti', 'reading'],
  ['La sombra del viento', 'Carlos Ruiz Zafón', 'pending'],
];
function fixtureBooks(): LibraryBook[] {
  return fixtures.map(([title, author, status], index) => ({
    book_id: index + 1,
    status: status as LibraryBook['status'],
    added_at: '2026-10-04T09:00:00Z',
    updated_at: '2026-10-04T09:00:00Z',
    book: {
      id: index + 1,
      title,
      authors: [{ id: index + 1, name: author }],
      isbn: null,
      cover_url: null,
      publisher: 'Una editorial',
      publication_date: '2020-01-01',
      language: 'es',
      pages: 240,
    },
  }));
}
async function setup(
  page: Page,
  options: {
    missing?: boolean;
    empty?: boolean;
    failPersonalOnce?: boolean;
  } = {},
) {
  let books = options.empty ? [] : fixtureBooks();
  let nextId = 100;
  let catalog: Book | null = null;
  let creates = 0;
  let fail = options.failPersonalOnce;
  const uuid = 'd052e849-4262-4878-b7a7-22687d835bc0';
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uuid, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
  const user = {
    id: uuid,
    email: 'lectora@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-04T09:00:00Z',
  };
  await page.route(/\/auth\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      json: path.endsWith('/signup')
        ? { user, session: null }
        : path.endsWith('/logout')
          ? {}
          : {
              access_token: token,
              refresh_token: 'test-refresh',
              expires_in: 3600,
              token_type: 'bearer',
              user,
            },
    });
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (!request.headers().authorization?.startsWith('Bearer ')) {
      await route.fulfill({ status: 401, json: {} });
      return;
    }
    const method = request.method();
    const body =
      method === 'POST' || method === 'PATCH' ? request.postDataJSON() : null;
    if (path === '/me/books' && method === 'GET')
      return route.fulfill({ json: books });
    if (path === '/books' && method === 'POST') {
      creates++;
      catalog = {
        ...fixtureBooks()[0].book,
        ...body,
        id: nextId++,
        authors: body.authors.map((author: { name: string }, i: number) => ({
          ...author,
          id: i + 100,
        })),
      };
      return route.fulfill({ json: catalog });
    }
    if (
      (path === '/me/books/isbn' || path === '/me/books') &&
      method === 'POST'
    ) {
      if (options.missing && path.endsWith('/isbn'))
        return route.fulfill({
          status: 404,
          json: { message: 'Book not found' },
        });
      if (fail && path === '/me/books') {
        fail = false;
        return route.fulfill({ status: 503, json: {} });
      }
      const existing = books.find(
        (entry) =>
          (entry.book.isbn && entry.book.isbn === body.isbn) ||
          entry.book_id === body.book_id,
      );
      const entry: LibraryBook = existing || {
        ...fixtureBooks()[0],
        book_id: catalog?.id || nextId++,
        status: body.status || 'pending',
        book: catalog || {
          ...fixtureBooks()[0].book,
          id: nextId - 1,
          isbn: body.isbn,
          title: 'Un libro recién llegado',
        },
      };
      if (!existing) books.push(entry);
      return route.fulfill({ json: entry });
    }
    const id = Number(path.split('/').pop());
    if (method === 'PATCH') {
      const entry = books.find((b) => b.book_id === id)!;
      entry.status = body.status;
      return route.fulfill({ json: entry });
    }
    if (method === 'DELETE') {
      books = books.filter((b) => b.book_id !== id);
      return route.fulfill({ status: 204 });
    }
    await route.fulfill({ status: 404, json: {} });
  });
  return { getCreates: () => creates };
}
async function login(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Tu correo').fill('lectora@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('una-clave-de-prueba');
  await page.getByRole('button', { name: 'Entrar en mi biblioteca' }).click();
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Añadir un libro', exact: true }).first(),
  ).toBeEnabled();
}

test('biblioteca: buscar, cambiar de estante, conservar la sesión y quitar con confirmación', async ({
  page,
}, testInfo) => {
  await setup(page);
  await login(page);
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(8);
  await page.screenshot({
    path: testInfo.outputPath('biblioteca.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByLabel('Buscar por título, autor o ISBN').fill('libreria');
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await page.getByRole('button', { name: 'Ver La librería' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Estante', { exact: true }).selectOption('read');
  await expect(page.getByLabel('Estante', { exact: true })).toHaveValue('read');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByRole('navigation', { name: 'Estantes de tu biblioteca' })
    .getByRole('button', { name: /^Leídos/ })
    .click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(3);
  await page.getByRole('button', { name: 'Ver La librería' }).click();
  await expect(page.getByLabel('Estante', { exact: true })).toHaveValue('read');
  await page.getByRole('button', { name: 'Quitar de mi biblioteca' }).click();
  await expect(page.getByRole('button', { name: 'Sí, quitar' })).toBeVisible();
  await page.getByRole('button', { name: 'Conservarlo' }).click();
  await expect(
    page.getByRole('button', { name: 'Sí, quitar' }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Quitar de mi biblioteca' }).click();
  await page.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver La librería' }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar en mi biblioteca' }),
  ).toBeVisible();
});

test('alta por ISBN: valida y evita duplicados', async ({ page }) => {
  await setup(page, { empty: true });
  await login(page);
  await page.getByRole('button', { name: 'Añadir mi primer libro' }).click();
  await page.getByLabel('ISBN', { exact: true }).fill('9788410989789');
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await expect(page.getByRole('alert')).toContainText('Ese ISBN no es válido');
  await page.getByLabel('ISBN', { exact: true }).fill('9788410989788');
  await page.getByLabel('Estante', { exact: true }).selectOption('reading');
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Añadir un libro', exact: true })
    .click();
  await page.getByLabel('ISBN', { exact: true }).fill('9788410989788');
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await page.getByRole('button', { name: /^Ver / }).click();
  await expect(page.getByLabel('Estante', { exact: true })).toHaveValue(
    'reading',
  );
});

test('ISBN no encontrado permite alta manual y reintentar sin duplicar el catálogo', async ({
  page,
}) => {
  const mock = await setup(page, {
    empty: true,
    missing: true,
    failPersonalOnce: true,
  });
  await login(page);
  await page.getByRole('button', { name: 'Añadir mi primer libro' }).click();
  await page.getByLabel('ISBN', { exact: true }).fill('9788410989788');
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await page.getByRole('button', { name: 'Añadir los datos a mano' }).click();
  await page
    .getByLabel('Título', { exact: true })
    .fill('Una historia especial');
  await page.getByLabel('Autor o autores').fill('Una autora; Otro autor');
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ver Una historia especial' }),
  ).toBeVisible();
  expect(mock.getCreates()).toBe(1);
});

test('registro con confirmación por correo y cámara sin permiso', async ({
  page,
}, testInfo) => {
  await setup(page, { empty: true });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          Promise.reject(
            new DOMException('Permission denied', 'NotAllowedError'),
          ),
      },
      configurable: true,
    }),
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.screenshot({
    path: testInfo.outputPath('acceso.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByLabel('Tu correo').fill('lectora@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('una-clave-de-prueba');
  await page.getByRole('button', { name: 'Crear mi biblioteca' }).click();
  await expect(page.getByRole('status')).toContainText('Revisa tu correo');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await login(page);
  await page.getByRole('button', { name: 'Añadir mi primer libro' }).click();
  await page.screenshot({
    path: testInfo.outputPath('anadir.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Escanear el código de barras' })
    .click();
  await expect(page.getByRole('alert')).toContainText('No tenemos permiso');
  await page.getByRole('button', { name: 'Escribir el ISBN' }).click();
  await expect(page.getByLabel('ISBN', { exact: true })).toBeVisible();
});

test('ZXing lee un código EAN-13 de un vídeo y detiene el escáner', async ({
  page,
}) => {
  await setup(page, { empty: true });
  // Feed the actual decoder a generated barcode through a real MediaStream,
  // without needing a physical camera or replacing the ZXing reader.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const digits = '9788410989788';
          const left = [
            '0001101',
            '0011001',
            '0010011',
            '0111101',
            '0100011',
            '0110001',
            '0101111',
            '0111011',
            '0110111',
            '0001011',
          ];
          const invert = (value: string) =>
            [...value].map((bit) => (bit === '0' ? '1' : '0')).join('');
          const parity = 'LGGLGL'; // First digit is 9.
          const bits =
            '101' +
            [...digits.slice(1, 7)]
              .map((digit, index) =>
                parity[index] === 'L'
                  ? left[Number(digit)]
                  : invert([...left[Number(digit)]].reverse().join('')),
              )
              .join('') +
            '01010' +
            [...digits.slice(7)]
              .map((digit) => invert(left[Number(digit)]))
              .join('') +
            '101';
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext('2d')!;
          function draw() {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 1280, 720);
            ctx.fillStyle = 'black';
            [...bits].forEach((bit, index) => {
              if (bit === '1') ctx.fillRect(355 + index * 6, 160, 6, 400);
            });
          }
          draw();
          const stream = canvas.captureStream(12);
          const ticker = window.setInterval(draw, 80);
          stream
            .getTracks()[0]
            .addEventListener('ended', () => window.clearInterval(ticker));
          return stream;
        },
      },
    });
  });
  await login(page);
  await page.getByRole('button', { name: 'Añadir mi primer libro' }).click();
  await page
    .getByRole('button', { name: 'Escanear el código de barras' })
    .click();
  await expect(page.getByLabel('ISBN', { exact: true })).toHaveValue(
    '9788410989788',
    { timeout: 15000 },
  );
  await expect(
    page.getByLabel('Vista de la cámara para escanear el ISBN'),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
});
