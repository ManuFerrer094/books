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
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      '',
    );
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

test('estudio: una planta abre hueco entre libros y el sobrante pasa a las baldas siguientes', async ({
  page,
  isMobile,
}) => {
  const mock = await setup(page, { count: 44 });
  await login(page, false);
  await design(page);
  await page.getByRole('tab', { name: 'Objetos', exact: true }).click();
  const shelves = mock.getLayout().design!.bookcases[0].shelves;
  await page.getByLabel('Balda', { exact: true }).selectOption(shelves[2].id);
  await page.getByRole('button', { name: 'Helecho', exact: true }).click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((item) => item.kind === 'decor')
          .length,
    )
    .toBe(1);
  const plantId = mock
    .getLayout()
    .design!.items.find((item) => item.asset === 'fern')!.id;
  await page.getByLabel('Tamaño del objeto', { exact: true }).selectOption('1');
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.find((item) => item.id === plantId)!
          .width,
    )
    .toBe(39);
  await page.getByLabel('Tamaño del objeto', { exact: true }).selectOption('3');
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.find((item) => item.id === plantId)!
          .width,
    )
    .toBe(117);
  await page.getByRole('button', { name: 'Reloj', exact: true }).click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((item) => item.kind === 'decor')
          .length,
    )
    .toBe(2);
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  const before = mock.getLayout().design!;
  const clock = before.items.find((item) => item.asset === 'clock')!;
  const plant = scene(page).locator(`[data-item-id="${plantId}"]`);
  await scene(page).scrollIntoViewIfNeeded();
  const bounds = (await plant.boundingBox())!;
  const start = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const target = await scene(page)
    .locator('svg.bookshelf-scene')
    .evaluate((node) => {
      const point = new DOMPoint(117, 350).matrixTransform(
        (node as SVGSVGElement).getScreenCTM()!,
      );
      return { x: point.x, y: point.y };
    });
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
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await expect(scene(page).locator('rect[stroke="#91c5a2"]')).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      '',
    );
    await page.mouse.up();
  }
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.find((item) => item.id === plantId)!
          .shelf_id,
    )
    .toBe(shelves[0].id);
  const moved = mock.getLayout().design!;
  expect(
    moved.items.filter(
      (item) => item.kind === 'book' && item.shelf_id === shelves[0].id,
    ),
  ).toHaveLength(19);
  expect(
    moved.items.filter(
      (item) => item.kind === 'book' && item.shelf_id === shelves[1].id,
    ),
  ).toHaveLength(22);
  expect(
    moved.items.filter(
      (item) => item.kind === 'book' && item.shelf_id === shelves[2].id,
    ),
  ).toHaveLength(3);
  expect(moved.items.find((item) => item.id === clock.id)).toEqual(clock);
  expect(mock.getLayout().book_ids).toEqual(
    before.items
      .filter((item) => item.kind === 'book')
      .map((item) => item.book_ids[0]),
  );
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect.poll(() => mock.getLayout().design).toEqual(before);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect.poll(() => mock.getLayout().design).toEqual(moved);
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  await page.reload();
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(44);
  expect(mock.getLayout().design).toEqual(moved);
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

test('estudio: Suprimir elimina solo decoraciones seleccionadas y permite deshacer', async ({
  page,
}) => {
  const mock = await setup(page);
  await login(page, false);
  await design(page);
  await page.getByRole('tab', { name: 'Objetos', exact: true }).click();
  await page.getByRole('button', { name: 'Helecho', exact: true }).click();
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  const decor = mock
    .getLayout()
    .design!.items.find((item) => item.kind === 'decor')!;
  const books = mock
    .getLayout()
    .design!.items.filter((item) => item.kind === 'book');
  await page.getByLabel('Color del objeto', { exact: true }).focus();
  await page.keyboard.press('Delete');
  expect(
    mock.getLayout().design!.items.some((item) => item.id === decor.id),
  ).toBe(true);
  await scene(page).locator(`[data-item-id="${decor.id}"]`).click();
  await page.keyboard.press('Delete');
  await expect
    .poll(() =>
      mock.getLayout().design!.items.some((item) => item.id === decor.id),
    )
    .toBe(false);
  expect(mock.getLayout().design!.items).toEqual(books);
  expect(mock.getBooks()).toHaveLength(8);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect
    .poll(() =>
      mock.getLayout().design!.items.find((item) => item.id === decor.id),
    )
    .toEqual(decor);
  const book = scene(page).locator('[data-shelf-book="1"]');
  await book.click();
  await page.keyboard.press('Delete');
  expect(
    mock.getLayout().design!.items.filter((item) => item.kind === 'book'),
  ).toEqual(books);
  const plant = scene(page).locator(`[data-item-id="${decor.id}"]`);
  await plant.focus();
  await plant.press('Shift+Enter');
  await plant.press('Delete');
  await expect
    .poll(() =>
      mock.getLayout().design!.items.some((item) => item.id === decor.id),
    )
    .toBe(false);
  expect(mock.getLayout().design!.items).toEqual(books);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect
    .poll(() =>
      mock.getLayout().design!.items.find((item) => item.id === decor.id),
    )
    .toEqual(decor);
  await page.reload();
  await expect(
    scene(page).locator(`[data-item-id="${decor.id}"]`),
  ).toBeVisible();
});

