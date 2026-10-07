import { expect, test, type Page } from '@playwright/test';
const appUrl = (path = '/') =>
  new URL(path, test.info().project.use.baseURL).href;

// Allow Vite's first module compilation on Windows to finish on a cold start.
test.setTimeout(60000);

const user = {
  id: 'd052e849-4262-4878-b7a7-22687d835bc0',
  email: 'lectora@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-10-04T09:00:00Z',
};
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = {
  access_token: token,
  refresh_token: 'confirmation-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user,
};
const confirmationHash = new URLSearchParams({
  access_token: token,
  refresh_token: session.refresh_token,
  expires_in: '3600',
  token_type: 'bearer',
  type: 'signup',
}).toString();
const expiredHash =
  'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';

async function setup(page: Page, invalidToken = false) {
  await page.route(/\/auth\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/user'))
      return route.fulfill(
        invalidToken
          ? { status: 401, json: { message: 'Invalid token', code: 'bad_jwt' } }
          : { json: user },
      );
    if (path.endsWith('/signup')) return route.fulfill({ json: user });
    if (path.endsWith('/resend') || path.endsWith('/logout'))
      return route.fulfill({ json: {} });
    return route.fulfill({ json: session });
  });
  await page.route('**/api/**', async (route) => {
    if (route.request().headers().authorization !== `Bearer ${token}`)
      return route.fulfill({ status: 401, json: {} });
    return route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith('/me/bookshelf')
        ? { book_ids: [], revision: 0 }
        : [],
    });
  });
}

test('el registro dirige la confirmación al frontend', async ({ page }) => {
  await setup(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByLabel('Tu correo').fill(user.email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('una-clave-de-prueba');
  const signup = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith('/signup'),
  );
  await page.getByRole('button', { name: 'Crear mi biblioteca' }).click();
  expect(new URL((await signup).url()).searchParams.get('redirect_to')).toBe(
    appUrl('/'),
  );
  await expect(page.getByRole('status')).toContainText(
    'Al abrirlo entrarás directamente',
  );
});

test('confirmar en un navegador sin sesión abre la biblioteca y conserva la sesión al recargar', async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/#${confirmationHash}`, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  await expect(page).toHaveURL(appUrl('/'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Añadir mi primer libro' }),
  ).toBeVisible();
});

test('retira también los tokens enviados en la query y conserva parámetros ajenos a la autenticación', async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/?campaign=books&${confirmationHash}#reading`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  await expect(page).toHaveURL(appUrl('/?campaign=books#reading'));
});

test('el enlace caducado muestra el aviso, limpia la URL y permite pedir un correo nuevo', async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/#${expiredHash}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText(
    'ha caducado o ya se ha utilizado',
  );
  await expect(page).toHaveURL(appUrl('/'));
  await page.getByLabel('Tu correo').fill(user.email);
  const resend = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith('/resend'),
  );
  await page
    .getByRole('button', { name: 'Reenviar correo de confirmación' })
    .click();
  const request = await resend;
  expect(request.postDataJSON()).toMatchObject({
    type: 'signup',
    email: user.email,
  });
  expect(new URL(request.url()).searchParams.get('redirect_to')).toBe(
    appUrl('/'),
  );
  await expect(page.getByRole('status')).toContainText('último enlace');
});

test('los errores en la query se limpian sin mostrar el mensaje interno de Supabase', async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/?campaign=books&${expiredHash}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('alert')).toContainText('ha caducado');
  await expect(page.getByRole('alert')).not.toContainText(
    'Email link is invalid',
  );
  await expect(page).toHaveURL(appUrl('/?campaign=books'));
});

test('rechaza un token inválido, muestra un error y retira las credenciales de la URL', async ({
  page,
}) => {
  await setup(page, true);
  await page.goto(`/#${confirmationHash}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText(
    'No hemos podido confirmar',
  );
  await expect(page).toHaveURL(appUrl('/'));
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toHaveCount(0);
});

test('un enlace caducado no invalida una sesión existente', async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/#${confirmationHash}`, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  // A distinct query forces a document navigation, as when opening an email,
  // rather than only changing the current page's fragment.
  await page.goto(`/?from=email#${expiredHash}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  await expect(page).toHaveURL(appUrl('/?from=email'));
});
