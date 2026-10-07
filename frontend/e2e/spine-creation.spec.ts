import { expect, test, type Page } from '@playwright/test';
import { login, setup } from './library-fixtures';

async function editor(page: Page) {
  await page
    .getByRole('button', { name: 'Ver El infinito en un junco', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Editar mi libro', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Personalizar lomo', exact: true })
    .click();
}
async function photograph(page: Page, multiple = false, blank = false) {
  const base64 = await page.evaluate(
    ({ multiple, blank }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 512;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#232b30';
      context.fillRect(0, 0, 360, 512);
      if (!blank) {
        const shapes = multiple
          ? [
              [
                [65, 45],
                [127, 45],
                [127, 471],
                [65, 471],
              ],
              [
                [140, 55],
                [214, 55],
                [214, 465],
                [140, 465],
              ],
            ]
          : [
              [
                [140, 40],
                [203, 49],
                [229, 474],
                [143, 465],
              ],
            ];
        shapes.forEach((points, i) => {
          context.save();
          context.beginPath();
          points.forEach(([x, y], j) =>
            j ? context.lineTo(x, y) : context.moveTo(x, y),
          );
          context.closePath();
          context.clip();
          context.fillStyle = i ? '#5c9653' : '#ab3b47';
          context.fillRect(0, 0, 360, 512);
          context.fillStyle = '#eee0c0';
          context.font = '14px serif';
          context.translate(points[0][0] + 30, 90);
          context.rotate(Math.PI / 2);
          context.fillText(i ? 'OTRA HISTORIA' : 'MI LOMO ORIGINAL', 0, 0);
          context.restore();
        });
      }
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { multiple, blank },
  );
  return {
    name: 'fotografia-lomo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  };
}
async function cropData(page: Page) {
  return page.locator('.spine-crop-frame').evaluate((node) => ({
    x: Number(node.getAttribute('data-crop-x')),
    y: Number(node.getAttribute('data-crop-y')),
    width: Number(node.getAttribute('data-crop-width')),
    height: Number(node.getAttribute('data-crop-height')),
  }));
}
async function cornerGesture(page: Page, mobile: boolean) {
  const corner = page.getByRole('button', {
    name: 'Ajustar esquina superior izquierda del recorte',
    exact: true,
  });
  await corner.scrollIntoViewIfNeeded();
  const bounds = (await corner.boundingBox())!,
    start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    end = { x: start.x + 5, y: start.y + 6 };
  if (mobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [start],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [end],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await page.mouse.up();
  }
}

test('creación de lomos: detecta perspectiva, rectifica toda la imagen y guarda sin márgenes', async ({
  page,
  isMobile,
}, info) => {
  const mock = await setup(page, { failUploadOnce: true });
  let uploaded: Buffer | undefined;
  await page.route('**/storage/v1/object/book-spines/**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataBuffer()!;
      const begin = body.indexOf(Buffer.from([255, 216])),
        end = body.lastIndexOf(Buffer.from([255, 217]));
      if (begin >= 0 && end > begin) uploaded = body.subarray(begin, end + 2);
    }
    await route.fallback();
  });
  await login(page);
  await editor(page);
  await page
    .getByLabel('Hacer foto del lomo', { exact: true })
    .setInputFiles(await photograph(page));
  await expect(
    page.locator('.spine-detection-controls > p').first(),
  ).toContainText(/Bordes detectados|Hay varios posibles lomos/, {
    timeout: 15000,
  });
  const detected = await cropData(page);
  expect(detected.x).toBeGreaterThan(130);
  expect(detected.x).toBeLessThan(155);
  expect(detected.y).toBeGreaterThan(30);
  expect(detected.y).toBeLessThan(60);
  expect(detected.height).toBeGreaterThan(400);
  const corners = page.locator('.spine-perspective-overlay polygon');
  const before = await corners.getAttribute('points');
  await page.getByRole('button', { name: 'Ampliar foto', exact: true }).click();
  expect(await corners.getAttribute('points')).toBe(before);
  await cornerGesture(page, isMobile);
  await expect(corners).not.toHaveAttribute('points', before!);
  const after = (await corners.getAttribute('points'))!.split(' ');
  expect(after.slice(1)).toEqual(before!.split(' ').slice(1));
  const selected = page.getByRole('button', {
    name: 'Ajustar esquina superior izquierda del recorte',
    exact: true,
  });
  await selected.focus();
  await selected.press('Shift+ArrowRight');
  await expect(corners).not.toHaveAttribute('points', after.join(' '));
  await page
    .getByRole('button', { name: 'Detectar lomo de nuevo', exact: true })
    .click();
  await expect(corners).toHaveAttribute('points', before!, { timeout: 15000 });
  const turn = page.getByRole('button', {
    name: 'Girar lomo 180°',
    exact: true,
  });
  await turn.click();
  const points = before!.split(' ');
  await expect(corners).toHaveAttribute(
    'points',
    [...points.slice(2), ...points.slice(0, 2)].join(' '),
  );
  await turn.click();
  await expect(corners).toHaveAttribute('points', before!);
  await page.getByRole('button', { name: 'Reducir foto', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Encuadra solo el lomo' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('lomo-detectado.png') });
  await page
    .getByRole('button', { name: 'Usar este recorte', exact: true })
    .click();
  await page.getByRole('button', { name: 'Guardar lomo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'No hemos podido subir la foto',
  );
  await page.getByRole('button', { name: 'Guardar lomo', exact: true }).click();
  await expect(page.getByText('Lomo guardado.', { exact: true })).toBeVisible();
  expect(mock.getUploadedPhotos()).toHaveLength(1);
  expect(uploaded).toBeDefined();
  const pixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return {
      height: image.height,
      samples: [
        [1, 1],
        [image.width - 2, 1],
        [1, image.height - 2],
        [image.width - 2, image.height - 2],
      ].map(([x, y]) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3)),
    };
  }, uploaded!.toString('base64'));
  expect(pixels.height).toBe(1024);
  for (const sample of pixels.samples)
    for (let c = 0; c < 3; c++)
      expect(Math.abs(sample[c] - [171, 59, 71][c])).toBeLessThan(18);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Estantería', exact: true }).click();
  const book = page.locator('[data-shelf-book="1"]'),
    photo = book.locator('image');
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute('preserveAspectRatio', 'none');
  await expect(book.locator('[data-automatic-spine-shading]')).toHaveCount(0);
  const stored = mock.getBooks()[0].spine?.image_path;
  await page.reload();
  await expect(photo).toBeVisible();
  expect(mock.getBooks()[0].spine?.image_path).toBe(stored);
});

