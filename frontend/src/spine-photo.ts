export const MAX_SPINE_FILE_SIZE = 5 * 1024 * 1024;
export function validateSpineFile(file: Pick<File, 'type' | 'size'>) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Elige una foto JPEG, PNG o WebP.');
  if (file.size > MAX_SPINE_FILE_SIZE)
    throw new Error('La foto debe ocupar como máximo 5 MB.');
  if (!file.size) throw new Error('La foto está vacía. Elige otra imagen.');
}
export function cropGeometry(
  imageWidth: number,
  imageHeight: number,
  ratio: number,
  zoom: number,
  x: number,
  y: number,
) {
  const cropWidth = Math.min(imageWidth, imageHeight * ratio) / zoom;
  const cropHeight = cropWidth / ratio;
  return {
    x: ((imageWidth - cropWidth) * (x + 1)) / 2,
    y: ((imageHeight - cropHeight) * (y + 1)) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ImageSize {
  width: number;
  height: number;
}
export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const limit = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function clampCrop(crop: CropRect, image: ImageSize): CropRect {
  const width = limit(crop.width, Math.min(8, image.width), image.width);
  const height = limit(crop.height, Math.min(8, image.height), image.height);
  return {
    width,
    height,
    x: limit(crop.x, 0, image.width - width),
    y: limit(crop.y, 0, image.height - height),
  };
}
export function initialCrop(image: ImageSize, ratio: number): CropRect {
  return clampCrop(
    cropGeometry(image.width, image.height, ratio, 1, 0, 0),
    image,
  );
}
export function moveCrop(
  crop: CropRect,
  dx: number,
  dy: number,
  image: ImageSize,
): CropRect {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, image);
}
export function resizeCrop(
  crop: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  image: ImageSize,
): CropRect {
  let left = crop.x,
    top = crop.y,
    right = left + crop.width,
    bottom = top + crop.height;
  const minWidth = Math.min(8, image.width),
    minHeight = Math.min(8, image.height);
  if (handle.includes('w')) left = limit(left + dx, 0, right - minWidth);
  if (handle.includes('e'))
    right = limit(right + dx, left + minWidth, image.width);
  if (handle.includes('n')) top = limit(top + dy, 0, bottom - minHeight);
  if (handle.includes('s'))
    bottom = limit(bottom + dy, top + minHeight, image.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function zoomCrop(
  crop: CropRect,
  factor: number,
  image: ImageSize,
): CropRect {
  const width = crop.width / factor,
    height = crop.height / factor;
  return clampCrop(
    {
      width,
      height,
      x: crop.x + (crop.width - width) / 2,
      y: crop.y + (crop.height - height) / 2,
    },
    image,
  );
}
export function fitImage(image: ImageSize, width: number, height: number) {
  const scale = Math.min(width / image.width, height / image.height);
  return {
    scale,
    width: image.width * scale,
    height: image.height * scale,
    left: (width - image.width * scale) / 2,
    top: (height - image.height * scale) / 2,
  };
}
export function rotatedImageSize(
  width: number,
  height: number,
  degrees: number,
) {
  const angle = (degrees * Math.PI) / 180;
  return {
    width: Math.max(
      1,
      Math.round(
        Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)),
      ),
    ),
    height: Math.max(
      1,
      Math.round(
        Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle)),
      ),
    ),
  };
}
export function prepareSpineImage(image: HTMLImageElement, degrees: number) {
  // Keep camera photos manageable while retaining enough detail for a 1024px spine.
  const scale = Math.min(
    1,
    4096 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.round(image.naturalWidth * scale),
    height = Math.round(image.naturalHeight * scale);
  const size = rotatedImageSize(width, height, degrees);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('No podemos preparar la foto en este dispositivo.');
  context.fillStyle = '#f3eedf';
  context.fillRect(0, 0, size.width, size.height);
  context.translate(size.width / 2, size.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  return canvas;
}
export function drawSpineSelection(
  canvas: HTMLCanvasElement,
  image: HTMLCanvasElement,
  crop: CropRect,
  ratio: number,
) {
  canvas.height = 1024;
  canvas.width = Math.round(1024 * ratio);
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('No podemos preparar la foto en este dispositivo.');
  context.fillStyle = '#f3eedf';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}
export function spinePhotoBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else
          reject(
            new Error('No podemos preparar la foto. Prueba con otra imagen.'),
          );
      },
      'image/jpeg',
      0.9,
    ),
  );
}
