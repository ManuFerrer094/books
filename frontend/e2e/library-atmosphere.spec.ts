import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { login, setup } from './library-fixtures';
import { atmosphereScenes } from '../../src/library/bookshelf-atmosphere';

async function open(page: Page) {
  await page.getByRole('button', { name: 'Luz y sonido', exact: true }).click();
}
async function choose(page: Page, name = 'Tarde de lluvia') {
  await page
    .locator('.atmo-scene')
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
}
const lighting = (page: Page) =>
  page.locator('.studio-viewport [data-library-lighting]');
async function slider(page: Page, name: string, value: number) {
  const control = page.getByRole('slider', { name, exact: true });
  // One range adjustment is one action. Separate simulated key presses can
  // span several undo groups on a busy machine and test a different gesture.
  await control.evaluate((node, next) => {
    const input = node as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    const outputs: DynamicsCompressorNode[] = [];
    const decoded: { duration: number; channels: number }[] = [];
    Object.assign(window, { libraryAudio: { contexts, outputs, decoded } });
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.push(this);
      }
      createDynamicsCompressor() {
        const output = super.createDynamicsCompressor();
        outputs.push(output);
        return output;
      }
      decodeAudioData(
        data: ArrayBuffer,
        success?: DecodeSuccessCallback,
        failure?: DecodeErrorCallback,
      ) {
        return super.decodeAudioData(data, success, failure).then((buffer) => {
          decoded.push({
            duration: buffer.duration,
            channels: buffer.numberOfChannels,
          });
          return buffer;
        });
      }
    };
  });
}
async function audioStates(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as { libraryAudio: { contexts: AudioContext[] } }
    ).libraryAudio.contexts.map((ctx) => ctx.state),
  );
}

test('ambientes: diez escenas, composición intacta, teclado, guardado y deshacer', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const mock = await setup(page);
  await observeAudio(page);
  await login(page, false);
  const original = structuredClone(mock.getLayout().design!);
  await expect(lighting(page)).toHaveCount(0);
  await open(page);
  await expect(page.locator('.atmo-scene')).toHaveCount(10);
  await page
    .locator('.atmo-panel')
    .screenshot({ path: info.outputPath('ambientes-panel.png') });
  for (const scene of atmosphereScenes) {
    await choose(page, scene.name);
    await expect(lighting(page)).toHaveAttribute(
      'data-atmosphere-scene',
      scene.id,
    );
    expect(mock.getLayout().design!.items).toEqual(original.items);
    expect(mock.getLayout().design!.bookcases).toEqual(original.bookcases);
    expect(await audioStates(page)).toEqual([]);
    await page.getByRole('button', { name: 'Cerrar luz y sonido' }).click();
    await page
      .locator('.bookshelf-studio')
      .screenshot({ path: info.outputPath(`${scene.id}.png`) });
    await open(page);
  }
  await page.getByRole('tab', { name: 'Ambientes', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Luz', exact: true }),
  ).toBeFocused();
  await slider(page, 'Dirección de la luz', 35);
  await slider(page, 'Rayos de ventana', 80);
  await expect
    .poll(() => mock.getLayout().design!.atmosphere!.lighting.beam)
    .toBe(0.8);
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect
    .poll(() => mock.getLayout().design!.atmosphere!.lighting.beam)
    .toBe(0.6);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect
    .poll(() => mock.getLayout().design!.atmosphere!.lighting.beam)
    .toBe(0.8);
  const saved = structuredClone(mock.getLayout().design!);
  await page.reload();
  await expect(lighting(page)).toHaveCount(1);
  expect(mock.getLayout().design).toEqual(saved);
  expect(await audioStates(page)).toEqual([]);
  await expect(
    page.getByRole('button', { name: 'Activar sonido' }),
  ).toBeVisible();
});

