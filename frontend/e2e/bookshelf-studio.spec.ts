import { expect, test, type Page } from '@playwright/test';
import { login, setup } from './library-fixtures';
import { readFile } from 'node:fs/promises';

async function design(page: Page) {
  await page.getByRole('button', { name: 'Diseñar', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Herramientas de diseño' }),
  ).toBeVisible();
}
const scene = (page: Page) => page.locator('.studio-viewport');
test('estudio: arrastre con ratón y táctil entre baldas conserva la colocación', async ({
  page,
  isMobile,
}) => {
  const mock = await setup(page);
  await login(page, false);
  await design(page);
  const book = scene(page).locator('[data-shelf-book="1"]');
  await book.scrollIntoViewIfNeeded();
  const box = (await book.boundingBox())!;
  const target = await scene(page)
    .locator('svg.bookshelf-scene')
    .evaluate((node) => {
      const matrix = (node as SVGSVGElement).getScreenCTM()!;
      const point = new DOMPoint(250, 550).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [start],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [target],
    });
    await expect(scene(page).locator('rect[stroke="#91c5a2"]')).toBeVisible();
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await expect(scene(page).locator('rect[stroke="#91c5a2"]')).toBeVisible();
    await page.mouse.up();
  }
  await expect.poll(() => mock.getLayout().revision).toBe(1);
  expect(
    mock.getLayout().design!.items.find((item) => item.book_ids[0] === 1)!
      .shelf_id,
  ).toBe(mock.getLayout().design!.bookcases[0].shelves[1].id);
  const saved = mock.getLayout().design;
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  if (isMobile) {
    await page
      .getByRole('button', { name: 'Ampliar zoom', exact: true })
      .click();
    await scene(page).scrollIntoViewIfNeeded();
    const background = await scene(page)
      .locator('svg.bookshelf-scene')
      .evaluate((node) => {
        const point = new DOMPoint(600, 450).matrixTransform(
          (node as SVGSVGElement).getScreenCTM()!,
        );
        return { x: point.x, y: point.y };
      });
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [background],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: background.x - 100, y: background.y }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
    await expect
      .poll(() => scene(page).evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(70);
    expect(mock.getLayout().design).toEqual(saved);
  }
  await page.reload();
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(8);
  expect(mock.getLayout().design).toEqual(saved);
});

