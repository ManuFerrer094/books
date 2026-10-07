import { describe, expect, it } from 'vitest';
import {
  adjustQuad,
  fitQuadToRect,
  projectPhotoPoint,
  quadBounds,
  quadHomography,
  rectQuad,
  rectifyPixels,
  validQuad,
  type SpineQuad,
} from './spine-perspective';
import { detectSpines } from './spine-detection';

function photograph(quads: SpineQuad[], noise = false) {
  const width = 360,
    height = 512,
    data = new Uint8ClampedArray(width * height * 4);
  let seed = 42;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const selected = quads.findIndex((quad) =>
        quad.every((p, j) => {
          const q = quad[(j + 1) % 4];
          return (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x) >= 0;
        }),
      );
      const colors =
        selected < 0
          ? [35 + Math.floor(y / 80), 43, 48]
          : selected === 0
            ? [171, 59, 71]
            : [92, 150, 83];
      for (let c = 0; c < 3; c++) {
        seed = (1664525 * seed + 1013904223) >>> 0;
        data[i + c] = noise ? seed >>> 24 : colors[c];
      }
      data[i + 3] = 255;
      // Lettering across the center must not replace the long outside borders.
      if (selected >= 0 && y > 110 && y < 405 && y % 31 < 5) {
        const bounds = quadBounds(quads[selected]);
        if (x > bounds.x + 22 && x < bounds.x + bounds.width - 18)
          data.set([238, 224, 192, 255], i);
      }
    }
  return { data, width, height };
}

describe('lomo completo con perspectiva y detección local', () => {
  const quad: SpineQuad = [
    { x: 140, y: 40 },
    { x: 203, y: 49 },
    { x: 229, y: 474 },
    { x: 143, y: 465 },
  ];
  it('maps all four corners and interior points without a bounding-box margin', () => {
    const matrix = quadHomography(quad);
    for (const [i, u, v] of [
      [0, 0, 0],
      [1, 1, 0],
      [2, 1, 1],
      [3, 0, 1],
    ]) {
      const p = projectPhotoPoint(matrix, u, v);
      expect(p.x).toBeCloseTo(quad[i].x);
      expect(p.y).toBeCloseTo(quad[i].y);
    }
    expect(validQuad(quad, { width: 360, height: 512 })).toBe(true);
  });
  it('allows independent corners and edges, without crossing them or leaving the photo', () => {
    const moved = adjustQuad(quad, 'nw', 12, 8, { width: 360, height: 512 });
    expect(moved[0]).toEqual({ x: 152, y: 48 });
    expect(moved.slice(1)).toEqual(quad.slice(1));
    const closed = adjustQuad(quad, 'nw', 10000, 10000, {
      width: 360,
      height: 512,
    });
    expect(validQuad(closed, { width: 360, height: 512 })).toBe(true);
    const edge = adjustQuad(quad, 's', 0, -30, { width: 360, height: 512 });
    expect(edge[2].y).toBe(444);
    expect(edge[3].y).toBe(435);
  });
  it('fills every output pixel with the selected spine and excludes the surrounding wall', () => {
    const image = photograph([quad]);
    const inset = fitQuadToRect(quad, {
      ...quadBounds(quad),
      x: 142,
      y: 42,
      width: 84,
      height: 430,
    });
    const result = rectifyPixels(image, inset, 60, 320);
    for (const [x, y] of [
      [0, 0],
      [59, 0],
      [0, 319],
      [59, 319],
      [30, 310],
    ]) {
      expect([...result.slice((y * 60 + x) * 4, (y * 60 + x) * 4 + 4)]).toEqual(
        [171, 59, 71, 255],
      );
    }
  });
  it('uses the entire selection even when its proportions differ from the book', () => {
    const image = {
      width: 20,
      height: 40,
      data: new Uint8ClampedArray(20 * 40 * 4),
    };
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 20; x++)
        image.data.set(
          [x < 5 ? 230 : 20, y < 10 ? 180 : 40, 80, 255],
          (y * 20 + x) * 4,
        );
    const result = rectifyPixels(
      image,
      rectQuad({ x: 0, y: 0, width: 20, height: 40 }),
      10,
      100,
    );
    expect([...result.slice(0, 4)]).toEqual([230, 180, 80, 255]);
    expect([...result.slice(-4)]).toEqual([20, 40, 80, 255]);
  });
  it('detects a photographed spine in perspective despite its lettering', () => {
    const choices = detectSpines(photograph([quad]));
    expect(choices.length).toBeGreaterThan(0);
    const detected = choices[0].quad;
    for (let i = 0; i < 4; i++)
      expect(
        Math.hypot(detected[i].x - quad[i].x, detected[i].y - quad[i].y),
      ).toBeLessThan(13);
  });
  it('offers separate candidates for adjacent books', () => {
    const first = rectQuad({ x: 65, y: 45, width: 62, height: 426 }),
      second = rectQuad({ x: 140, y: 55, width: 74, height: 410 });
    const choices = detectSpines(photograph([first, second]));
    for (const target of [first, second])
      expect(
        choices.some((candidate) =>
          candidate.quad.every(
            (p, i) => Math.hypot(p.x - target[i].x, p.y - target[i].y) < 13,
          ),
        ),
      ).toBe(true);
  });
  it('does not report a detection for a blank photo or random texture', () => {
    expect(detectSpines(photograph([]))).toEqual([]);
    expect(detectSpines(photograph([], true))).toEqual([]);
  });
  it('detects a sideways photographed spine and preserves a valid four-corner selection', () => {
    const original = photograph([quad]),
      width = original.height,
      height = original.width;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < original.height; y++)
      for (let x = 0; x < original.width; x++)
        data.set(
          original.data.subarray(
            (y * original.width + x) * 4,
            (y * original.width + x) * 4 + 4,
          ),
          (x * width + original.height - 1 - y) * 4,
        );
    const choices = detectSpines({ data, width, height });
    expect(choices.length).toBeGreaterThan(0);
    expect(validQuad(choices[0].quad, { width, height })).toBe(true);
    const selected = quadBounds(choices[0].quad);
    expect(selected.width).toBeGreaterThan(400);
    expect(selected.height).toBeLessThan(110);
  });
});