test('sonido: sin reproducción automática, mezcla real, solo, silencio, pausa y cierre', async ({
  page,
}) => {
  const mock = await setup(page);
  await observeAudio(page);
  await login(page, false);
  await open(page);
  await choose(page);
  await page.getByRole('tab', { name: 'Sonido', exact: true }).click();
  await expect(page.locator('.atmo-sound')).toHaveCount(14);
  expect(await audioStates(page)).toEqual([]);
  await page
    .getByRole('button', { name: 'Activar sonido', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pausar sonido' }),
  ).toBeVisible();
  await expect.poll(() => audioStates(page)).toEqual(['running']);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { libraryAudio: { decoded: unknown[] } })
            .libraryAudio.decoded.length,
      ),
    )
    .toBe(2);
  const rms = await page.evaluate(async () => {
    const { contexts, outputs } = (
      window as unknown as {
        libraryAudio: {
          contexts: AudioContext[];
          outputs: DynamicsCompressorNode[];
        };
      }
    ).libraryAudio;
    const analyser = contexts[0].createAnalyser();
    analyser.fftSize = 2048;
    outputs[0].connect(analyser);
    // Measure the actual recording after the 1.8 second crossfade finishes.
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const samples = new Float32Array(analyser.fftSize);
    for (let i = 0; i < 40; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      analyser.getFloatTimeDomainData(samples);
      if (Math.max(...samples.map(Math.abs)) > 0.0001) break;
    }
    analyser.disconnect();
    outputs[0].disconnect(analyser);
    return {
      rms: Math.sqrt(
        samples.reduce((sum, n) => sum + n * n, 0) / samples.length,
      ),
      peak: Math.max(...samples.map(Math.abs)),
    };
  });
  expect(rms.rms).toBeGreaterThan(0.0001);
  expect(rms.peak).toBeLessThan(0.8);
  const beforeSolo = mock.getLayout().revision;
  await page
    .getByRole('button', { name: 'Escuchar solo Lluvia', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Escuchar solo Lluvia' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(mock.getLayout().revision).toBe(beforeSolo);
  await slider(page, 'Volumen de Lluvia', 25);
  await expect
    .poll(() => mock.getLayout().design!.atmosphere!.sound.layers.rain)
    .toBe(0.25);
  await page
    .getByRole('button', { name: 'Silenciar Lluvia', exact: true })
    .click();
  await expect
    .poll(() => mock.getLayout().design!.atmosphere!.sound.layers.rain)
    .toBe(0);
  await page
    .getByRole('button', { name: 'Activar Lluvia', exact: true })
    .click();
  await expect
    .poll(() => mock.getLayout().design!.atmosphere!.sound.layers.rain)
    .toBe(0.25);
  await slider(page, 'Volumen general', 0);
  await expect
    .poll(() => mock.getLayout().design!.atmosphere!.sound.master)
    .toBe(0);
  const muted = await page.evaluate(async () => {
    const { contexts, outputs } = (
      window as unknown as {
        libraryAudio: {
          contexts: AudioContext[];
          outputs: DynamicsCompressorNode[];
        };
      }
    ).libraryAudio;
    const analyser = contexts[0].createAnalyser();
    outputs[0].connect(analyser);
    await new Promise((resolve) => setTimeout(resolve, 700));
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    outputs[0].disconnect(analyser);
    analyser.disconnect();
    return Math.max(...samples.map(Math.abs));
  });
  expect(muted).toBeLessThan(0.00001);
  await page
    .getByRole('button', { name: 'Pausar sonido', exact: true })
    .click();
  await expect.poll(() => audioStates(page)).toEqual(['suspended']);
  await page
    .getByRole('button', { name: 'Activar sonido', exact: true })
    .click();
  await expect.poll(() => audioStates(page)).toEqual(['running']);
  await page.getByRole('button', { name: 'Portadas', exact: true }).click();
  await expect.poll(() => audioStates(page)).toEqual(['closed']);
});

