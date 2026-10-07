/** Export the actual SVG scene, embedding private images and local fonts. */
export async function exportBookshelf(
  svg: SVGSVGElement,
  format: 'original' | 'square' | 'portrait',
  filename: string,
) {
  await document.fonts.ready;
  const started = Date.now();
  while (svg.dataset.photosReady !== 'true' && Date.now() - started < 20000)
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const warnings: string[] = [];
  const decorWarning =
    'Una decoración no está disponible; se ha usado su dibujo de respaldo.';
  if (copy.querySelector('[data-decoration-unavailable="true"]'))
    warnings.push(decorWarning);
  if (
    svg.dataset.photosReady !== 'true' ||
    copy.querySelector('[data-photo-unavailable="true"]')
  )
    warnings.push(
      'Una fotografía no está disponible; se ha usado la apariencia automática del libro.',
    );
  try {
    const response = await fetch('/fonts/lora.ttf', {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Font unavailable');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const style = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'style',
    );
    style.textContent = `@font-face{font-family:Lora;src:url(${data}) format('truetype');font-weight:100 900;}`;
    copy.querySelector('defs')?.append(style);
  } catch {
    warnings.push(
      'La fuente no está disponible; se ha usado la alternativa serif.',
    );
  }
  copy.querySelectorAll('[tabindex]').forEach((node) => {
    node.removeAttribute('tabindex');
    node.removeAttribute('role');
  });
  copy
    .querySelectorAll('.selected')
    .forEach((node) =>
      node
        .querySelectorAll(':scope > rect[stroke="#d5ac65"]')
        .forEach((selection) => selection.remove()),
    );
  const resources = new Map<string, Promise<string>>();
  const embed = (url: string) => {
    if (!resources.has(url))
      resources.set(
        url,
        (async () => {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) throw new Error('Image unavailable');
          const blob = await response.blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })(),
      );
    return resources.get(url)!;
  };
  await Promise.all(
    Array.from(copy.querySelectorAll('image')).map(async (image) => {
      try {
        const data = await embed(image.getAttribute('href')!);
        image.setAttribute('href', data);
      } catch {
        const decor = image.closest('[data-decor-art]');
        if (decor) {
          decor.setAttribute('viewBox', '0 0 140 200');
          decor
            .querySelector('[data-decor-fallback]')
            ?.setAttribute('display', 'inline');
          decor
            .querySelector('[data-decor-resource]')
            ?.setAttribute('display', 'none');
          warnings.push(decorWarning);
        } else {
          warnings.push(
            'Una fotografía no está disponible; se ha usado la apariencia automática del libro.',
          );
        }
        image.remove();
      }
    }),
  );
  const viewbox = svg.viewBox.baseVal;
  const maxSide = 4096;
  const ratio =
    format === 'square'
      ? 1
      : format === 'portrait'
        ? 9 / 16
        : viewbox.width / viewbox.height;
  const width = Math.round(ratio >= 1 ? maxSide : maxSide * ratio),
    height = Math.round(ratio >= 1 ? maxSide / ratio : maxSide);
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  const expandedWidth = Math.max(viewbox.width, viewbox.height * ratio),
    expandedHeight = expandedWidth / ratio;
  copy.setAttribute(
    'viewBox',
    `${viewbox.x - (expandedWidth - viewbox.width) / 2} ${viewbox.y - (expandedHeight - viewbox.height) / 2} ${expandedWidth} ${expandedHeight}`,
  );
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: 'image/svg+xml;charset=utf-8',
    }),
  );
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error('No se ha podido preparar la imagen.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se puede exportar en este navegador.');
    context.fillStyle =
      svg.querySelector('linearGradient stop')?.getAttribute('stop-color') ??
      '#eee7dc';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (data) =>
          data ? resolve(data) : reject(new Error('No se ha podido exportar.')),
        'image/png',
      ),
    );
    const download = URL.createObjectURL(blob),
      anchor = document.createElement('a');
    anchor.href = download;
    anchor.download = `${filename}.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(download), 1000);
    return [...new Set(warnings)].join(' ');
  } finally {
    URL.revokeObjectURL(url);
  }
}
