import { expect, test, type Page } from '@playwright/test';
import { login, setup } from './library-fixtures';
import { furnitureNames, lightNames } from '../../src/library/bookshelf-craft';

const stage = (page: Page) => page.locator('.studio-viewport');
const saved = (page: Page) =>
  expect(page.locator('.studio-save')).toHaveText('Todo guardado');
async function designing(page: Page, tab = 'Muebles') {
  await page.getByRole('button', { name: 'Diseñar', exact: true }).click();
  await page.getByRole('tab', { name: tab, exact: true }).click();
}
test('carpintería: cinco muebles y seis luminarias conservan los libros, teclado y recarga', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const mock = await setup(page);
  await login(page, false);
  await designing(page);
  const books = structuredClone(mock.getLayout().design!.items);
  for (const [style, name] of Object.entries(furnitureNames)) {
    await page.getByRole('button', { name, exact: true }).click();
    await saved(page);
    await expect(stage(page).locator('[data-furniture-style]')).toHaveAttribute(
      'data-furniture-style',
      style,
    );
    await stage(page).screenshot({
      path: info.outputPath(`mueble-${style}.png`),
    });
    expect(mock.getLayout().design!.items).toEqual(books);
  }
  for (const [type, name] of Object.entries(lightNames)) {
    await page.getByRole('button', { name, exact: true }).click();
    await saved(page);
    await expect(
      stage(page).locator('[data-shelf-fixture]').first(),
    ).toHaveAttribute('data-shelf-fixture', type);
    await stage(page).screenshot({ path: info.outputPath(`luz-${type}.png`) });
  }
  await page
    .getByRole('button', { name: 'Focos de galería', exact: true })
    .click();
  await saved(page);
  const toggle = stage(page).getByRole('button', { name: /^Luces de / });
  await page
    .getByRole('button', {
      name: 'Copiar esta iluminación a todas las baldas',
      exact: true,
    })
    .click();
  await saved(page);
  expect(
    mock
      .getLayout()
      .design!.bookcases[0].shelves.every((s) => s.light.type === 'spots'),
  ).toBe(true);
  await page
    .getByRole('checkbox', { name: 'Luz de esta balda encendida', exact: true })
    .uncheck();
  await saved(page);
  await expect(
    stage(page).locator('[data-shelf-fixture]').first(),
  ).toHaveAttribute('data-powered', 'false');
  await page
    .getByRole('checkbox', { name: 'Luz de esta balda encendida', exact: true })
    .check();
  await saved(page);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await saved(page);
  expect(mock.getLayout().design!.bookcases[0].lights_on).toBe(false);
  await expect(
    stage(page).locator('[data-shelf-fixture]').first(),
  ).toHaveAttribute('data-powered', 'false');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await saved(page);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await saved(page);
  await page.reload();
  await expect(
    stage(page).getByRole('button', { name: /^Luces de / }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(stage(page).locator('[data-furniture-style]')).toHaveAttribute(
    'data-furniture-style',
    'floating',
  );
  expect(mock.getLayout().design!.items).toEqual(books);
});

test('objetos vivos: clics individuales, colecciones, deshacer y exportación sin controles', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const mock = await setup(page);
  await login(page, false);
  await designing(page, 'Objetos');
  for (const name of [
    'Lámpara',
    'Taza',
    'Marco de foto',
    'Reloj',
    'Cristal',
    'Helecho',
  ]) {
    // Catalogue labels vary by object; use their stable asset identity for this setup.
    const asset = (
      {
        Lámpara: 'lamp',
        Taza: 'mug',
        'Marco de foto': 'portrait',
        Reloj: 'clock',
        Cristal: 'crystal',
        Helecho: 'fern',
      } as Record<string, string>
    )[name];
    await page
      .locator('.studio-decor-grid button')
      .filter({ has: page.locator(`[data-decor-art="${asset}"]`) })
      .click();
    await saved(page);
  }
  await page
    .getByRole('button', { name: 'Jardín interior', exact: true })
    .click();
  await expect(page.locator('.studio-decor-grid button')).toHaveCount(8);
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(page.locator('.studio-decor-grid button')).toHaveCount(27);
  const before = structuredClone(mock.getLayout().design!);
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  const object = (asset: string) =>
    stage(page).locator(
      `[data-item-id="${before.items.find((i) => i.asset === asset)!.id}"]`,
    );
  await object('lamp').click();
  await saved(page);
  await expect(object('lamp').locator('[data-object-emission]')).toHaveCount(0);
  await object('portrait').focus();
  await page.keyboard.press('Space');
  await saved(page);
  await expect(object('portrait').locator('[data-frame-art]')).toHaveAttribute(
    'data-frame-art',
    '1',
  );
  for (const asset of ['mug', 'clock', 'fern', 'crystal']) {
    await object(asset).click();
    await saved(page);
  }
  expect(
    mock.getLayout().design!.items.find((i) => i.asset === 'mug')!.active,
  ).toBe(true);
  expect(
    mock.getLayout().design!.items.find((i) => i.asset === 'clock')!.active,
  ).toBe(true);
  expect(
    mock.getLayout().design!.items.find((i) => i.asset === 'crystal')!.active,
  ).toBe(false);
  expect(
    mock.getLayout().design!.items.map((i) => [i.id, i.x, i.shelf_id]),
  ).toEqual(before.items.map((i) => [i.id, i.x, i.shelf_id]));
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await saved(page);
  await expect(object('crystal').locator('[data-object-emission]')).toHaveCount(
    1,
  );
  await page.reload();
  await expect(stage(page).locator('[data-frame-art]')).toHaveAttribute(
    'data-frame-art',
    '1',
  );
  await expect(
    stage(page).locator('[data-decor-effect="mug"] path'),
  ).toHaveCount(3);
  await stage(page).screenshot({ path: info.outputPath('objetos-vivos.png') });
  await page
    .getByRole('button', {
      name: 'Apagar todas las luces del mueble',
      exact: true,
    })
    .click();
  await saved(page);
  await expect(stage(page).locator('[data-object-emission]')).toHaveCount(0);
  expect(
    mock.getLayout().design!.items.find((i) => i.asset === 'lamp')!.active,
  ).toBe(false);
  await page
    .getByRole('button', {
      name: 'Encender todas las luces del mueble',
      exact: true,
    })
    .click();
  await saved(page);
  await expect(
    stage(page).locator('[data-decor-effect="lamp"] [data-object-emission]'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Diseñar', exact: true }).click();
  await stage(page)
    .locator(
      `[data-item-id="${before.items.find((i) => i.asset === 'portrait')!.id}"]`,
    )
    .click();
  await page
    .getByRole('combobox', { name: 'Ilustración del marco', exact: true })
    .selectOption('original');
  await saved(page);
  await expect(stage(page).locator('[data-frame-art]')).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Ilustración del marco', exact: true })
    .selectOption('2');
  await saved(page);
  await expect(stage(page).locator('[data-frame-art]')).toHaveAttribute(
    'data-frame-art',
    '2',
  );
  await page
    .getByText('Compartir una imagen de mi estantería', { exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar PNG', exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await expect(
    page.locator('.studio-export-source [data-case-switch]'),
  ).toHaveCount(0);
});

test('movimiento reducido, luz de habitación independiente y error de guardado recuperable', async ({
  page,
}) => {
  const mock = await setup(page, { failShelfOnce: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, false);
  await designing(page, 'Objetos');
  await page
    .locator('.studio-decor-grid button')
    .filter({ has: page.locator('[data-decor-art="mug"]') })
    .click();
  await expect(
    page.getByRole('button', { name: 'Reintentar guardado', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Reintentar guardado', exact: true })
    .click();
  await saved(page);
  await page
    .getByRole('button', { name: 'Preparar una infusión', exact: true })
    .click();
  await saved(page);
  expect(
    await stage(page)
      .locator('.craft-steam')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await page.getByRole('button', { name: 'Luz y sonido', exact: true }).click();
  await page
    .locator('.atmo-scene')
    .filter({ has: page.getByText('Archivo encantado', { exact: true }) })
    .click();
  await saved(page);
  const light = structuredClone(mock.getLayout().design!.atmosphere);
  await page
    .getByRole('button', {
      name: 'Apagar todas las luces del mueble',
      exact: true,
    })
    .click();
  await saved(page);
  expect(mock.getLayout().design!.atmosphere).toEqual(light);
  await expect(stage(page).locator('[data-library-lighting]')).toHaveCount(1);
});
