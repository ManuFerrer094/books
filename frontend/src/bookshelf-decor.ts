import catalog from './bookshelf-decor-assets.json';

interface DecorationAsset {
  src: string;
  thumbnail: string;
  mask: string;
  naturalColor: string;
  width: number;
  height: number;
}
export const decorationAssets: Record<string, DecorationAsset> = catalog;
/** Match SVG xMidYMax meet, including short, wide objects such as cups/clocks. */
export function decorationBounds(asset: string, width: number, height: number) {
  const resource = decorationAssets[asset] ?? { width: 140, height: 200 };
  const fit = Math.min(width / resource.width, height / resource.height);
  const w = resource.width * fit,
    h = resource.height * fit;
  return { x: (width - w) / 2, y: height - h, width: w, height: h };
}

/** Existing compositions used these two defaults for the hand-drawn artwork. */
export function decorationColor(asset: string, color: string) {
  const original = decorationAssets[asset]?.naturalColor ?? '#b18a60';
  return !color || ['#72865b', '#b18a60'].includes(color.toLowerCase())
    ? original
    : color;
}

/** Preserve luminance/texture; the material mask excludes the other surfaces. */
export function decorationTintMatrix(color: string, natural: string) {
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const weights = [0.2126, 0.7152, 0.0722];
  const luminance = Math.max(
    0.12,
    rgb(natural).reduce((sum, value, i) => sum + value * weights[i], 0),
  );
  return [
    ...rgb(color).flatMap((value) => [
      ...weights.map((weight) => (value * weight) / luminance),
      0,
      0,
    ]),
    0,
    0,
    0,
    1,
    0,
  ].join(' ');
}
