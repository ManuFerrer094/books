import { expect, test, type Page } from '@playwright/test';
import { fixtureBooks, setup, login } from './library-fixtures';
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
  await page
    .getByLabel('Estado de lectura', { exact: true })
    .selectOption('read');
  await expect(
    page.getByLabel('Estado de lectura', { exact: true }),
  ).toHaveValue('read');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByRole('navigation', { name: 'Estantes de tu biblioteca' })
    .getByRole('button', { name: /^Leídos/ })
    .click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(3);
  await page.getByRole('button', { name: 'Ver La librería' }).click();
  await expect(
    page.getByLabel('Estado de lectura', { exact: true }),
  ).toHaveValue('read');
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

test('catálogo y deseos: búsqueda, privacidad, paginación, reintentos y persistencia', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const state = await setup(page, { failWishOnce: true });
  await login(page);
  const shelves = page.getByRole('navigation', {
    name: 'Estantes de tu biblioteca',
  });
  await expect(shelves.getByRole('button').last()).toHaveText(
    /Lista de deseos\s*0/,
  );
  await page
    .getByRole('button', { name: 'Explorar catálogo', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Catálogo de la plataforma' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(24);
  await expect(
    page.getByText('26 libros en el catálogo', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Siguiente', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Buscar en el catálogo').fill('arboles');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Ver Árboles de otro lector', exact: true })
    .click();
  const detail = page.getByRole('dialog');
  await expect(
    detail
      .locator('.book-details-content')
      .getByText('María del Bosque', { exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByText('9788484454892', { exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByLabel('Estado de lectura', { exact: true }),
  ).toHaveCount(0);
  await expect(detail.getByLabel('Mis anotaciones')).toHaveCount(0);
  await expect(detail.getByLabel('Libro prestado')).toHaveCount(0);
  await expect(detail.getByRole('radio')).toHaveCount(0);
  await expect(
    detail.getByText(/lectora@example.com|Propietario|Pertenece a/),
  ).toHaveCount(0);
  await detail
    .getByRole('button', {
      name: 'Guardar deseo: Árboles de otro lector',
      exact: true,
    })
    .click();
  await expect(detail.getByRole('alert')).toBeVisible();
  expect(state.getWishlist()).toHaveLength(0);
  await detail
    .getByRole('button', {
      name: 'Guardar deseo: Árboles de otro lector',
      exact: true,
    })
    .click();
  await expect(
    detail.getByRole('button', {
      name: 'Quitar deseo: Árboles de otro lector',
      exact: true,
    }),
  ).toBeEnabled();
  expect(state.getWishlist()).toHaveLength(1);
  expect(state.getBooks()).toHaveLength(8);
  await detail.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByLabel('Buscar en el catálogo').fill('maria');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(18);
  await shelves.getByRole('button', { name: /^Lista de deseos/ }).click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath('lista-de-deseos.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await shelves.getByRole('button', { name: /^Lista de deseos/ }).click();
  await expect(
    page.getByRole('button', {
      name: 'Ver Árboles de otro lector',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Buscar en la lista de deseos').fill('9788484454892');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await page
    .getByRole('button', {
      name: 'Quitar deseo: Árboles de otro lector',
      exact: true,
    })
    .click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(0);
  expect(state.getWishlist()).toHaveLength(0);
  await shelves.getByRole('button', { name: /^Todos mis libros/ }).click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(8);
});

test('catálogo y deseos: recupera errores al cargar sin añadir deseos a ciegas', async ({
  page,
}) => {
  test.setTimeout(60000);
  await setup(page, { failWishlistOnce: true, failCatalogOnce: true });
  await login(page);
  await page
    .getByRole('button', { name: 'Explorar catálogo', exact: true })
    .click();
  await expect(
    page.getByText('No podemos abrir el catálogo.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Volver a intentar', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: /^Guardar deseo: / }).first(),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Recargar lista de deseos', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: /^Guardar deseo: / }).first(),
  ).toBeEnabled();
});

test('valoraciones: chips, acceso a las estrellas y orden en portadas y estantería', async ({
  page,
  isMobile,
}, testInfo) => {
  test.setTimeout(60000);
  await setup(page, { ratings: true });
  await login(page);
  await expect(
    page.getByRole('button', {
      name: 'Cambiar valoración de El principito: 0 de 5 estrellas',
      exact: true,
    }),
  ).toHaveText('0/5');
  await expect(
    page.getByRole('button', { name: 'Valorar La librería', exact: true }),
  ).toHaveText('Valorar');
  await page.getByLabel('Ordenar libros').selectOption('rating-desc');
  await expect(
    page.getByRole('button', { name: /^Ver / }).first(),
  ).toHaveAccessibleName('Ver El infinito en un junco');
  await page.getByLabel('Ordenar libros').selectOption('rating-asc');
  await expect(
    page.getByRole('button', { name: /^Ver / }).first(),
  ).toHaveAccessibleName('Ver El principito');
  await page
    .getByRole('button', { name: 'Valorar La librería', exact: true })
    .click();
  const stars = page.getByRole('radio', { name: '0 estrellas', exact: true });
  await expect(stars).toBeFocused();
  await page.getByRole('radio', { name: '4 estrellas', exact: true }).check();
  await page
    .getByRole('button', { name: 'Guardar datos personales', exact: true })
    .click();
  await expect(
    page
      .getByRole('form', { name: 'Datos personales del libro' })
      .getByRole('status'),
  ).toContainText('se han guardado');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Cambiar valoración de La librería: 4 de 5 estrellas',
      exact: true,
    }),
  ).toHaveText('4/5');
  await page.getByLabel('Ordenar libros').selectOption('rating-desc');
  expect(
    (await page.getByRole('button', { name: /^Ver / }).allTextContents())
      .length,
  ).toBe(8);
  await expect(
    page.getByRole('button', { name: /^Ver / }).nth(1),
  ).toHaveAccessibleName('Ver La librería');
  await page.screenshot({
    path: testInfo.outputPath('chips-valoracion.png'),
    fullPage: true,
  });
  const cover = page.locator('.book-card').first();
  const statusBox = (await cover.locator('.book-status').boundingBox())!;
  const ratingBox = (await cover.locator('.rating-chip').boundingBox())!;
  expect(statusBox.width).toBeCloseTo(ratingBox.width, 0);
  expect(statusBox.height).toBeCloseTo(ratingBox.height, 0);
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 844 });
    const smallStatus = (await cover.locator('.book-status').boundingBox())!;
    const smallRating = (await cover.locator('.rating-chip').boundingBox())!;
    expect(smallStatus.width).toBeCloseTo(smallRating.width, 0);
    expect(smallStatus.height).toBeCloseTo(smallRating.height, 0);
    expect(smallStatus.x + smallStatus.width).toBeLessThan(smallRating.x);
    await page.screenshot({
      path: testInfo.outputPath('chips-320px.png'),
      fullPage: true,
    });
  }
  expect(statusBox.x + statusBox.width).toBeLessThan(ratingBox.x);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole('button', { name: 'Estantería', exact: true }).click();
  await expect.poll(() => shelfIds(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  await page.getByLabel('Ordenar libros').selectOption('rating-asc');
  await expect.poll(() => shelfIds(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Portadas', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Cambiar valoración de La librería: 4 de 5 estrellas',
      exact: true,
    }),
  ).toBeVisible();
});

test('datos personales: préstamos, anotaciones, estrellas, reintentos y persistencia', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const state = await setup(page, { failDetailsOnce: true });
  await login(page);
  await page.getByRole('button', { name: 'Ver La librería' }).click();
  const personal = page.getByRole('form', {
    name: 'Datos personales del libro',
  });
  await page.getByLabel('Libro prestado').check();
  await page.getByLabel('Prestado a').fill('Ana');
  await page
    .getByLabel('Mis anotaciones')
    .fill('Una historia para recordar.\nMi frase favorita.');
  await page.getByRole('radio', { name: '0 estrellas', exact: true }).check();
  await page.getByRole('radio', { name: '0 estrellas', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('radio', { name: '1 estrella', exact: true }),
  ).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await personal
    .getByRole('button', { name: 'Guardar datos personales' })
    .click();
  await expect(personal.getByRole('alert')).toContainText(
    'No hemos podido guardar',
  );
  await expect(page.getByLabel('Prestado a')).toHaveValue('Ana');
  await expect(
    page.getByRole('radio', { name: '0 estrellas', exact: true }),
  ).toBeChecked();
  await personal
    .getByRole('button', { name: 'Guardar datos personales' })
    .click();
  await expect(personal.getByRole('status')).toContainText('se han guardado');
  await expect(
    page.getByLabel('Estado de lectura', { exact: true }),
  ).toHaveValue('reading');
  await page
    .getByLabel('Estado de lectura', { exact: true })
    .selectOption('read');
  await expect(
    personal.getByRole('button', { name: 'Guardar datos personales' }),
  ).toBeDisabled();
  await page.getByLabel('Mis anotaciones').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('datos-personales.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Estantes de tu biblioteca' })
    .getByRole('button', { name: /^Prestados/ })
    .click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await expect(page.getByText('Prestado a Ana', { exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ver La librería' }).click();
  await expect(page.getByLabel('Libro prestado')).toBeChecked();
  await expect(page.getByLabel('Prestado a')).toHaveValue('Ana');
  await expect(page.getByLabel('Mis anotaciones')).toHaveValue(
    'Una historia para recordar.\nMi frase favorita.',
  );
  await expect(
    page.getByRole('radio', { name: '0 estrellas', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel('Estado de lectura', { exact: true }),
  ).toHaveValue('read');
  await page.getByRole('radio', { name: '5 estrellas', exact: true }).check();
  await personal
    .getByRole('button', { name: 'Guardar datos personales' })
    .click();
  await expect(personal.getByRole('status')).toContainText('se han guardado');
  expect(state.getBooks().find((entry) => entry.book_id === 3)).toMatchObject({
    is_lent: true,
    rating: 5,
    lent_to: 'Ana',
    status: 'read',
  });
  await page.getByLabel('Libro prestado').uncheck();
  await page.getByLabel('Mis anotaciones').fill('');
  await page.getByRole('button', { name: 'Quitar valoración' }).click();
  await personal
    .getByRole('button', { name: 'Guardar datos personales' })
    .click();
  await expect(personal.getByRole('status')).toContainText('se han guardado');
  expect(state.getBooks().find((entry) => entry.book_id === 3)).toMatchObject({
    is_lent: false,
    lent_to: null,
    notes: null,
    rating: null,
    status: 'read',
  });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Estantes de tu biblioteca' })
    .getByRole('button', { name: /^Prestados/ })
    .click();
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(0);
});

test('editar mi libro: reintentar, persistir, buscar y restaurar sus datos', async ({
  page,
}, testInfo) => {
  const mock = await setup(page, { failMetadataOnce: true });
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco' })
    .click();
  await page
    .getByRole('button', { name: 'Editar mi libro', exact: true })
    .click();
  await page.getByLabel('Título', { exact: true }).fill('Mi edición del junco');
  await page.getByLabel('Autor 1', { exact: true }).fill('Mi autora');
  await page.getByRole('button', { name: 'Añadir autor', exact: true }).click();
  await page.getByLabel('Autor 2', { exact: true }).fill('Otro autor');
  await expect(page.getByLabel('URL de la portada')).toHaveCount(0);
  await page.getByLabel('Editorial', { exact: true }).fill('Mi editorial');
  await page.getByLabel('Páginas', { exact: true }).fill('123');
  await page.screenshot({
    path: testInfo.outputPath('editar-mi-libro.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'No hemos podido guardar',
  );
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Mi edición del junco',
  );
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Mi edición del junco' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(
    'Mi autora · Otro autor',
  );
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByLabel('Buscar por título, autor o ISBN').fill('Mi autora');
  await expect(page.getByRole('button', { name: /^Ver / })).toHaveCount(1);
  await page.getByRole('button', { name: 'Ver Mi edición del junco' }).click();
  await expect(
    page.getByLabel('Estado de lectura', { exact: true }),
  ).toHaveValue('pending');
  await page
    .getByRole('button', { name: 'Editar mi libro', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Restaurar datos del catálogo' })
    .click();
  await page.getByRole('button', { name: 'Sí, restaurar' }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'El infinito en un junco' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Irene Vallejo');
  expect(mock.getBooks()[0].book.title).toBe('El infinito en un junco');
  expect(mock.getBooks()[1].book.title).toBe('El principito');
  expect(mock.getCreates()).toBe(0);
});

test('portadas: foto, recorte, reintentos, borrador, persistencia y restauración', async ({
  page,
}, testInfo) => {
  const mock = await setup(page, { failUploadOnce: true, failCoverOnce: true });
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Personalizar lomo', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Editar mi libro', exact: true })
    .click();
  await page.getByLabel('Título', { exact: true }).fill('Mi ejemplar');
  await page.screenshot({ path: testInfo.outputPath('editar-libro.png') });
  await page.getByRole('button', { name: 'Portada', exact: true }).click();
  const input = page.getByLabel('Hacer foto de la portada', { exact: true });
  await expect(input).toHaveAttribute('capture', 'environment');
  await input.setInputFiles({
    name: 'documento.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Texto'),
  });
  await expect(page.getByRole('alert')).toContainText('JPEG');
  await input.setInputFiles(await photoFixture(page, false, true));
  await expect(
    page.getByRole('heading', { name: 'Encuadra solo la portada' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Guardar portada', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Girar 90°', exact: true }).click();
  await setRange(page, 'Enderezar', '4');
  const frame = page.getByRole('group', {
    name: 'Área de la foto que se usará como portada',
  });
  const initialHeight = Number(await frame.getAttribute('data-crop-height'));
  await page
    .getByRole('button', {
      name: 'Ajustar borde inferior del recorte',
      exact: true,
    })
    .focus();
  await page
    .getByRole('button', {
      name: 'Ajustar borde inferior del recorte',
      exact: true,
    })
    .press('ArrowUp');
  await expect
    .poll(async () => Number(await frame.getAttribute('data-crop-height')))
    .toBeLessThan(initialHeight);
  expect(
    await page
      .locator('canvas.photo-cover')
      .evaluate((canvas) => (canvas as HTMLCanvasElement).height),
  ).toBe(1024);
  await page.screenshot({ path: testInfo.outputPath('recortar-portada.png') });
  expect(
    await page
      .getByRole('dialog')
      .evaluate((dialog) => dialog.scrollWidth - dialog.clientWidth),
  ).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar portada', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('subir la foto');
  await page
    .getByRole('button', { name: 'Guardar portada', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'No se ha guardado la portada',
  );
  expect(mock.getDeletedPhotos()).toContain(mock.getUploadedPhotos()[0].path);
  await page
    .getByRole('button', { name: 'Guardar portada', exact: true })
    .click();
  await expect(
    page.getByText('Portada guardada.', { exact: true }),
  ).toBeVisible();
  const path = mock.getBooks()[0].book.cover_image_path!;
  expect(path).toMatch(/\/1\/[\da-f-]+\.jpg$/);
  expect(mock.getBooks()[1].book.cover_image_path).toBeUndefined();
  await page
    .getByRole('button', { name: 'Datos del libro', exact: true })
    .click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
    'Mi ejemplar',
  );
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('img', { name: 'Portada de Mi ejemplar' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: 'Ver Mi ejemplar', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('img', { name: 'Portada de Mi ejemplar' }),
  ).toHaveAttribute('src', /book-covers/);
  await page
    .getByRole('button', { name: 'Editar mi libro', exact: true })
    .click();
  await page.getByRole('button', { name: 'Portada', exact: true }).click();
  await page
    .getByLabel('Foto de la portada', { exact: true })
    .setInputFiles(await photoFixture(page));
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar portada', exact: true })
    .click();
  await expect(
    page.getByText('Portada guardada.', { exact: true }),
  ).toBeVisible();
  const replacementPath = mock.getBooks()[0].book.cover_image_path!;
  expect(replacementPath).not.toBe(path);
  expect(mock.getDeletedPhotos()).toContain(path);
  await page
    .getByRole('button', { name: 'Restaurar portada original', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar portada', exact: true })
    .click();
  await expect(
    page.getByText('Portada guardada.', { exact: true }),
  ).toBeVisible();
  expect(mock.getBooks()[0].book.cover_image_path).toBeNull();
  expect(mock.getDeletedPhotos()).toContain(replacementPath);
  expect(mock.getBooks()[0].book.title).toBe('Mi ejemplar');
  expect(mock.getBooks()[0].status).toBe('pending');
});

test('portadas: una respuesta perdida conserva la foto guardada y una imagen rota tiene alternativa', async ({
  page,
}) => {
  const mock = await setup(page, {
    ambiguousPhotoOnce: true,
    brokenPhoto: true,
  });
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Editar mi libro', exact: true })
    .click();
  await page.getByRole('button', { name: 'Portada', exact: true }).click();
  await page
    .getByLabel('Foto de la portada', { exact: true })
    .setInputFiles(await photoFixture(page));
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar portada', exact: true })
    .click();
  await expect(
    page.getByText('Portada guardada.', { exact: true }),
  ).toBeVisible();
  expect(mock.getDeletedPhotos()).not.toContain(
    mock.getBooks()[0].book.cover_image_path,
  );
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await expect(
    page.getByRole('dialog').locator('.cover-fallback'),
  ).toContainText('El infinito en un junco');
});

test('alta por ISBN: valida y evita duplicados', async ({ page }) => {
  await setup(page, { empty: true });
  await login(page);
  await page.getByRole('button', { name: 'Añadir mi primer libro' }).click();
  await page.getByLabel('ISBN', { exact: true }).fill('9788410989789');
  await page.getByRole('button', { name: 'Añadir a mi biblioteca' }).click();
  await expect(page.getByRole('alert')).toContainText('Ese ISBN no es válido');
  await page.getByLabel('ISBN', { exact: true }).fill('9788410989788');
  await page
    .getByLabel('Estado de lectura', { exact: true })
    .selectOption('reading');
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
  await expect(
    page.getByLabel('Estado de lectura', { exact: true }),
  ).toHaveValue('reading');
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

async function shelfIds(page: Page) {
  return page
    .locator('[data-shelf-book]')
    .evaluateAll((nodes) =>
      nodes.map((node) => Number((node as HTMLElement).dataset.shelfBook)),
    );
}
async function setRange(page: Page, label: string, value: string) {
  await page.getByLabel(label).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function openSpineEditor(page: Page) {
  await page
    .getByRole('button', { name: 'Editar mi libro', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Personalizar lomo', exact: true })
    .click();
}
async function photoFixture(page: Page, withHand = false, horizontal = false) {
  const data = await page.evaluate(
    ({ hand, sideways }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 900;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#51624e';
      ctx.fillRect(0, 0, 300, 900);
      ctx.fillStyle = '#a4b497';
      ctx.fillRect(20, 0, 12, 900);
      if (hand) {
        ctx.fillStyle = '#d8896f';
        ctx.fillRect(0, 730, 300, 170);
      }
      ctx.fillStyle = '#f7edcf';
      ctx.font = '28px serif';
      ctx.translate(170, 60);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('EL INFINITO EN UN JUNCO', 0, 0);
      if (sideways) {
        const turned = document.createElement('canvas');
        turned.width = 900;
        turned.height = 300;
        const turn = turned.getContext('2d')!;
        turn.translate(0, 300);
        turn.rotate(-Math.PI / 2);
        turn.drawImage(canvas, 0, 0);
        return turned.toDataURL('image/png').split(',')[1];
      }
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { hand: withHand, sideways: horizontal },
  );
  return {
    name: 'lomo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  };
}

async function previewBottomPixel(page: Page) {
  return page.locator('canvas.photo-spine').evaluate((canvas) => {
    const image = canvas as HTMLCanvasElement;
    return [
      ...image
        .getContext('2d')!
        .getImageData(Math.floor(image.width / 2), image.height - 8, 1, 1).data,
    ].slice(0, 3);
  });
}
async function dragCropControl(
  page: Page,
  mobile: boolean,
  label: string,
  dx: number,
  dy: number,
  during?: () => Promise<void>,
) {
  const control = page.getByRole('button', { name: label, exact: true });
  await control.scrollIntoViewIfNeeded();
  const box = (await control.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const to = { x: from.x + dx, y: from.y + dy };
  if (mobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [from],
    });
    for (let step = 1; step <= 4; step++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: from.x + (dx * step) / 4, y: from.y + (dy * step) / 4 },
        ],
      });
    if (during) await during();
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    if (during) await during();
    await page.mouse.up();
  }
}

test('lomos: la foto de cámara abre un recorte táctil que excluye la mano en tiempo real', async ({
  page,
  isMobile,
}, testInfo) => {
  const mock = await setup(page);
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await openSpineEditor(page);
  const camera = page.getByLabel('Hacer foto del lomo', { exact: true });
  await expect(camera).toHaveAttribute('capture', 'environment');
  await camera.setInputFiles(await photoFixture(page, true));
  await expect(
    page.getByRole('heading', { name: 'Encuadra solo el lomo' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Guardar lomo', exact: true }),
  ).toBeDisabled();
  await expect.poll(() => previewBottomPixel(page)).toEqual([216, 137, 111]);
  const frame = page.locator('.spine-crop-frame');
  const originalHeight = Number(await frame.getAttribute('data-crop-height'));
  await dragCropControl(
    page,
    isMobile,
    'Ajustar borde inferior del recorte',
    0,
    -85,
    async () => {
      // Check while the finger/mouse is still down: both frame and output update live.
      await expect.poll(() => previewBottomPixel(page)).toEqual([81, 98, 78]);
      expect(Number(await frame.getAttribute('data-crop-height'))).toBeLessThan(
        originalHeight,
      );
    },
  );
  const beforeX = Number(await frame.getAttribute('data-crop-x'));
  await dragCropControl(page, isMobile, 'Mover recorte', 7, 8);
  await expect
    .poll(async () => Number(await frame.getAttribute('data-crop-x')))
    .toBeGreaterThan(beforeX);
  await expect.poll(() => previewBottomPixel(page)).toEqual([81, 98, 78]);
  const chosenHeight = await frame.getAttribute('data-crop-height');
  await page
    .getByRole('heading', { name: 'Encuadra solo el lomo' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('recorte-en-tiempo-real.png'),
  });
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await expect(page.locator('.spine-crop-stage')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Guardar lomo', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Volver a recortar', exact: true })
    .click();
  await expect(frame).toHaveAttribute('data-crop-height', chosenHeight!);
  const bottom = page.getByRole('button', {
    name: 'Ajustar borde inferior del recorte',
    exact: true,
  });
  await bottom.focus();
  await bottom.press('ArrowUp');
  await expect
    .poll(async () => Number(await frame.getAttribute('data-crop-height')))
    .toBeLessThan(Number(chosenHeight));
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await expect.poll(() => previewBottomPixel(page)).toEqual([81, 98, 78]);
  await page.getByRole('button', { name: 'Guardar lomo', exact: true }).click();
  await expect(page.getByText('Lomo guardado.', { exact: true })).toBeVisible();
  expect(mock.getUploadedPhotos()).toHaveLength(1);
});

test('lomos: gira y endereza la foto dentro del recorte antes de usarla', async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await openSpineEditor(page);
  await page
    .getByLabel('Foto del lomo', { exact: true })
    .setInputFiles(await photoFixture(page, false, true));
  const photo = page.getByLabel('Fotografía original', { exact: true });
  await expect(photo).toBeVisible();
  await expect
    .poll(() =>
      photo.evaluate(
        (canvas) =>
          (canvas as HTMLCanvasElement).width /
          (canvas as HTMLCanvasElement).height,
      ),
    )
    .toBeGreaterThan(2.9);
  await page.getByRole('button', { name: 'Girar 90°', exact: true }).click();
  await expect
    .poll(() =>
      photo.evaluate(
        (canvas) =>
          (canvas as HTMLCanvasElement).width /
          (canvas as HTMLCanvasElement).height,
      ),
    )
    .toBeLessThan(0.34);
  await setRange(page, 'Enderezar', '6');
  await expect(page.getByLabel('Enderezar')).toHaveValue('6');
  await expect
    .poll(() =>
      photo.evaluate(
        (canvas) =>
          (canvas as HTMLCanvasElement).width /
          (canvas as HTMLCanvasElement).height,
      ),
    )
    .toBeGreaterThan(0.4);
  await page
    .getByRole('button', { name: 'Reiniciar marco', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await page.getByRole('button', { name: 'Guardar lomo', exact: true }).click();
  await expect(page.getByText('Lomo guardado.', { exact: true })).toBeVisible();
});

test('lomos: color, dimensiones, recorte de foto, persistencia y restauración', async ({
  page,
}, testInfo) => {
  const mock = await setup(page);
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await openSpineEditor(page);
  await page
    .getByRole('button', { name: 'Color #733f45', exact: true })
    .click();
  await setRange(page, 'Grosor', '54');
  await setRange(page, 'Altura', '224');
  await page
    .getByLabel('Foto del lomo', { exact: true })
    .setInputFiles(await photoFixture(page));
  await page.getByText('Ajustes precisos del recorte', { exact: true }).click();
  await setRange(page, 'Ampliar', '1.5');
  await setRange(page, 'Desplazar horizontalmente', '-0.4');
  await setRange(page, 'Desplazar verticalmente', '0.3');
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Guardar lomo' }),
  ).toBeEnabled();
  expect(
    await page
      .locator('canvas.photo-spine')
      .evaluate((canvas) => (canvas as HTMLCanvasElement).height),
  ).toBe(1024);
  await page
    .getByRole('heading', { name: 'Tu libro, tal como lo recuerdas.' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('personalizar-lomo.png') });
  await page.getByRole('button', { name: 'Guardar lomo' }).click();
  await expect(page.getByText('Lomo guardado.', { exact: true })).toBeVisible();
  const appearance = mock.getBooks()[0].spine!;
  expect(appearance).toMatchObject({
    color: '#733f45',
    width: 54,
    height: 224,
  });
  expect(appearance.image_path).toMatch(/\/1\/[\da-f-]+\.jpg$/);
  expect(mock.getUploadedPhotos()[0].size).toBeLessThan(5 * 1024 * 1024);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Estantería', exact: true }).click();
  await expect(page.locator('[data-shelf-book="1"] image')).toBeVisible();
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await openSpineEditor(page);
  await page
    .getByRole('button', { name: 'Restaurar aspecto automático' })
    .click();
  await page.getByRole('button', { name: 'Guardar lomo' }).click();
  await expect(page.getByText('Lomo guardado.', { exact: true })).toBeVisible();
  expect(mock.getBooks()[0].spine).toEqual({
    color: null,
    width: null,
    height: null,
    image_path: null,
  });
  expect(mock.getDeletedPhotos()).toContain(appearance.image_path);
});

test('lomos: valida archivos, recupera una subida fallida y limpia una asociación fallida', async ({
  page,
}) => {
  const mock = await setup(page, { failUploadOnce: true, failSpineOnce: true });
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await openSpineEditor(page);
  const input = page.getByLabel('Foto del lomo', { exact: true });
  await input.setInputFiles({
    name: 'documento.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('No es una foto'),
  });
  await expect(page.getByRole('alert')).toContainText('JPEG');
  await input.setInputFiles({
    name: 'enorme.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(5242881),
  });
  await expect(page.getByRole('alert')).toContainText('5 MB');
  await input.setInputFiles({
    name: 'roto.png',
    mimeType: 'image/png',
    buffer: Buffer.from('Not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('No podemos leer');
  await input.setInputFiles(await photoFixture(page));
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Guardar lomo' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Guardar lomo' }).click();
  await expect(page.getByRole('alert')).toContainText('subir la foto');
  await page.getByRole('button', { name: 'Guardar lomo' }).click();
  await expect(page.getByRole('alert')).toContainText('No se ha guardado');
  expect(mock.getDeletedPhotos()).toContain(mock.getUploadedPhotos()[0].path);
  await page.getByRole('button', { name: 'Guardar lomo' }).click();
  await expect(page.getByText('Lomo guardado.', { exact: true })).toBeVisible();
});

test('lomos: una respuesta perdida no elimina la foto guardada y una imagen rota muestra el título', async ({
  page,
}) => {
  const mock = await setup(page, {
    ambiguousPhotoOnce: true,
    brokenPhoto: true,
  });
  await login(page);
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await openSpineEditor(page);
  await page
    .getByLabel('Foto del lomo', { exact: true })
    .setInputFiles(await photoFixture(page));
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Guardar lomo' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Guardar lomo' }).click();
  await expect(page.getByText('Lomo guardado.', { exact: true })).toBeVisible();
  expect(mock.getDeletedPhotos()).not.toContain(
    mock.getUploadedPhotos()[0].path,
  );
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Estantería', exact: true }).click();
  await expect(page.locator('[data-shelf-book="1"] text').first()).toHaveText(
    'El infinito en un junco',
  );
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