test('lectura: temporizador real, cancelación y final sin activar audio', async ({
  page,
}) => {
  await setup(page);
  await observeAudio(page);
  await login(page, false);
  await open(page);
  await page.getByRole('tab', { name: 'Lectura', exact: true }).click();
  await page.clock.install();
  await page.getByLabel('Duración en minutos', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Empezar sesión de lectura' }).click();
  await expect(
    page.getByRole('button', { name: 'Temporizador de lectura: 01:00' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar temporizador' }).click();
  await expect(
    page.getByText('Temporizador cancelado.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Empezar sesión de lectura' }).click();
  await page.getByRole('button', { name: 'Cerrar luz y sonido' }).click();
  await page.clock.fastForward(61000);
  await expect(
    page.getByText('Tu sesión ha terminado. El sonido se apaga suavemente.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(await audioStates(page)).toEqual([]);
  await page.reload();
  await expect(page.locator('.atmo-countdown')).toHaveCount(0);
});

test('iluminación: lámparas, velas, movimiento reducido, PNG y 500 libros', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const mock = await setup(page, { count: 500 });
  await login(page, false);
  await page.getByRole('button', { name: 'Diseñar', exact: true }).click();
  await page.getByRole('tab', { name: 'Objetos', exact: true }).click();
  await page
    .getByRole('button', { name: 'Lámpara de lectura', exact: true })
    .click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((i) => i.asset === 'lamp').length,
    )
    .toBe(1);
  await page.getByRole('button', { name: 'Vela', exact: true }).click();
  await expect
    .poll(
      () =>
        mock.getLayout().design!.items.filter((i) => i.asset === 'candle')
          .length,
    )
    .toBe(1);
  await open(page);
  await choose(page, 'Biblioteca de medianoche');
  await page.getByRole('button', { name: 'Cerrar luz y sonido' }).click();
  await expect(
    page.locator('.studio-viewport [data-light-source="lamp"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.studio-viewport [data-light-source="candle"]'),
  ).toHaveCount(1);
  await expect(page.locator('.studio-viewport [data-shelf-book]')).toHaveCount(
    500,
  );
  expect(
    await lighting(page).evaluate(
      (node) => getComputedStyle(node).pointerEvents,
    ),
  ).toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.studio-viewport .library-dust')
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('none');
  await page
    .locator('.studio-workspace')
    .screenshot({ path: info.outputPath('medianoche-500.png') });
  await page
    .getByText('Compartir una imagen de mi estantería', { exact: true })
    .click();
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar PNG', exact: true })
    .click();
  const png = await readFile((await (await downloaded).path())!);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const exported = page.locator(
    '.studio-export-source [data-library-lighting]',
  );
  await expect(exported).toHaveAttribute('data-atmosphere-scene', 'midnight');
  expect(
    await exported.evaluate((node) =>
      node.querySelector('.library-light-motion'),
    ),
  ).toBe(null);
});

test('persistencia: fallo conserva ambiente, reintento y conflicto mantienen el borrador', async ({
  page,
}) => {
  const mock = await setup(page, { failShelfOnce: true, staleShelfOnce: true });
  await login(page, false);
  await open(page);
  await page
    .locator('.atmo-scene')
    .filter({ has: page.getByText('Archivo encantado', { exact: true }) })
    .click();
  await expect(
    page.getByRole('button', { name: 'Reintentar guardado', exact: true }),
  ).toBeVisible();
  await expect(lighting(page)).toHaveAttribute(
    'data-atmosphere-scene',
    'enchanted',
  );
  await page
    .getByRole('button', { name: 'Reintentar guardado', exact: true })
    .click();
  await expect(page.locator('.studio-comparison')).toBeVisible();
  await expect(
    page
      .locator('.studio-comparison > div')
      .first()
      .locator('[data-library-lighting]'),
  ).toHaveAttribute('data-atmosphere-scene', 'enchanted');
  await page
    .getByRole('button', {
      name: 'Guardar mi borrador sobre la versión actual',
      exact: true,
    })
    .click();
  await expect(page.locator('.studio-save')).toHaveText('Todo guardado');
  expect(mock.getLayout().design!.atmosphere!.scene).toBe('enchanted');
});

test('biblioteca vacía: el ambiente funciona sin libros y sin desbordar el móvil', async ({
  page,
}) => {
  await setup(page, { empty: true });
  await login(page, false);
  await open(page);
  await choose(page, 'Jardín de lectura');
  await expect(lighting(page)).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('grabaciones: carga local bajo demanda, licencias, transición y respaldo con reintento', async ({
  page,
}) => {
  await setup(page);
  await observeAudio(page);
  await login(page, false);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.mp3')) requests.push(request.url());
  });
  let fail = true;
  await page.route('**/assets/library-sounds/rain.mp3', (route) =>
    fail ? route.fulfill({ status: 503, body: '' }) : route.continue(),
  );
  await open(page);
  await choose(page);
  expect(requests).toEqual([]);
  await page
    .getByRole('button', { name: 'Activar sonido', exact: true })
    .click();
  await expect(
    page.getByText(/Una grabación no está disponible/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Pausar sonido', exact: true })
    .click();
  await expect.poll(() => audioStates(page)).toEqual(['suspended']);
  fail = false;
  await page
    .getByRole('button', { name: 'Activar sonido', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Sonido', exact: true }).click();
  for (const name of ['Chimenea', 'Pájaros', 'Mar', 'Noche'])
    await page
      .getByRole('button', { name: `Activar ${name}`, exact: true })
      .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { libraryAudio: { decoded: unknown[] } })
            .libraryAudio.decoded.length,
      ),
    )
    .toBe(6);
  expect(
    requests.every((url) =>
      url.startsWith(new URL(page.url()).origin + '/assets/library-sounds/'),
    ),
  ).toBe(true);
  await expect(page.getByText(/Una grabación no está disponible/)).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('link', { name: 'Créditos y licencias' }),
  ).toHaveAttribute('href', '/assets/library-sounds/credits.html');
  const credits = await page.request.get('/assets/library-sounds/credits.html');
  expect(await credits.text()).toContain('Sound Effect By Nicole Marie T');
  const manifest = await (
    await page.request.get('/assets/library-sounds/sources.json')
  ).json();
  expect(manifest).toHaveLength(6);
  expect(
    manifest.every((source: { sha256: string }) =>
      /^[0-9a-f]{64}$/.test(source.sha256),
    ),
  ).toBe(true);
});

test('lectura con sonido: la sesión atenúa antes de suspender el audio', async ({
  page,
}) => {
  await setup(page);
  await observeAudio(page);
  await login(page, false);
  await open(page);
  await choose(page);
  await page
    .getByRole('button', { name: 'Activar sonido', exact: true })
    .click();
  await expect.poll(() => audioStates(page)).toEqual(['running']);
  await page.clock.install();
  await page.getByRole('tab', { name: 'Lectura', exact: true }).click();
  await page.getByLabel('Duración en minutos', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Empezar sesión de lectura' }).click();
  await page.clock.fastForward(60000);
  await expect(
    page.getByRole('button', { name: 'Activar sonido', exact: true }),
  ).toBeVisible();
  expect(await audioStates(page)).toEqual(['running']);
  await page.clock.fastForward(11000);
  await expect.poll(() => audioStates(page)).toEqual(['suspended']);
});
