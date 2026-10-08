import type { Bookcase, SceneItem, Shelf } from './bookshelf-design.js';

export const furnitureNames = {
  classic: 'Biblioteca de autor',
  arch: 'Arcadas de cuento',
  gilded: 'Gabinete dorado',
  industrial: 'Taller de lectura',
  floating: 'Baldas flotantes',
};
export const lightNames = {
  strip: 'Línea de luz',
  spots: 'Focos de galería',
  globes: 'Bombillas de cristal',
  fairy: 'Constelación',
  neon: 'Arco de neón',
  none: 'Sin luminaria',
};
export function shelfPowered(bookcase: Bookcase, shelf: Shelf) {
  return bookcase.lights_on !== false && shelf.light.enabled !== false;
}
export function decorAction(item: SceneItem): string | null {
  if (
    [
      'lamp',
      'lantern',
      'candle',
      'candles',
      'crystal',
      'moon',
      'star',
    ].includes(item.asset)
  )
    return item.active === false ? 'Encender' : 'Apagar';
  if (['portrait', 'landscape'].includes(item.asset))
    return 'Cambiar ilustración';
  if (item.asset === 'mug')
    return item.active ? 'Dejar enfriar' : 'Preparar una infusión';
  if (item.asset === 'clock')
    return item.active ? 'Detener el reloj' : 'Dar cuerda';
  if (
    ['fern', 'monstera', 'ivy', 'cactus', 'flowers', 'bonsai'].includes(
      item.asset,
    )
  )
    return item.active ? 'Calmar las hojas' : 'Despertar las hojas';
  if (['cat', 'bird'].includes(item.asset))
    return item.active ? 'Dormir la figura' : 'Despertar la figura';
  return null;
}
export function interactDecoration(item: SceneItem): SceneItem {
  if (!decorAction(item)) return item;
  if (['portrait', 'landscape'].includes(item.asset))
    return { ...item, artwork: ((item.artwork ?? 0) + 1) % 4 };
  const lit = [
    'lamp',
    'lantern',
    'candle',
    'candles',
    'crystal',
    'moon',
    'star',
  ].includes(item.asset);
  return { ...item, active: lit ? item.active === false : !item.active };
}
export const decorationCollections = [
  { id: 'all', name: 'Todos', assets: [] as string[] },
  {
    id: 'botanical',
    name: 'Jardín interior',
    assets: [
      'fern',
      'monstera',
      'ivy',
      'cactus',
      'flowers',
      'bonsai',
      'pot',
      'ceramic-pot',
    ],
  },
  {
    id: 'warm',
    name: 'Ritual de lectura',
    assets: [
      'lamp',
      'lantern',
      'candle',
      'candles',
      'mug',
      'clock',
      'vase',
      'round-vase',
    ],
  },
  {
    id: 'magic',
    name: 'Gabinete mágico',
    assets: ['crystal', 'moon', 'star', 'cat', 'bird', 'arch', 'mountain'],
  },
  {
    id: 'gallery',
    name: 'Pequeña galería',
    assets: ['portrait', 'landscape', 'divider', 'label', 'vase', 'round-vase'],
  },
];