async function turnWithWheel(page: Page, deltaY: number) {
  await wheelPixels(page, deltaY);
  // Wheel dispatch returns before the browser has processed the gesture.
  await expect
    .poll(() =>
      page.locator('[data-held-book]').getAttribute('data-pull-progress'),
    )
    .toBe(deltaY > 0 ? '0.5' : '0');
}
async function wheelPixels(page: Page, deltaY: number) {
  // CDP divides wheel input by the emulated screen's device scale factor.
  await page.mouse.wheel(
    0,
    deltaY * (await page.evaluate(() => window.devicePixelRatio)),
  );
}

test('estudio: la rueda saca el libro y muestra su portada sin cambiar la composición', async ({
  page,
}, info) => {
  const mock = await setup(page, { photo: true });
  mock.getBooks()[0].book.cover_image_path = `${mock.getBooks()[0].spine!.image_path!.split('/')[0]}/1/cover.jpg`;
  await login(page, false);
  await design(page);
  const book = scene(page).locator('[data-shelf-book="1"]');
  await book.click();
  const original = structuredClone(mock.getLayout());
  const box = (await book.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const scroll = await page.evaluate(() => ({
    page: window.scrollY,
    stage: document.querySelector('.studio-viewport')!.scrollTop,
  }));
  await turnWithWheel(page, 240);
  const held = scene(page).locator('[data-held-book="1"]');
  await expect(held).toBeVisible();
  await expect(book).toHaveAttribute('opacity', '0');
  await expect(held.locator('.book-in-hand-front image')).toHaveAttribute(
    'href',
    /book-covers\/.*\/1\/cover.jpg/,
  );
  await page.screenshot({ path: info.outputPath('libro-girando.png') });
  await wheelPixels(page, 240);
  await expect(held).toHaveAttribute('data-pull-progress', '1');
  await expect(held.locator('.book-in-hand')).toHaveCSS(
    'transform',
    /matrix3d/,
  );
  await page.screenshot({ path: info.outputPath('libro-portada-en-mano.png') });
  expect(
    await page.evaluate(() => ({
      page: window.scrollY,
      stage: document.querySelector('.studio-viewport')!.scrollTop,
    })),
  ).toEqual(scroll);
  expect(mock.getLayout()).toEqual(original);
  await wheelPixels(page, -240);
  await expect(held).toHaveAttribute('data-pull-progress', '0.5');
  await turnWithWheel(page, -240);
  await expect(held).toHaveCount(0);
  await expect(book).toHaveAttribute('opacity', '1');
  expect(mock.getLayout()).toEqual(original);
  await page.getByRole('button', { name: 'Sacar libro', exact: true }).click();
  await expect(held).toHaveAttribute('data-pull-progress', '1');
  await held
    .getByRole('button', {
      name: 'Abrir ficha de El infinito en un junco',
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'El infinito en un junco', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cerrar', exact: true })
    .click();
  await scene(page).locator('.book-in-hand').press('Escape');
  await expect(held).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Sacar libro', exact: true }).click();
  await expect(held.locator('.book-in-hand')).toHaveCSS(
    'transition-duration',
    '0s',
  );
  await page
    .getByRole('button', { name: 'Devolver a la balda', exact: true })
    .click();
  await expect(held).toHaveCount(0);
  const ignored = await book.evaluate((node) => {
    const pinch = new WheelEvent('wheel', {
      deltaY: 120,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const horizontal = new WheelEvent('wheel', {
      deltaX: 120,
      bubbles: true,
      cancelable: true,
    });
    node.dispatchEvent(pinch);
    node.dispatchEvent(horizontal);
    return [pinch.defaultPrevented, horizontal.defaultPrevented];
  });
  expect(ignored).toEqual([false, false]);
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  expect(
    await book.evaluate((node) => {
      const event = new WheelEvent('wheel', {
        deltaY: 120,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  await page.reload();
  await expect(scene(page).locator('[data-held-book]')).toHaveCount(0);
  expect(mock.getLayout()).toEqual(original);
});

async function threeBookStack(page: Page) {
  const mock = await setup(page, { photo: true });
  const books = mock.getBooks();
  books[1].spine = {
    color: '#344c58',
    width: 44,
    height: 212,
    image_path: books[0].spine!.image_path!.replace('/1/', '/2/'),
  };
  books[2].spine = {
    color: '#733f45',
    width: 52,
    height: 224,
    image_path: null,
  };
  await login(page, false);
  await design(page);
  await page.getByRole('tab', { name: 'Libros', exact: true }).click();
  for (const entry of books.slice(0, 3)) {
    await page
      .getByRole('checkbox', {
        name: `Seleccionar ${entry.book.title}`,
        exact: true,
      })
      .check();
  }
  await page
    .getByRole('button', { name: 'Crear pila horizontal', exact: true })
    .click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.find((item) => item.kind === 'stack')
          ?.book_ids,
    )
    .toEqual([1, 2, 3]);
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  return mock;
}

test('estudio: cada libro de una pila abre su ficha y conserva su foto, autor y estado', async ({
  page,
}, info) => {
  const mock = await threeBookStack(page);
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  const entries = mock.getBooks().slice(0, 3);
  for (const entry of entries) {
    const book = scene(page).locator(`[data-shelf-book="${entry.book_id}"]`);
    await expect(book).toHaveAttribute('aria-label', `Ver ${entry.book.title}`);
    if (entry.spine?.image_path) {
      await expect(book.locator('image')).toHaveAttribute(
        'href',
        new RegExp(`/${entry.book_id}/`),
      );
    } else {
      await expect(book.locator('text').first()).toHaveText(entry.book.title);
    }
    await book.click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: entry.book.title, exact: true }),
    ).toBeVisible();
    await expect(dialog).toContainText(entry.book.authors![0].name);
    await expect(
      dialog.getByLabel('Estado de lectura', { exact: true }),
    ).toHaveValue(entry.status);
    if (entry.book_id === 2) {
      await dialog
        .getByLabel('Estado de lectura', { exact: true })
        .selectOption('pending');
      await expect.poll(() => mock.getBooks()[1].status).toBe('pending');
      expect(mock.getBooks()[0].status).toBe('pending');
      expect(mock.getBooks()[2].status).toBe('reading');
    }
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
  for (const [id, key] of [
    [2, 'Enter'],
    [3, 'Space'],
  ] as const) {
    await scene(page).locator(`[data-shelf-book="${id}"]`).press(key);
    await expect(
      page.getByRole('dialog').getByRole('heading', {
        name: entries[id - 1].book.title,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cerrar', exact: true })
      .click();
  }
  await page.screenshot({
    path: info.outputPath('pila-libros-independientes.png'),
  });
  await page.reload();
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(8);
  await scene(page).locator('[data-shelf-book="2"]').click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: entries[1].book.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog').getByLabel('Estado de lectura', { exact: true }),
  ).toHaveValue('pending');
  expect(
    mock.getLayout().design!.items.find((item) => item.kind === 'stack')!
      .book_ids,
  ).toEqual([1, 2, 3]);
});

test('estudio: personaliza cada lomo de una pila y arrastra los tres libros juntos', async ({
  page,
  isMobile,
}) => {
  const mock = await threeBookStack(page);
  const originalSpines = mock
    .getBooks()
    .slice(0, 2)
    .map((entry) => ({ ...entry.spine }));
  for (const id of [2, 3]) {
    await scene(page).locator(`[data-shelf-book="${id}"]`).click();
    await expect(
      page.getByLabel('Libro de la pila', { exact: true }),
    ).toHaveValue(String(id));
    await page
      .getByRole('button', { name: 'Abrir ficha del libro', exact: true })
      .click();
    await expect(
      page.getByRole('dialog').getByRole('heading', {
        name: mock.getBooks()[id - 1].book.title,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cerrar', exact: true })
      .click();
  }
  await page
    .getByRole('button', { name: 'Personalizar lomo', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Color del lomo')).toHaveValue('#733f45');
  await dialog.getByLabel('Color del lomo').fill('#3e625f');
  await dialog
    .getByRole('button', { name: 'Guardar lomo', exact: true })
    .click();
  await expect(
    dialog.getByText('Lomo guardado.', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  expect(
    mock
      .getBooks()
      .slice(0, 2)
      .map((entry) => entry.spine),
  ).toEqual(originalSpines);
  expect(mock.getBooks()[2].spine!.color).toBe('#3e625f');
  await expect(
    scene(page).locator('[data-shelf-book="3"] rect').first(),
  ).toHaveAttribute('fill', '#3e625f');
  const stack = mock
    .getLayout()
    .design!.items.find((item) => item.kind === 'stack')!;
  const book = scene(page).locator('[data-shelf-book="3"]');
  await book.scrollIntoViewIfNeeded();
  const box = (await book.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const target = await scene(page)
    .locator('svg.bookshelf-scene')
    .evaluate((node) => {
      const point = new DOMPoint(250, 550).matrixTransform(
        (node as SVGSVGElement).getScreenCTM()!,
      );
      return { x: point.x, y: point.y };
    });
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
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.find((item) => item.id === stack.id)
          ?.shelf_id,
    )
    .toBe(mock.getLayout().design!.bookcases[0].shelves[1].id);
  expect(
    mock.getLayout().design!.items.find((item) => item.id === stack.id)!
      .book_ids,
  ).toEqual([1, 2, 3]);
  await expect(scene(page).locator('[data-shelf-book]')).toHaveCount(8);
  await page.reload();
  await scene(page).locator('[data-shelf-book="3"]').click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'La librería', exact: true }),
  ).toBeVisible();
});

test('estudio: saca un libro de una pila y devuelve solo ese libro a su lugar', async ({
  page,
}, info) => {
  const mock = await threeBookStack(page);
  await scene(page).locator('[data-shelf-book="2"]').click();
  await expect(
    page.getByLabel('Libro de la pila', { exact: true }),
  ).toHaveValue('2');
  const original = structuredClone(mock.getLayout());
  await page.getByRole('button', { name: 'Sacar libro', exact: true }).click();
  const held = scene(page).locator('[data-held-book="2"]');
  await expect(held).toHaveAttribute('data-pull-progress', '1');
  await expect(held.locator('.book-in-hand-front')).toContainText(
    'El principito',
  );
  await expect(held.locator('.book-in-hand-front')).toContainText(
    'Antoine de Saint-Exupér',
  );
  await expect(held.locator('.book-in-hand')).toBeInViewport();
  await expect(scene(page).locator('[data-shelf-book="2"]')).toHaveAttribute(
    'opacity',
    '0',
  );
  for (const id of [1, 3])
    await expect(
      scene(page).locator(`[data-shelf-book="${id}"]`),
    ).toHaveAttribute('opacity', '1');
  await page.screenshot({ path: info.outputPath('libro-de-pila-en-mano.png') });
  await held
    .getByRole('button', { name: 'Abrir ficha de El principito', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'El principito', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cerrar', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Devolver a la balda', exact: true })
    .click();
  await expect(held).toHaveCount(0);
  await expect(scene(page).locator('[data-shelf-book="2"]')).toHaveAttribute(
    'opacity',
    '1',
  );
  await page.getByLabel('Libro de la pila', { exact: true }).selectOption('3');
  await page.getByRole('button', { name: 'Sacar libro', exact: true }).click();
  await expect(
    scene(page).locator('[data-held-book="3"] .book-in-hand-front'),
  ).toContainText('La librería');
  await page.getByLabel('Libro de la pila', { exact: true }).selectOption('1');
  await expect(scene(page).locator('[data-held-book]')).toHaveCount(0);
  expect(mock.getLayout()).toEqual(original);
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
