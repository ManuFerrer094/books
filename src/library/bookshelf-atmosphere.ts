/** Portable atmosphere settings. Playback permission and session timers are never saved. */
export const soundLayers = [
  ['rain', 'Lluvia', 'Gotas sobre la ventana', 'nature'],
  ['fire', 'Chimenea', 'Leña, brasas y pequeños crujidos', 'comfort'],
  ['wind', 'Viento', 'Aire suave entre los árboles', 'nature'],
  ['birds', 'Pájaros', 'Cantos espaciados en el jardín', 'nature'],
  ['pages', 'Páginas', 'Papel que se pasa despacio', 'library'],
  ['steps', 'Pasos', 'Alguien entre las estanterías', 'library'],
  ['clock', 'Reloj', 'El pulso de una sala tranquila', 'library'],
  ['cafe', 'Café', 'Murmullo lejano y porcelana', 'library'],
  ['water', 'Fuente', 'Agua que cae y se desliza', 'nature'],
  ['ocean', 'Mar', 'Olas que llegan a la orilla', 'nature'],
  ['thunder', 'Truenos', 'Tormenta lejana, sin sobresaltos', 'nature'],
  ['night', 'Noche', 'Grillos en un patio abierto', 'nature'],
  ['vinyl', 'Vinilo', 'Una textura cálida y nostálgica', 'comfort'],
  ['dream', 'Ensoñación', 'Un acorde lento y suspendido', 'comfort'],
] as const;
export type SoundLayer = (typeof soundLayers)[number][0];
export const atmosphereIds = [
  'custom',
  'rain-room',
  'fireside',
  'midnight',
  'garden',
  'cafe',
  'silence',
  'enchanted',
  'coast',
  'storm',
  'timeless',
] as const;
export const backdropIds = ['none', 'rain', 'snow', 'leaves', 'stars'] as const;
export interface BookshelfAtmosphere {
  version: 1;
  scene: (typeof atmosphereIds)[number];
  lighting: {
    enabled: boolean;
    color: string;
    ambient: number;
    beam: number;
    angle: number;
    glow: number;
    vignette: number;
    dust: boolean;
    motion: boolean;
    backdrop: (typeof backdropIds)[number];
  };
  sound: { master: number; width: number; layers: Record<SoundLayer, number> };
}
export function silentLayers(): Record<SoundLayer, number> {
  return Object.fromEntries(soundLayers.map(([id]) => [id, 0])) as Record<
    SoundLayer,
    number
  >;
}
export function defaultAtmosphere(night = false): BookshelfAtmosphere {
  return {
    version: 1,
    scene: 'custom',
    lighting: {
      enabled: false,
      color: night ? '#9abbe4' : '#ffe2b3',
      ambient: night ? 0.45 : 0.85,
      beam: 0.25,
      angle: -24,
      glow: 0.55,
      vignette: 0.24,
      dust: true,
      motion: true,
      backdrop: 'none',
    },
    sound: { master: 0.5, width: 0.7, layers: silentLayers() },
  };
}
type Scene = {
  id: Exclude<BookshelfAtmosphere['scene'], 'custom'>;
  name: string;
  subtitle: string;
  night: boolean;
  color: string;
  accent: string;
  ambient: number;
  beam: number;
  glow: number;
  backdrop: BookshelfAtmosphere['lighting']['backdrop'];
  layers: Partial<Record<SoundLayer, number>>;
};
export const atmosphereScenes: readonly Scene[] = [
  {
    id: 'rain-room',
    name: 'Tarde de lluvia',
    subtitle: 'La ventana, el papel, el mundo en pausa.',
    night: false,
    color: '#ffe0b5',
    accent: '#758b9f',
    ambient: 0.7,
    beam: 0.18,
    glow: 0.62,
    backdrop: 'rain',
    layers: { rain: 0.6, wind: 0.12, pages: 0.16 },
  },
  {
    id: 'fireside',
    name: 'Junto al fuego',
    subtitle: 'Una butaca cerca de las brasas.',
    night: true,
    color: '#ffbd76',
    accent: '#975c3b',
    ambient: 0.54,
    beam: 0.08,
    glow: 0.95,
    backdrop: 'none',
    layers: { fire: 0.58, rain: 0.14, pages: 0.14 },
  },
  {
    id: 'midnight',
    name: 'Biblioteca de medianoche',
    subtitle: 'Luz de luna y una última página.',
    night: true,
    color: '#a0c3ff',
    accent: '#364b75',
    ambient: 0.47,
    beam: 0.52,
    glow: 0.48,
    backdrop: 'stars',
    layers: { night: 0.28, clock: 0.2, pages: 0.12 },
  },
  {
    id: 'garden',
    name: 'Jardín de lectura',
    subtitle: 'Las hojas se mueven fuera.',
    night: false,
    color: '#e7edb4',
    accent: '#65815b',
    ambient: 0.96,
    beam: 0.72,
    glow: 0.25,
    backdrop: 'leaves',
    layers: { birds: 0.34, wind: 0.24, water: 0.22, pages: 0.12 },
  },
  {
    id: 'cafe',
    name: 'Café y capítulos',
    subtitle: 'Una taza caliente y tiempo para ti.',
    night: false,
    color: '#ffd6a1',
    accent: '#94725a',
    ambient: 0.82,
    beam: 0.3,
    glow: 0.55,
    backdrop: 'rain',
    layers: { cafe: 0.42, rain: 0.22, pages: 0.15, vinyl: 0.1 },
  },
  {
    id: 'silence',
    name: 'Santuario silencioso',
    subtitle: 'Solo tú y lo que estás leyendo.',
    night: false,
    color: '#eef0e5',
    accent: '#8b9986',
    ambient: 0.98,
    beam: 0.22,
    glow: 0.18,
    backdrop: 'none',
    layers: {},
  },
  {
    id: 'enchanted',
    name: 'Archivo encantado',
    subtitle: 'Historias que brillan cuando anochece.',
    night: true,
    color: '#d5acff',
    accent: '#795f95',
    ambient: 0.61,
    beam: 0.38,
    glow: 0.8,
    backdrop: 'stars',
    layers: { dream: 0.3, wind: 0.16, pages: 0.14, vinyl: 0.08 },
  },
  {
    id: 'coast',
    name: 'Lectura junto al mar',
    subtitle: 'La orilla marca el ritmo.',
    night: false,
    color: '#d6efff',
    accent: '#588d9a',
    ambient: 0.94,
    beam: 0.62,
    glow: 0.2,
    backdrop: 'none',
    layers: { ocean: 0.5, birds: 0.2, wind: 0.16, pages: 0.12 },
  },
  {
    id: 'storm',
    name: 'Noche de tormenta',
    subtitle: 'Fuera llueve. Aquí estás a salvo.',
    night: true,
    color: '#aebfe6',
    accent: '#47596b',
    ambient: 0.43,
    beam: 0.16,
    glow: 0.75,
    backdrop: 'rain',
    layers: { rain: 0.62, thunder: 0.32, wind: 0.18, fire: 0.24 },
  },
  {
    id: 'timeless',
    name: 'La sala del tiempo',
    subtitle: 'El reloj, el vinilo y ningún apuro.',
    night: false,
    color: '#ffe1b1',
    accent: '#8f795d',
    ambient: 0.78,
    beam: 0.6,
    glow: 0.6,
    backdrop: 'snow',
    layers: { clock: 0.32, vinyl: 0.3, pages: 0.18, fire: 0.2 },
  },
];
export function atmosphereForScene(
  id: string,
  master = 0.5,
): BookshelfAtmosphere {
  const scene = atmosphereScenes.find((entry) => entry.id === id);
  const result = defaultAtmosphere(scene?.night);
  if (!scene) return result;
  result.scene = scene.id;
  result.lighting = {
    ...result.lighting,
    enabled: true,
    color: scene.color,
    ambient: scene.ambient,
    beam: scene.beam,
    glow: scene.glow,
    backdrop: scene.backdrop,
    vignette: scene.night ? 0.48 : 0.2,
    dust: scene.id !== 'silence',
  };
  result.sound = {
    ...result.sound,
    master,
    layers: { ...silentLayers(), ...scene.layers },
  };
  return result;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const unit = (value: unknown) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;
export function validAtmosphere(value: unknown): value is BookshelfAtmosphere {
  if (
    !object(value) ||
    value.version !== 1 ||
    !atmosphereIds.includes(value.scene as BookshelfAtmosphere['scene']) ||
    !object(value.lighting) ||
    !object(value.sound)
  )
    return false;
  const l = value.lighting,
    s = value.sound;
  return (
    typeof l.enabled === 'boolean' &&
    typeof l.dust === 'boolean' &&
    typeof l.motion === 'boolean' &&
    typeof l.color === 'string' &&
    /^#[a-f\d]{6}$/i.test(l.color) &&
    [l.ambient, l.beam, l.glow, l.vignette, s.master, s.width].every(unit) &&
    typeof l.angle === 'number' &&
    Number.isFinite(l.angle) &&
    l.angle >= -60 &&
    l.angle <= 60 &&
    backdropIds.includes(
      l.backdrop as BookshelfAtmosphere['lighting']['backdrop'],
    ) &&
    object(s.layers) &&
    Object.keys(s.layers).length === soundLayers.length &&
    soundLayers.every(([id]) => unit((s.layers as Record<string, unknown>)[id]))
  );
}
export function readAtmosphere(
  value: unknown,
  night = false,
): BookshelfAtmosphere {
  return validAtmosphere(value) ? value : defaultAtmosphere(night);
}