test('estudio: vista principal, composición estable, filtros, preferencia y edición por teclado', async ({
  page,
}, info) => {
  const mock = await setup(page, { many: true });
  await login(page, false);
  await expect(
    page.getByRole('button', { name: 'Estantería', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(24);
  const original = mock.getLayout().design!;
  await page.getByLabel('Buscar por título, autor o ISBN').fill('libreria');
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(24);
  await expect(page.locator('.studio-results')).toContainText('La librería');
  await expect(scene(page).locator('[data-shelf-book="1"]')).toHaveAttribute(
    'opacity',
    '0.22',
  );
  await page.getByLabel('Buscar por título, autor o ISBN').fill('');
  await design(page);
  const first = scene(page).getByRole('button', {
    name: 'Seleccionar El infinito en un junco',
    exact: true,
  });
  await first.focus();
  await first.press('ArrowDown');
  await expect.poll(() => mock.getLayout().revision).toBe(1);
  expect(
    mock.getLayout().design!.items.find((item) => item.book_ids[0] === 1)!
      .shelf_id,
  ).not.toBe(original.items[0].shelf_id);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect.poll(() => mock.getLayout().revision).toBe(2);
  expect(mock.getLayout().design!.items).toEqual(original.items);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect.poll(() => mock.getLayout().revision).toBe(3);
  const before = mock.getLayout().design;
  await page.setViewportSize({ width: 390, height: 844 });
  expect(mock.getLayout().design).toEqual(before);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: info.outputPath('estudio-movil.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Portadas', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Portadas', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('estudio: decoración, duplicado, ajustes, muebles, luces y baldas eliminadas', async ({
  page,
}, info) => {
  const mock = await setup(page);
  await login(page, false);
  await design(page);
  await page.getByRole('tab', { name: 'Objetos', exact: true }).click();
  await page.getByRole('button', { name: 'Helecho', exact: true }).click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((i) => i.kind === 'decor').length,
    )
    .toBe(1);
  await page
    .getByRole('button', { name: 'Duplicar objeto', exact: true })
    .click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((i) => i.kind === 'decor').length,
    )
    .toBe(2);
  await page.getByRole('tab', { name: 'Muebles', exact: true }).click();
  await page.getByLabel('Material', { exact: true }).selectOption('walnut');
  await page.getByLabel('Guirnalda de luces').check();
  await expect
    .poll(() => mock.getLayout().design!.bookcases[0].material)
    .toBe('walnut');
  await expect
    .poll(() => mock.getLayout().design!.bookcases[0].shelves[0].light.garland)
    .toBe(true);
  await page.screenshot({
    path: info.outputPath('estudio-decorado.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Eliminar balda', exact: true })
    .click();
  await expect
    .poll(() => mock.getLayout().design!.bookcases[0].shelves.length)
    .toBe(2);
  expect(mock.getBooks()).toHaveLength(8);
  expect(mock.getLayout().design!.items).toHaveLength(0);
  await page.getByRole('tab', { name: 'Libros', exact: true }).click();
  await expect(
    page.getByText('8 libros por colocar.', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Colocar El infinito en un junco',
      exact: true,
    })
    .click();
  await expect.poll(() => mock.getLayout().design!.items.length).toBe(1);
});

test('estudio: los libros nuevos quedan por colocar y retirar uno conserva la habitación sin conflictos artificiales', async ({
  page,
}) => {
  const mock = await setup(page);
  await login(page, false);
  await design(page);
  await page.getByRole('tab', { name: 'Objetos', exact: true }).click();
  await page.getByRole('button', { name: 'Jarrón alto', exact: true }).click();
  await expect.poll(() => mock.getLayout().revision).toBe(1);
  const before = mock.getLayout().design!;
  await page
    .getByRole('button', { name: 'Añadir un libro', exact: true })
    .click();
  await page.getByLabel('ISBN', { exact: true }).fill('9788410989788');
  await page
    .getByRole('button', { name: 'Añadir a mi biblioteca', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.studio-unplaced')).toContainText(
    'Por colocar: 1 libro',
  );
  expect(mock.getLayout().design).toEqual(before);
  await page.getByRole('tab', { name: 'Muebles', exact: true }).click();
  await page.getByLabel('Material', { exact: true }).selectOption('walnut');
  await expect.poll(() => mock.getLayout().revision).toBe(3);
  await expect(page.locator('.studio-conflict')).not.toBeVisible();
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  await scene(page)
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Quitar de mi biblioteca', exact: true })
    .click();
  await page.getByRole('button', { name: 'Sí, quitar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(7);
  await design(page);
  await page.getByRole('tab', { name: 'Muebles', exact: true }).click();
  await page.getByLabel('Material', { exact: true }).selectOption('black');
  await expect.poll(() => mock.getLayout().revision).toBe(5);
  expect(
    mock.getLayout().design!.items.filter((item) => item.kind === 'decor'),
  ).toEqual(before.items.filter((item) => item.kind === 'decor'));
  await expect(page.locator('.studio-conflict')).not.toBeVisible();
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  await page.reload();
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(7);
  await expect(page.locator('.studio-unplaced')).toContainText(
    'Por colocar: 1 libro',
  );
});

test('estudio: conserva el borrador y reintenta un error de guardado', async ({
  page,
}) => {
  const mock = await setup(page, { failShelfOnce: true });
  await login(page, false);
  await design(page);
  await page
    .getByRole('button', { name: 'Encender la noche', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('No hemos podido');
  await expect(scene(page).locator('svg.bookshelf-scene')).toBeVisible();
  expect(mock.getLayout().design!.night).toBe(false);
  await page
    .getByRole('button', { name: 'Reintentar guardado', exact: true })
    .click();
  await expect.poll(() => mock.getLayout().design!.night).toBe(true);
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
});

test('estudio: compara un conflicto, conserva el trabajo y guarda sobre la revisión actual', async ({
  page,
}) => {
  const mock = await setup(page, { staleShelfOnce: true });
  await login(page, false);
  await design(page);
  await page
    .getByRole('button', { name: 'Encender la noche', exact: true })
    .click();
  await expect(page.locator('.studio-comparison')).toBeVisible();
  await expect(page.getByText('Tu borrador', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Versión guardada', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Guardar mi borrador sobre la versión actual',
      exact: true,
    })
    .click();
  await expect.poll(() => mock.getLayout().revision).toBe(2);
  expect(mock.getLayout().design!.night).toBe(true);
});

test('estudio: pilas, portadas y organización previsualizada mantienen la decoración', async ({
  page,
}) => {
  const mock = await setup(page);
  await login(page, false);
  await design(page);
  await page.getByRole('tab', { name: 'Objetos' }).click();
  await page.getByRole('button', { name: 'Jarrón alto', exact: true }).click();
  await page.getByRole('tab', { name: 'Libros' }).click();
  await page
    .getByRole('checkbox', {
      name: 'Seleccionar El infinito en un junco',
      exact: true,
    })
    .check();
  await page
    .getByRole('checkbox', { name: 'Seleccionar El principito', exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Crear pila horizontal', exact: true })
    .click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((i) => i.kind === 'stack').length,
    )
    .toBe(1);
  const decor = mock.getLayout().design!.items.find((i) => i.kind === 'decor');
  await page.getByLabel('Organizar selección').selectOption('title');
  await expect(
    page.getByRole('button', { name: 'Aplicar organización', exact: true }),
  ).toBeVisible();
  expect(
    mock.getLayout().design!.items.filter((i) => i.kind === 'stack'),
  ).toHaveLength(1);
  await page
    .getByRole('button', { name: 'Aplicar organización', exact: true })
    .click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((i) => i.kind === 'stack').length,
    )
    .toBe(0);
  expect(
    mock.getLayout().design!.items.find((i) => i.kind === 'decor'),
  ).toEqual(decor);
  const book = scene(page).getByRole('button', {
    name: 'Seleccionar La librería',
    exact: true,
  });
  await book.click();
  await page.getByLabel('Balda', { exact: true }).selectOption({ index: 1 });
  await page
    .getByRole('button', { name: 'Mover a la balda elegida', exact: true })
    .click();
  await page.getByLabel('Colocación', { exact: true }).selectOption('cover');
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.find((i) => i.book_ids[0] === 3)!.mode,
    )
    .toBe('cover');
});

test('estudio: captura múltiple evita duplicados y reintenta solo el lomo pendiente', async ({
  page,
}) => {
  const mock = await setup(page, { failSpineOnce: true });
  await login(page, false);
  await design(page);
  await page.getByRole('tab', { name: 'Libros' }).click();
  await page
    .getByRole('button', { name: 'Capturar varios lomos', exact: true })
    .click();
  const picture = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 300;
    const ctx = c.getContext('2d')!;
    ['#5c765c', '#a26c56', '#5d7587'].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(i * 300, 0, 300, 300);
    });
    return c.toDataURL('image/png').split(',')[1];
  });
  await page
    .locator('dialog input[type="file"]')
    .first()
    .setInputFiles({
      name: 'fila.png',
      mimeType: 'image/png',
      buffer: Buffer.from(picture, 'base64'),
    });
  await page
    .getByRole('button', { name: 'Marcar otro lomo', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'El infinito en un junco', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Marcar otro lomo', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'El infinito en un junco', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'El principito', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar todos los lomos', exact: true })
    .click();
  await expect(
    page.getByText('1 lomos guardados.', { exact: false }),
  ).toBeVisible();
  expect(mock.getUploadedPhotos()).toHaveLength(2);
  await page
    .getByRole('button', { name: 'Reintentar lomos pendientes', exact: true })
    .click();
  await expect(
    page.getByText('2 lomos guardados.', { exact: false }),
  ).toBeVisible();
  expect(mock.getUploadedPhotos()).toHaveLength(2);
  expect(
    mock
      .getBooks()
      .slice(0, 2)
      .every((book) => !!book.spine?.image_path),
  ).toBe(true);
});

test('estudio: exporta la composición real como PNG cuadrado y vertical', async ({
  page,
}) => {
  await setup(page, { photo: true });
  await login(page, false);
  await expect(scene(page).locator('image')).toHaveCount(1);
  await page
    .getByText('Compartir una imagen de mi estantería', { exact: true })
    .click();
  for (const format of ['square', 'portrait']) {
    await page.getByLabel('Encuadre', { exact: true }).selectOption(format);
    const download = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Descargar PNG', exact: true })
      .click();
    const artifact = await download;
    expect(artifact.suggestedFilename()).toMatch(/\.png$/);
    expect(await artifact.failure()).toBeNull();
    const png = await readFile((await artifact.path())!);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(format === 'square' ? 4096 : 2304);
    expect(png.readUInt32BE(20)).toBe(4096);
    await expect(
      page.getByText('Tu estantería está lista para compartir.'),
    ).toBeVisible();
  }
});

test('estudio: exporta con apariencia automática y avisa cuando falta una foto privada', async ({
  page,
}) => {
  await setup(page, { photo: true, brokenPhoto: true });
  await login(page, false);
  await expect(
    scene(page).locator('[data-photo-unavailable="true"]'),
  ).toBeVisible();
  await page
    .getByText('Compartir una imagen de mi estantería', { exact: true })
    .click();
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar PNG', exact: true })
    .click();
  const png = await readFile((await (await downloaded).path())!);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  await expect(
    page.getByText(
      'Una fotografía no está disponible; se ha usado la apariencia automática del libro.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('estudio: seis ambientes completos, confirmación, deshacer y biblioteca de 500 libros', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const mock = await setup(page, { count: 500 });
  await login(page, false);
  await design(page);
  for (const name of [
    'Biblioteca clásica',
    'Rincón cálido',
    'Minimalista',
    'Botánico',
    'Nocturno',
    'Fantasía',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('button', { name: 'Aplicar ambiente', exact: true })
      .click();
    await expect
      .poll(
        () =>
          mock.getLayout().design!.items.filter((i) => i.kind === 'decor')
            .length,
      )
      .toBe(3);
    await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
    expect(mock.getLayout().book_ids).toHaveLength(500);
    await scene(page).screenshot({
      path: info.outputPath(`ambiente-${name.replace(/\s/g, '-')}.png`),
    });
  }
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect.poll(() => mock.getLayout().design!.night).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});
