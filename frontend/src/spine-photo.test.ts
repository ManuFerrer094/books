import { describe, expect, it } from 'vitest';
import {
  clampCrop,
  fitImage,
  initialCrop,
  moveCrop,
  resizeCrop,
  rotatedImageSize,
  zoomCrop,
  type CropHandle,
} from './spine-photo';

describe('recorte interactivo de la fotografía', () => {
  const image = { width: 1000, height: 1600 };
  const crop = { x: 200, y: 300, width: 300, height: 900 };
  it('permite seleccionar un lomo más fino que la proporción de la estantería', () => {
    expect(resizeCrop(crop, 'w', 280, 0, image)).toEqual({
      x: 480,
      y: 300,
      width: 20,
      height: 900,
    });
    expect(resizeCrop(crop, 's', 0, -200, image)).toEqual({
      x: 200,
      y: 300,
      width: 300,
      height: 700,
    });
  });
  it('mantiene la esquina opuesta fija al redimensionar y permite quitar la mano del borde inferior', () => {
    expect(resizeCrop(crop, 'nw', 50, 100, image)).toEqual({
      x: 250,
      y: 400,
      width: 250,
      height: 800,
    });
    expect(resizeCrop(crop, 'se', -50, -200, image)).toEqual({
      x: 200,
      y: 300,
      width: 250,
      height: 700,
    });
  });
  it.each(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as CropHandle[])(
    'impide invertir el marco o salir de la foto con el control %s',
    (handle) => {
      for (const dx of [-10000, 10000])
        for (const dy of [-10000, 10000]) {
          const next = resizeCrop(crop, handle, dx, dy, image);
          expect(next.x).toBeGreaterThanOrEqual(0);
          expect(next.y).toBeGreaterThanOrEqual(0);
          expect(next.width).toBeGreaterThanOrEqual(8);
          expect(next.height).toBeGreaterThanOrEqual(8);
          expect(next.x + next.width).toBeLessThanOrEqual(image.width);
          expect(next.y + next.height).toBeLessThanOrEqual(image.height);
        }
    },
  );
  it('mueve el marco sin modificar su tamaño y limita el movimiento a los bordes', () => {
    expect(moveCrop(crop, 30, -20, image)).toEqual({ ...crop, x: 230, y: 280 });
    expect(moveCrop(crop, 10000, -10000, image)).toEqual({
      ...crop,
      x: 700,
      y: 0,
    });
  });
  it('amplía el recorte sobre su centro y mantiene las dimensiones válidas al alejarlo', () => {
    expect(zoomCrop(crop, 2, image)).toEqual({
      x: 275,
      y: 525,
      width: 150,
      height: 450,
    });
    expect(zoomCrop(crop, 0.1, image)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 1600,
    });
    expect(
      clampCrop({ x: -10, y: 2000, width: 0, height: 3000 }, image),
    ).toEqual({ x: 0, y: 0, width: 8, height: 1600 });
  });
  it('mapea la foto al área visible conservando su proporción y los márgenes', () => {
    expect(fitImage({ width: 300, height: 900 }, 300, 300)).toEqual({
      scale: 1 / 3,
      width: 100,
      height: 300,
      left: 100,
      top: 0,
    });
    const initial = initialCrop(image, 0.2);
    expect(initial.width / initial.height).toBeCloseTo(0.2);
    expect(initial.y).toBe(0);
  });
  it('gira fotos horizontales y calcula el lienzo necesario para enderezarlas sin cortarlas', () => {
    expect(rotatedImageSize(1200, 800, 90)).toEqual({
      width: 800,
      height: 1200,
    });
    expect(rotatedImageSize(1200, 800, 180)).toEqual({
      width: 1200,
      height: 800,
    });
    const rotated = rotatedImageSize(1200, 800, 15);
    expect(rotated.width).toBeGreaterThan(1200);
    expect(rotated.height).toBeGreaterThan(800);
  });
});