test('creación de lomos: varios candidatos se eligen con vista previa', async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await editor(page);
  await page
    .getByLabel('Foto del lomo', { exact: true })
    .setInputFiles(await photograph(page, true));
  await expect(
    page.getByText(
      'Hay varios posibles lomos. Elige el tuyo y revisa sus esquinas.',
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15000 });
  const choices = page.locator('.spine-detection-choice');
  expect(await choices.count()).toBeGreaterThanOrEqual(2);
  const first = await cropData(page);
  await choices.nth(1).click();
  await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const second = await cropData(page);
  expect(second.x).not.toBe(first.x);
  await expect(choices.nth(1).locator('canvas')).toBeVisible();
});

test('creación de lomos: una foto sin bordes ofrece ajuste manual y cancelar no sube nada', async ({
  page,
}) => {
  const mock = await setup(page);
  await login(page);
  await editor(page);
  await page
    .getByLabel('Foto del lomo', { exact: true })
    .setInputFiles(await photograph(page, false, true));
  await expect(
    page.getByText(
      'No se han encontrado bordes claros. Marca las cuatro esquinas del lomo.',
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15000 });
  const corner = page.getByRole('button', {
    name: 'Ajustar esquina superior izquierda del recorte',
    exact: true,
  });
  await corner.focus();
  await corner.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: 'Usar este recorte', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Cerrar personalización', exact: true })
    .click();
  expect(mock.getUploadedPhotos()).toEqual([]);
});
