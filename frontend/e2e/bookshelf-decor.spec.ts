import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { login, setup } from './library-fixtures';

async function objects(page: Page) {
  await page.getByRole('button', { name: 'Diseñar', exact: true }).click();
  await page.getByRole('tab', { name: 'Objetos', exact: true }).click();
}
const art = (page: Page, asset: string) =>
  page.locator(`.studio-viewport [data-decor-art="${asset}"]`);

test('decoración: catálogo local completo, material original, color y PNG conservan el diseño', async ({
  page,
}, info) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (/polyhaven|ambientcg|kenney/.test(request.url()))
      external.push(request.url());
  });
  const mock = await setup(page);
  await login(page, false);
  await objects(page);
  await expect(page.locator('.studio-decor-grid button')).toHaveCount(27);
  await expect(page.locator('.studio-decor-grid image')).toHaveCount(27);
  const images = await page
    .locator('.studio-decor-grid image')
    .evaluateAll(async (nodes) =>
      Promise.all(
        nodes.map(async (node) => {
          const url = node.getAttribute('href')!;
          const image = new Image();
          image.src = url;
          await image.decode();
          return {
            url,
            width: image.naturalWidth,
            height: image.naturalHeight,
          };
        }),
      ),
    );
  expect(
    images.every(
      (image) =>
        image.url.endsWith('.thumb.webp') &&
        image.width <= 192 &&
        image.height <= 192,
    ),
  ).toBe(true);
  await page
    .locator('.studio-workspace')
    .screenshot({ path: info.outputPath('catalogo-realista.png') });

  await page.getByRole('button', { name: 'Jarrón alto', exact: true }).click();
  await expect.poll(() => mock.getLayout().revision).toBe(1);
  await expect(
    art(page, 'vase').locator('[data-decor-resource] > image'),
  ).toHaveCount(1);
  const original = structuredClone(mock.getLayout().design!);
  await page.getByLabel('Color del objeto', { exact: true }).fill('#b83347');
  await expect.poll(() => mock.getLayout().revision).toBe(2);
  await expect(art(page, 'vase').locator('mask image')).toHaveAttribute(
    'href',
    '/assets/decorations/vase.mask.webp',
  );
  await expect(art(page, 'vase').locator('feColorMatrix')).toHaveCount(1);
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  await page.reload();
  await expect(art(page, 'vase').locator('feColorMatrix')).toHaveCount(1);
  await page.getByRole('button', { name: 'Diseñar', exact: true }).click();

  // Locate an opaque point on the vase in the outer scene's stable coordinates.
  const point = await art(page, 'vase').evaluate((node) => {
    const outer = document.querySelector(
      '.studio-viewport svg.bookshelf-scene',
    ) as SVGSVGElement;
    const local = (node as SVGSVGElement).viewBox.baseVal;
    const screen = new DOMPoint(
      local.width / 2,
      local.height * 0.8,
    ).matrixTransform((node as SVGSVGElement).getScreenCTM()!);
    const logical = screen.matrixTransform(outer.getScreenCTM()!.inverse());
    const view = outer.viewBox.baseVal;
    return {
      x: (logical.x - view.x) / view.width,
      y: (logical.y - view.y) / view.height,
    };
  });
  await page
    .getByText('Compartir una imagen de mi estantería', { exact: true })
    .click();
  await page.getByLabel('Encuadre', { exact: true }).selectOption('original');
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar PNG', exact: true })
    .click();
  const png = await readFile((await (await downloaded).path())!);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const pixel = await page.evaluate(
    async ({ data, point }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return Array.from(
        context.getImageData(
          Math.round(point.x * canvas.width),
          Math.round(point.y * canvas.height),
          1,
          1,
        ).data,
      );
    },
    { data: png.toString('base64'), point },
  );
  expect(pixel[0]).toBeGreaterThan(pixel[1] * 1.5);
  expect(pixel[0]).toBeGreaterThan(pixel[2] * 1.5);
  await expect(
    page.getByText('Tu estantería está lista para compartir.'),
  ).toBeVisible();
  await page
    .locator('.studio-viewport [data-item-id]:has([data-decor-art="vase"])')
    .click();
  await page
    .getByRole('button', { name: 'Recuperar material original', exact: true })
    .click();
  await expect(art(page, 'vase').locator('feColorMatrix')).toHaveCount(0);
  const restored = mock.getLayout().design!;
  expect(restored.items[restored.items.length - 1].x).toBe(
    original.items[original.items.length - 1].x,
  );
  expect(external).toEqual([]);
  await page
    .getByRole('button', { name: 'Separador dorado', exact: true })
    .click();
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  // Simulate an existing tall ornament; loading new artwork must retain its
  // saved proportions and make use of the available height.
  mock
    .getLayout()
    .design!.items.find((item) => item.asset === 'divider')!.height = 150;
  await page.reload();
  await page.getByRole('button', { name: 'Diseñar', exact: true }).click();
  const divider = page.locator(
    '.studio-viewport [data-item-id]:has([data-decor-art="divider"])',
  );
  const visible = await art(page, 'divider')
    .locator('[data-decor-resource] > image')
    .boundingBox();
  const space = await divider
    .locator(':scope > rect[fill="transparent"]')
    .boundingBox();
  // A narrow ornament should retain its shelf height rather than being
  // letterboxed a second time inside a generic portrait illustration.
  expect(visible!.height / space!.height).toBeGreaterThan(0.9);
});

