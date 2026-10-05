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
export function drawSpinePhoto(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  ratio: number,
  zoom: number,
  x: number,
  y: number,
) {
  canvas.height = 1024;
  canvas.width = Math.round(1024 * ratio);
  const crop = cropGeometry(
    image.naturalWidth,
    image.naturalHeight,
    ratio,
    zoom,
    x,
    y,
  );
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
