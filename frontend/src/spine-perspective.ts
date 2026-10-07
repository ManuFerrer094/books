import type { CropHandle, CropRect, ImageSize } from './spine-photo';

export interface PhotoPoint {
  x: number;
  y: number;
}
/** Clockwise, in the order of the resulting spine's corners. */
export type SpineQuad = [PhotoPoint, PhotoPoint, PhotoPoint, PhotoPoint];
export const rectQuad = (rect: CropRect): SpineQuad => [
  { x: rect.x, y: rect.y },
  { x: rect.x + rect.width, y: rect.y },
  { x: rect.x + rect.width, y: rect.y + rect.height },
  { x: rect.x, y: rect.y + rect.height },
];
export function quadBounds(quad: SpineQuad): CropRect {
  const x = Math.min(...quad.map((p) => p.x)),
    y = Math.min(...quad.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...quad.map((p) => p.x)) - x,
    height: Math.max(...quad.map((p) => p.y)) - y,
  };
}
export function validQuad(quad: SpineQuad, image: ImageSize): boolean {
  if (
    quad.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > image.width ||
        p.y > image.height,
    )
  )
    return false;
  const cross = quad.map((p, i) => {
    const q = quad[(i + 1) % 4],
      r = quad[(i + 2) % 4];
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
  });
  return (
    cross.every((n) => n > 4) &&
    quad.every(
      (p, i) =>
        Math.hypot(p.x - quad[(i + 1) % 4].x, p.y - quad[(i + 1) % 4].y) >=
        Math.min(8, image.width, image.height),
    )
  );
}
const corners: Partial<Record<CropHandle, number>> = {
  nw: 0,
  ne: 1,
  se: 2,
  sw: 3,
};
const edges: Partial<Record<CropHandle, number[]>> = {
  n: [0, 1],
  e: [1, 2],
  s: [2, 3],
  w: [3, 0],
};
export function adjustQuad(
  quad: SpineQuad,
  handle: CropHandle | 'move',
  dx: number,
  dy: number,
  image: ImageSize,
): SpineQuad {
  const indices =
    handle === 'move'
      ? [0, 1, 2, 3]
      : corners[handle] !== undefined
        ? [corners[handle]!]
        : edges[handle]!;
  dx = Math.max(
    -Math.min(...indices.map((i) => quad[i].x)),
    Math.min(dx, image.width - Math.max(...indices.map((i) => quad[i].x))),
  );
  dy = Math.max(
    -Math.min(...indices.map((i) => quad[i].y)),
    Math.min(dy, image.height - Math.max(...indices.map((i) => quad[i].y))),
  );
  const shifted = (factor: number) =>
    quad.map((p, i) =>
      indices.includes(i)
        ? { x: p.x + dx * factor, y: p.y + dy * factor }
        : { ...p },
    ) as SpineQuad;
  if (validQuad(shifted(1), image)) return shifted(1);
  // Stop at the last valid shape rather than allowing a folded or crossed crop.
  let low = 0,
    high = 1;
  for (let i = 0; i < 18; i++) {
    const middle = (low + high) / 2;
    if (validQuad(shifted(middle), image)) low = middle;
    else high = middle;
  }
  return shifted(low);
}
export function fitQuadToRect(quad: SpineQuad, rect: CropRect): SpineQuad {
  const before = quadBounds(quad);
  return quad.map((p) => ({
    x: rect.x + ((p.x - before.x) * rect.width) / before.width,
    y: rect.y + ((p.y - before.y) * rect.height) / before.height,
  })) as SpineQuad;
}
/** Remove only the edge antialiasing, without adding or padding a border. */
export function insetQuad(quad: SpineQuad, pixels: number): SpineQuad {
  const edges = quad.map((p, i) => {
    const q = quad[(i + 1) % 4],
      length = Math.hypot(q.x - p.x, q.y - p.y);
    const a = -(q.y - p.y) / length,
      b = (q.x - p.x) / length;
    return { a, b, c: a * p.x + b * p.y + pixels };
  });
  return edges.map((current, i) => {
    const previous = edges[(i + 3) % 4],
      det = previous.a * current.b - current.a * previous.b;
    return {
      x: (previous.c * current.b - current.c * previous.b) / det,
      y: (previous.a * current.c - current.a * previous.c) / det,
    };
  }) as SpineQuad;
}
/** A homography maps all four photographed corners to a full rectangular spine. */
export function quadHomography(quad: SpineQuad): number[] {
  const unit = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const rows = quad.flatMap((p, i) => {
    const [u, v] = unit[i];
    return [
      [u, v, 1, 0, 0, 0, -u * p.x, -v * p.x, p.x],
      [0, 0, 0, u, v, 1, -u * p.y, -v * p.y, p.y],
    ];
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++)
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    if (Math.abs(divisor) < 1e-10)
      throw new Error('El lomo necesita cuatro esquinas separadas.');
    for (let j = col; j <= 8; j++) rows[col][j] /= divisor;
    for (let row = 0; row < 8; row++)
      if (row !== col) {
        const multiple = rows[row][col];
        for (let j = col; j <= 8; j++) rows[row][j] -= multiple * rows[col][j];
      }
  }
  return [...rows.map((row) => row[8]), 1];
}
export function projectPhotoPoint(
  matrix: number[],
  u: number,
  v: number,
): PhotoPoint {
  const d = matrix[6] * u + matrix[7] * v + 1;
  return {
    x: (matrix[0] * u + matrix[1] * v + matrix[2]) / d,
    y: (matrix[3] * u + matrix[4] * v + matrix[5]) / d,
  };
}
export function rectifyPixels(
  source: { data: Uint8ClampedArray; width: number; height: number },
  quad: SpineQuad,
  width: number,
  height: number,
): Uint8ClampedArray {
  if (!validQuad(quad, source))
    throw new Error('Ajusta las cuatro esquinas dentro de la foto.');
  const matrix = quadHomography(quad),
    output = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const point = projectPhotoPoint(
        matrix,
        (x + 0.5) / width,
        (y + 0.5) / height,
      );
      const sx = Math.max(0, Math.min(source.width - 1, point.x - 0.5)),
        sy = Math.max(0, Math.min(source.height - 1, point.y - 0.5));
      const left = Math.floor(sx),
        top = Math.floor(sy),
        right = Math.min(source.width - 1, left + 1),
        bottom = Math.min(source.height - 1, top + 1);
      const fx = sx - left,
        fy = sy - top,
        offset = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        // Composite original transparency into JPEG, with no added canvas margins.
        const pixel = (px: number, py: number) => {
          const i = (py * source.width + px) * 4,
            alpha = source.data[i + 3] / 255;
          return source.data[i + c] * alpha + 255 * (1 - alpha);
        };
        output[offset + c] =
          (pixel(left, top) * (1 - fx) + pixel(right, top) * fx) * (1 - fy) +
          (pixel(left, bottom) * (1 - fx) + pixel(right, bottom) * fx) * fy;
      }
      output[offset + 3] = 255;
    }
  return output;
}
export function drawPerspectiveSpine(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
  quad: SpineQuad,
  ratio: number,
  height = 1024,
) {
  if (!validQuad(quad, source))
    throw new Error('Ajusta las cuatro esquinas dentro de la foto.');
  canvas.height = height;
  canvas.width = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext('2d'),
    original = source.getContext('2d', { willReadFrequently: true });
  if (!context || !original)
    throw new Error('No podemos preparar la foto en este dispositivo.');
  const rect = quadBounds(quad);
  if (
    quad.every(
      (p, i) =>
        Math.abs(p.x - rectQuad(rect)[i].x) < 0.001 &&
        Math.abs(p.y - rectQuad(rect)[i].y) < 0.001,
    )
  ) {
    context.drawImage(
      source,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return;
  }
  const pixels = original.getImageData(0, 0, source.width, source.height);
  const result = context.createImageData(canvas.width, canvas.height);
  result.data.set(rectifyPixels(pixels, quad, canvas.width, canvas.height));
  context.putImageData(result, 0, 0);
}
