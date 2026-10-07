import { expect, test, type Page } from '@playwright/test';
const appUrl = (path = '/') =>
  new URL(path, test.info().project.use.baseURL).href;
import { readFile } from 'node:fs/promises';
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
  refresh_token: 'account-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user,
};
const recoveryHash = new URLSearchParams({
  access_token: token,
  refresh_token: session.refresh_token,
  expires_in: '3600',
  token_type: 'bearer',
  type: 'recovery',
}).toString();
async function setup(page: Page, failUpdateOnce = false) {
  let deleted = false,
    password = 'una-clave-de-prueba',
    updates = 0,
    deletions = 0;
  await page.route(/\/auth\/v1\//, async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith('/recover')) return route.fulfill({ json: {} });
    if (path.endsWith('/logout')) return route.fulfill({ json: {} });
    if (path.endsWith('/user')) {
      if (deleted)
        return route.fulfill({
          status: 401,
          json: { code: 'bad_jwt', message: 'Account deleted' },
        });
      if (req.method() === 'PUT') {
        updates++;
        const body = req.postDataJSON();
        if (failUpdateOnce) {
          failUpdateOnce = false;
          return route.fulfill({
            status: 422,
            json: { error_code: 'weak_password', message: 'Weak password' },
          });
        }
        if (body.current_password && body.current_password !== password)
          return route.fulfill({
            status: 400,
            json: {
              error_code: 'invalid_credentials',
              message: 'Invalid current password',
            },
          });
        password = body.password;
      }
      return route.fulfill({ json: user });
    }
    return route.fulfill({ json: session });
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (deleted || req.headers().authorization !== `Bearer ${token}`)
      return route.fulfill({ status: 401, json: {} });
    if (path.endsWith('/me/account/export'))
      return route.fulfill({
        json: {
          version: 1,
          account: { id: user.id, email: user.email },
          books: [{ book_id: 7, notes: 'Anotación privada', rating: 0 }],
          wishlist: [],
          bookshelf: null,
        },
      });
    if (path.endsWith('/me/account') && req.method() === 'DELETE') {
      deletions++;
      expect(req.postDataJSON()).not.toHaveProperty('user_id');
      if (req.postDataJSON().password !== password)
        return route.fulfill({ status: 401, json: {} });
      expect(req.postDataJSON().confirmation).toBe('ELIMINAR');
      deleted = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: [] });
  });
  return {
    getUpdates: () => updates,
    getDeletions: () => deletions,
    isDeleted: () => deleted,
  };
}
async function login(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Tu correo').fill(user.email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('una-clave-de-prueba');
  await page.getByRole('button', { name: 'Entrar en mi biblioteca' }).click();
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
}

test('cuenta: solicita recuperación sin revelar si existe el correo y usa la URL de recuperación', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'He olvidado mi contraseña' }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveCount(0);
  await page.getByLabel('Tu correo').fill('desconocida@example.com');
  const requested = page.waitForRequest((req) =>
    new URL(req.url()).pathname.endsWith('/recover'),
  );
  await page
    .getByRole('button', { name: 'Enviar enlace de recuperación' })
    .click();
  expect(new URL((await requested).url()).searchParams.get('redirect_to')).toBe(
    appUrl('/recuperar-contrasena'),
  );
  await expect(page.getByRole('status')).toContainText(
    'Si hay una cuenta con ese correo',
  );
  await page.getByRole('button', { name: 'Volver a entrar' }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar en mi biblioteca' }),
  ).toBeVisible();
});

test('cuenta: el enlace permite cambiar la contraseña, soporta recarga y reintento y abre la biblioteca', async ({
  page,
}, testInfo) => {
  const state = await setup(page, true);
  await page.goto(`/recuperar-contrasena#${recoveryHash}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(
    page.getByRole('heading', { name: 'Elige una nueva contraseña.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(appUrl('/recuperar-contrasena'));
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByLabel('Nueva contraseña', { exact: true })
    .fill('clave-nueva-de-prueba');
  await page
    .getByLabel('Repetir nueva contraseña')
    .fill('otra-clave-de-prueba');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('no coinciden');
  expect(state.getUpdates()).toBe(0);
  await page
    .getByLabel('Repetir nueva contraseña')
    .fill('clave-nueva-de-prueba');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('reglas de seguridad');
  await expect(
    page.getByLabel('Nueva contraseña', { exact: true }),
  ).toHaveValue('clave-nueva-de-prueba');
  await page.screenshot({
    path: testInfo.outputPath('recuperar-contrasena.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  await expect(page).toHaveURL(appUrl('/'));
  expect(state.getUpdates()).toBe(2);
});

test('cuenta: un enlace de recuperación caducado permite solicitar otro, sin habilitar cambio de contraseña', async ({
  page,
}) => {
  await setup(page);
  await page.goto(
    '/recuperar-contrasena#error=access_denied&error_code=otp_expired&error_description=Expired',
    { waitUntil: 'domcontentloaded' },
  );
  await expect(page.getByRole('alert')).toContainText(
    'recuperar tu contraseña ha caducado',
  );
  await expect(page).toHaveURL(appUrl('/recuperar-contrasena'));
  await expect(
    page.getByRole('button', { name: 'Guardar nueva contraseña' }),
  ).toHaveCount(0);
  await page.getByLabel('Tu correo').fill(user.email);
  await page
    .getByRole('button', { name: 'Enviar enlace de recuperación' })
    .click();
  await expect(page.getByRole('status')).toContainText('Si hay una cuenta');
});

test('cuenta: cambiar contraseña, exportar datos y eliminar con confirmación y reintento', async ({
  page,
}, testInfo) => {
  const state = await setup(page);
  await login(page);
  await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page
    .getByLabel('Contraseña actual', { exact: true })
    .fill('incorrecta');
  await page
    .getByLabel('Nueva contraseña', { exact: true })
    .fill('clave-nueva-de-prueba');
  await page
    .getByLabel('Repetir nueva contraseña')
    .fill('clave-nueva-de-prueba');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'actual no es correcta',
  );
  await page
    .getByLabel('Contraseña actual', { exact: true })
    .fill('una-clave-de-prueba');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(dialog.getByRole('status')).toContainText('se ha actualizado');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar mis datos' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('entre-paginas.json');
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.books[0]).toMatchObject({
    notes: 'Anotación privada',
    rating: 0,
  });
  expect(JSON.stringify(exported)).not.toContain(token);
  await page
    .getByRole('button', { name: 'Eliminar mi cuenta', exact: true })
    .click();
  await page.getByRole('button', { name: 'Conservar mi cuenta' }).click();
  expect(state.getDeletions()).toBe(0);
  await page
    .getByRole('button', { name: 'Eliminar mi cuenta', exact: true })
    .click();
  await page
    .getByLabel('Contraseña actual para eliminar la cuenta')
    .fill('incorrecta');
  await expect(
    page.getByRole('button', { name: 'Eliminar definitivamente' }),
  ).toBeDisabled();
  await page.getByLabel('Escribe ELIMINAR para confirmar').fill('ELIMINAR');
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Comprueba tu contraseña actual',
  );
  expect(state.isDeleted()).toBe(false);
  await page
    .getByLabel('Contraseña actual para eliminar la cuenta')
    .fill('clave-nueva-de-prueba');
  await page
    .getByRole('heading', { name: 'Eliminar mi cuenta', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('mi-cuenta.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar en mi biblioteca' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('se han eliminado');
  expect(state.isDeleted()).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('button', { name: 'Entrar en mi biblioteca' }),
  ).toBeVisible();
});