test('decoración: conserva un respaldo y avisa en la exportación si falta una imagen', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/assets/decorations/vase.webp', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await login(page, false);
  await objects(page);
  await page.getByRole('button', { name: 'Jarrón alto', exact: true }).click();
  await expect(art(page, 'vase')).toHaveAttribute(
    'data-decoration-unavailable',
    'true',
  );
  await expect(
    art(page, 'vase').locator('[data-decor-fallback]'),
  ).toBeVisible();
  await page
    .getByText('Compartir una imagen de mi estantería', { exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar PNG', exact: true })
    .click();
  expect(await (await download).failure()).toBeNull();
  await expect(
    page.getByText(
      'Una decoración no está disponible; se ha usado su dibujo de respaldo.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('decoración: la exportación comparte recursos duplicados y recupera fallos posteriores a la carga', async ({
  page,
}) => {
  const mock = await setup(page);
  let failExport = false;
  let failedRequests = 0;
  await page.route('**/assets/decorations/vase.webp', (route) => {
    if (!failExport) return route.continue();
    failedRequests++;
    return route.fulfill({ status: 404, body: 'missing' });
  });
  await login(page, false);
  await objects(page);
  await page.getByRole('button', { name: 'Jarrón alto', exact: true }).click();
  await page.getByLabel('Color del objeto', { exact: true }).fill('#b83347');
  await page
    .getByRole('button', { name: 'Duplicar objeto', exact: true })
    .click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((item) => item.kind === 'decor')
          .length,
    )
    .toBe(2);
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  await expect(art(page, 'vase')).toHaveCount(2);
  await art(page, 'vase')
    .locator('[data-decor-resource] > image')
    .evaluateAll(async (nodes) => {
      await Promise.all(
        nodes.map(async (node) => {
          const image = new Image();
          image.src = node.getAttribute('href')!;
          await image.decode();
        }),
      );
    });
  await page
    .getByText('Compartir una imagen de mi estantería', { exact: true })
    .click();
  failExport = true;
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar PNG', exact: true })
    .click();
  expect(await (await download).failure()).toBeNull();
  await expect(
    page.getByText(
      'Una decoración no está disponible; se ha usado su dibujo de respaldo.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(failedRequests).toBe(1);
  await expect(art(page, 'vase').locator('[data-decor-resource]')).toHaveCount(
    2,
  );
});
