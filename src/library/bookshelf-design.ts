/** Shared, dependency-free scene model and geometry used by the API and editor. */
import {
  validAtmosphere,
  type BookshelfAtmosphere,
} from './bookshelf-atmosphere.js';
export const materials = ['oak', 'walnut', 'birch', 'white', 'black'] as const;
export type Material = (typeof materials)[number];
export type BookMode = 'upright' | 'lean' | 'cover';
export const furnitureStyles = [
  'classic',
  'arch',
  'gilded',
  'industrial',
  'floating',
] as const;
export const shelfLightTypes = [
  'strip',
  'spots',
  'globes',
  'fairy',
  'neon',
  'none',
] as const;
export type FurnitureStyle = (typeof furnitureStyles)[number];
export type ShelfLightType = (typeof shelfLightTypes)[number];
export interface DesignBook {
  book_id: number;
  status?: string;
  spine?: {
    width?: number | null;
    height?: number | null;
    color?: string | null;
  } | null;
  book?: {
    title?: string;
    pages?: number | null;
    authors?: { name: string }[];
  };
}
export interface Shelf {
  id: string;
  height: number;
  light: {
    color: string;
    intensity: number;
    garland: boolean;
    type?: ShelfLightType;
    enabled?: boolean;
  };
}
export interface Bookcase {
  style?: FurnitureStyle;
  lights_on?: boolean;
  id: string;
  name: string;
  width: number;
  material: Material;
  shelves: Shelf[];
}
export interface SceneItem {
  active?: boolean;
  artwork?: number;
  id: string;
  kind: 'book' | 'stack' | 'decor';
  shelf_id: string;
  x: number;
  width: number;
  height: number;
  book_ids: number[];
  mode: BookMode;
  asset: string;
  color: string;
  scale: number;
  rotation: number;
}
export interface BookshelfDesign {
  version: 1;
  background: 'plain' | 'wall' | 'wallpaper';
  background_color: string;
  night: boolean;
  bookcases: Bookcase[];
  items: SceneItem[];
  atmosphere?: BookshelfAtmosphere;
}
export const decorations = [
  ['fern', 'Helecho', 'plant'],
  ['monstera', 'Planta tropical', 'plant'],
  ['ivy', 'Planta de interior', 'plant'],
  ['cactus', 'Suculenta', 'plant'],
  ['flowers', 'Flores silvestres', 'plant'],
  ['bonsai', 'Bonsái', 'plant'],
  ['pot', 'Maceta terracota', 'pot'],
  ['ceramic-pot', 'Maceta cerámica', 'pot'],
  ['vase', 'Jarrón alto', 'vase'],
  ['round-vase', 'Jarrón redondo', 'vase'],
  ['candle', 'Vela', 'candle'],
  ['candles', 'Tres velas', 'candle'],
  ['lamp', 'Lámpara de lectura', 'lamp'],
  ['lantern', 'Farol', 'lamp'],
  ['portrait', 'Marco pequeño', 'frame'],
  ['landscape', 'Marco de paisaje', 'frame'],
  ['cat', 'Gato de cerámica', 'figure'],
  ['bird', 'Pájaro', 'figure'],
  ['moon', 'Luna', 'figure'],
  ['star', 'Estrella', 'figure'],
  ['arch', 'Sujetalibros arco', 'bookend'],
  ['mountain', 'Sujetalibros montaña', 'bookend'],
  ['divider', 'Separador dorado', 'divider'],
  ['label', 'Separador con etiqueta', 'divider'],
  ['clock', 'Reloj', 'clock'],
  ['mug', 'Taza de té', 'mug'],
  ['crystal', 'Cristal', 'figure'],
] as const;
export const presets = [
  {
    id: 'classic',
    name: 'Biblioteca clásica',
    material: 'walnut',
    color: '#e8dfce',
    night: false,
    assets: ['arch', 'portrait', 'vase'],
  },
  {
    id: 'warm',
    name: 'Rincón cálido',
    material: 'oak',
    color: '#eadcc8',
    night: false,
    assets: ['lamp', 'mug', 'candles'],
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    material: 'white',
    color: '#e9e9e4',
    night: false,
    assets: ['round-vase', 'arch', 'ceramic-pot'],
  },
  {
    id: 'botanical',
    name: 'Botánico',
    material: 'birch',
    color: '#dbe3d4',
    night: false,
    assets: ['fern', 'monstera', 'ivy'],
  },
  {
    id: 'night',
    name: 'Nocturno',
    material: 'black',
    color: '#222c36',
    night: true,
    assets: ['lantern', 'moon', 'clock'],
  },
  {
    id: 'fantasy',
    name: 'Fantasía',
    material: 'walnut',
    color: '#ded6e8',
    night: false,
    assets: ['crystal', 'star', 'flowers'],
  },
] as const;
export const cloneDesign = (design: BookshelfDesign): BookshelfDesign =>
  structuredClone(design);
/** PostgreSQL jsonb can return object keys in a different order. */
export function stableJson(value: unknown): string {
  return (
    JSON.stringify(value, (_, entry) =>
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(
            Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)),
          )
        : entry,
    ) ?? ''
  );
}
let sequence = 0;
export const sceneId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export function newShelf(id = sceneId('shelf')): Shelf {
  return {
    id,
    height: 280,
    light: { color: '#ffd69b', intensity: 0.25, garland: false },
  };
}
export function newBookcase(): Bookcase {
  return {
    id: sceneId('case'),
    name: 'Mi estantería',
    width: 960,
    material: 'oak',
    shelves: [newShelf(), newShelf(), newShelf()],
  };
}
export function emptyDesign(): BookshelfDesign {
  return {
    version: 1,
    background: 'wall',
    background_color: '#eee7dc',
    night: false,
    bookcases: [newBookcase()],
    items: [],
  };
}
export function bookDimensions(book: DesignBook) {
  return {
    width:
      book.spine?.width ??
      Math.round(
        Math.max(28, Math.min(64, 26 + (book.book?.pages ?? 220) / 18)),
      ),
    height: book.spine?.height ?? 176 + (Math.abs(book.book_id) % 5) * 12,
  };
}
export function bookItem(
  book: DesignBook,
  mode: BookMode = 'upright',
): SceneItem {
  const size = bookDimensions(book);
  return {
    id: sceneId('book'),
    kind: 'book',
    shelf_id: '',
    x: 0,
    width:
      mode === 'cover'
        ? Math.round((size.height * 2) / 3)
        : size.width + (mode === 'lean' ? Math.ceil(size.height * 0.14) : 0),
    height: size.height,
    book_ids: [book.book_id],
    mode,
    asset: '',
    color: '#8c9a75',
    scale: 1,
    rotation: 0,
  };
}
/** A logical book slot, independent of zoom and screen size. */
export function decorationUnit(books: DesignBook[]): number {
  const widths = books
    .map((book) => bookDimensions(book).width)
    .sort((a, b) => a - b);
  return widths.length ? widths[Math.floor(widths.length / 2)] : 40;
}
export function decorationSpan(item: SceneItem, unit = 40): 1 | 2 | 3 {
  return Math.max(
    1,
    Math.min(3, Math.ceil((item.width * item.scale) / unit)),
  ) as 1 | 2 | 3;
}
export function resizeDecoration(
  item: SceneItem,
  span: 1 | 2 | 3,
  unit = 40,
): SceneItem {
  const width = unit * span;
  return {
    ...item,
    width,
    height: Math.min(240, Math.round((width * 200) / 140)),
    scale: 1,
  };
}
export function decorItem(
  asset: string,
  span?: 1 | 2 | 3,
  unit = 40,
): SceneItem {
  const category = decorations.find((entry) => entry[0] === asset)?.[2];
  return resizeDecoration(
    {
      id: sceneId('decor'),
      kind: 'decor',
      shelf_id: '',
      x: 0,
      width: 0,
      height: 0,
      book_ids: [],
      mode: 'upright',
      asset,
      color: category === 'plant' ? '#72865b' : '#b18a60',
      scale: 1,
      rotation: 0,
    },
    span ?? (category === 'divider' || category === 'candle' ? 1 : 2),
    unit,
  );
}
export const itemSize = (item: SceneItem) => ({
  width: item.width * item.scale,
  height: item.height * item.scale,
});
export function shelfEntries(design: BookshelfDesign) {
  return design.bookcases.flatMap((bookcase) =>
    bookcase.shelves.map((shelf) => ({ shelf, bookcase })),
  );
}
export function canPlace(
  design: BookshelfDesign,
  item: SceneItem,
  shelfId: string,
  x: number,
) {
  const entry = shelfEntries(design).find(({ shelf }) => shelf.id === shelfId);
  const size = itemSize(item);
  return (
    !!entry &&
    Number.isFinite(x) &&
    x >= 8 &&
    x + size.width <= entry.bookcase.width - 8 &&
    size.height <= entry.shelf.height - 16 &&
    !design.items.some(
      (other) =>
        other.id !== item.id &&
        other.shelf_id === shelfId &&
        x < other.x + itemSize(other).width + 4 &&
        x + size.width + 4 > other.x,
    )
  );
}
export function firstSpace(
  design: BookshelfDesign,
  item: SceneItem,
  shelfId: string,
  minimumX = 8,
) {
  const entry = shelfEntries(design).find(({ shelf }) => shelf.id === shelfId);
  const size = itemSize(item);
  if (!entry || size.height > entry.shelf.height - 16) return null;
  const others = design.items
    .filter((other) => other.id !== item.id && other.shelf_id === shelfId)
    .sort((a, b) => a.x - b.x);
  let x = Math.max(8, minimumX);
  for (const other of others) {
    if (x + size.width + 4 <= other.x) return x;
    x = Math.max(x, other.x + itemSize(other).width + 4);
  }
  return x + size.width <= entry.bookcase.width - 8 ? x : null;
}
export function placeItem(
  design: BookshelfDesign,
  item: SceneItem,
  preferred?: string,
  desiredX?: number,
): BookshelfDesign | null {
  const entries = shelfEntries(design);
  const candidates = preferred
    ? entries.filter(({ shelf }) => shelf.id === preferred)
    : entries;
  for (const { shelf } of candidates) {
    const x =
      desiredX === undefined
        ? firstSpace(design, item, shelf.id)
        : Math.round(desiredX / 4) * 4;
    if (x !== null && canPlace(design, item, shelf.id, x)) {
      const next = cloneDesign(design);
      next.items = next.items.filter((other) => other.id !== item.id);
      next.items.push({ ...item, shelf_id: shelf.id, x });
      return next;
    }
  }
  return null;
}
export function placedIds(design: BookshelfDesign): number[] {
  return shelfEntries(design).flatMap(({ shelf }) =>
    design.items
      .filter((item) => item.shelf_id === shelf.id)
      .sort((a, b) => a.x - b.x)
      .flatMap((item) => item.book_ids),
  );
}
function insertionCenter(
  design: BookshelfDesign,
  item: SceneItem,
  shelfId: string,
  x: number,
) {
  const previous = design.items.find(
    (other) =>
      other.id === item.id && other.shelf_id === shelfId && other.x === x,
  );
  // Resizing keeps an item between its existing neighbors, even for narrow spines.
  return x + itemSize(previous ?? item).width / 2;
}
/** Make room for an inserted item, carrying whole books/piles to following shelves. */
function flowAroundItem(
  design: BookshelfDesign,
  item: SceneItem,
  shelfId: string,
  desiredX: number,
): BookshelfDesign | null {
  const shelves = shelfEntries(design);
  const index = shelves.findIndex(({ shelf }) => shelf.id === shelfId);
  const entry = shelves[index],
    size = itemSize(item);
  if (
    !entry ||
    !Number.isFinite(desiredX) ||
    size.height > entry.shelf.height - 16
  )
    return null;
  const center = insertionCenter(design, item, shelfId, desiredX);
  let start = 8,
    end = entry.bookcase.width - 8;
  for (const obstacle of design.items.filter(
    (other) =>
      other.id !== item.id &&
      other.kind === 'decor' &&
      other.shelf_id === shelfId,
  )) {
    const right = obstacle.x + itemSize(obstacle).width;
    if (center >= obstacle.x && center <= right) return null;
    if (right < center) start = Math.max(start, right + 4);
    if (obstacle.x > center) end = Math.min(end, obstacle.x - 4);
  }
  if (size.width > end - start) return null;
  const row = design.items
    .filter(
      (other) =>
        other.id !== item.id &&
        other.kind !== 'decor' &&
        other.shelf_id === shelfId,
    )
    .sort((a, b) => a.x - b.x);
  const insertion = row.findIndex(
    (other) => center <= other.x + itemSize(other).width / 2,
  );
  const prefix = row.slice(0, insertion < 0 ? row.length : insertion);
  let carry = row.slice(prefix.length);
  const maximumX = end - size.width;
  while (
    prefix.length &&
    prefix.at(-1)!.x + itemSize(prefix.at(-1)!).width + 4 > maximumX
  )
    carry.unshift(prefix.pop()!);
  const anchor = Math.max(
    start,
    Math.min(desiredX, maximumX),
    prefix.length
      ? prefix.at(-1)!.x + itemSize(prefix.at(-1)!).width + 4
      : start,
  );
  const next = cloneDesign(design);
  const displaced = new Set(carry.map((other) => other.id));
  next.items = next.items.filter(
    (other) => other.id !== item.id && !displaced.has(other.id),
  );
  if (!canPlace(next, item, shelfId, anchor)) return null;
  next.items.push({ ...item, shelf_id: shelfId, x: anchor });
  for (let target = index; target < shelves.length && carry.length; target++) {
    const shelf = shelves[target].shelf;
    if (target > index) {
      const residents = next.items
        .filter(
          (other) => other.kind !== 'decor' && other.shelf_id === shelf.id,
        )
        .sort((a, b) => a.x - b.x);
      const residentIds = new Set(residents.map((other) => other.id));
      next.items = next.items.filter((other) => !residentIds.has(other.id));
      carry = [...carry, ...residents];
    }
    let minimumX = target === index ? anchor + size.width + 4 : 8;
    let placed = 0;
    for (const book of carry) {
      const x = firstSpace(next, book, shelf.id, minimumX);
      if (x === null) break;
      next.items.push({ ...book, shelf_id: shelf.id, x });
      minimumX = x + itemSize(book).width + 4;
      placed++;
    }
    carry = carry.slice(placed);
  }
  return carry.length ? null : next;
}
/** Insert amongst books; keep other decorations fixed and spill excess books safely. */
export function dropItem(
  design: BookshelfDesign,
  item: SceneItem,
  shelfId: string,
  desiredX: number,
): BookshelfDesign | null {
  const direct = placeItem(design, item, shelfId, desiredX);
  if (direct) return direct;
  if (item.kind === 'decor')
    return flowAroundItem(design, item, shelfId, desiredX);
  const entry = shelfEntries(design).find(({ shelf }) => shelf.id === shelfId);
  if (!entry || itemSize(item).height > entry.shelf.height - 16) return null;
  const center = insertionCenter(design, item, shelfId, desiredX);
  let start = 8,
    end = entry.bookcase.width - 8;
  for (const obstacle of design.items.filter(
    (other) => other.kind === 'decor' && other.shelf_id === shelfId,
  )) {
    const right = obstacle.x + itemSize(obstacle).width;
    if (center >= obstacle.x && center <= right) return null;
    if (right < center) start = Math.max(start, right + 4);
    if (obstacle.x > center) end = Math.min(end, obstacle.x - 4);
  }
  const lane = design.items
    .filter(
      (other) =>
        other.id !== item.id &&
        other.kind !== 'decor' &&
        other.shelf_id === shelfId &&
        other.x >= start &&
        other.x + itemSize(other).width <= end,
    )
    .sort((a, b) => a.x - b.x);
  const before = lane.findIndex(
    (other) => center <= other.x + itemSize(other).width / 2,
  );
  const entries = [...lane];
  entries.splice(before < 0 ? entries.length : before, 0, item);
  const total =
    entries.reduce((sum, other) => sum + itemSize(other).width, 0) +
    (entries.length - 1) * 4;
  if (total > end - start)
    return flowAroundItem(design, item, shelfId, desiredX);
  const next = cloneDesign(design),
    movingIds = new Set(entries.map((other) => other.id));
  next.items = next.items.filter((other) => !movingIds.has(other.id));
  let x = Math.max(start, Math.min(lane[0]?.x ?? desiredX, end - total));
  for (const other of entries) {
    next.items.push({ ...other, shelf_id: shelfId, x });
    x += itemSize(other).width + 4;
  }
  return next;
}
export function designOrder(design: BookshelfDesign, libraryIds: number[]) {
  const ids = placedIds(design),
    placed = new Set(ids);
  return [...ids, ...libraryIds.filter((id) => !placed.has(id))];
}
export function reconcileDesign(design: BookshelfDesign, libraryIds: number[]) {
  const allowed = new Set(libraryIds),
    next = cloneDesign(design);
  next.items = next.items
    .map((item) => ({
      ...item,
      book_ids: item.book_ids.filter((id) => allowed.has(id)),
    }))
    .filter((item) => item.kind === 'decor' || item.book_ids.length > 0);
  return next;
}
export function refreshBookSizes(design: BookshelfDesign, books: DesignBook[]) {
  let next = reconcileDesign(
    design,
    books.map((book) => book.book_id),
  );
  const byId = new Map(books.map((book) => [book.book_id, book]));
  const maximumDecorWidth = decorationUnit(books) * 3;
  for (const item of next.items) {
    if (item.kind === 'decor') {
      const size = itemSize(item);
      if (size.width > maximumDecorWidth || size.height > 240) {
        const ratio = Math.min(
          1,
          maximumDecorWidth / size.width,
          240 / size.height,
        );
        next.items = next.items.map((other) =>
          other.id === item.id
            ? {
                ...item,
                width: size.width * ratio,
                height: size.height * ratio,
                scale: 1,
              }
            : other,
        );
      }
      continue;
    }
    const entries = item.book_ids.map((id) => byId.get(id)!).filter(Boolean);
    const dimensions =
      item.kind === 'stack'
        ? {
            width: Math.max(
              ...entries.map((book) => bookDimensions(book).height),
            ),
            height: entries.reduce(
              (sum, book) => sum + bookDimensions(book).width,
              0,
            ),
          }
        : bookItem(entries[0], item.mode);
    if (item.width === dimensions.width && item.height === dimensions.height)
      continue;
    const updated = {
      ...item,
      width: dimensions.width,
      height: dimensions.height,
    };
    const moved =
      placeItem(next, updated, item.shelf_id, item.x) ??
      placeItem(next, updated, item.shelf_id) ??
      placeItem(next, updated);
    if (moved) next = moved;
    else next.items = next.items.filter((entry) => entry.id !== item.id);
  }
  return next;
}
export function arrangeBooks(
  design: BookshelfDesign,
  books: DesignBook[],
  grow = false,
): BookshelfDesign {
  const next = cloneDesign(design);
  const moving = new Set(books.map((book) => book.book_id));
  next.items = next.items
    .map((item) => ({
      ...item,
      book_ids: item.book_ids.filter((id) => !moving.has(id)),
    }))
    .filter((item) => item.kind === 'decor' || item.book_ids.length > 0);
  const available = shelfEntries(next);
  let cursor = 0,
    cursorX = 8;
  for (const book of books) {
    const item = bookItem(book);
    let location: { shelf_id: string; x: number } | null = null;
    for (let index = cursor; index < available.length; index++) {
      const { shelf } = available[index];
      const x = firstSpace(
        next,
        item,
        shelf.id,
        index === cursor ? cursorX : 8,
      );
      if (x !== null) {
        location = { shelf_id: shelf.id, x };
        cursor = index;
        cursorX = x + itemSize(item).width + 4;
        break;
      }
    }
    if (!location && grow) {
      let bookcase = next.bookcases.at(-1)!;
      if (bookcase.shelves.length >= 100 && next.bookcases.length < 20) {
        bookcase = { ...newBookcase(), shelves: [] };
        next.bookcases.push(bookcase);
      }
      if (bookcase.shelves.length < 100) {
        const shelf = newShelf();
        bookcase.shelves.push(shelf);
        available.push({ shelf, bookcase });
        const x = firstSpace(next, item, shelf.id);
        if (x !== null) {
          location = { shelf_id: shelf.id, x };
          cursor = available.length - 1;
          cursorX = x + itemSize(item).width + 4;
        }
      }
    }
    if (location) next.items.push({ ...item, ...location });
  }
  return next;
}
export function migrateDesign(books: DesignBook[]): BookshelfDesign {
  const next = arrangeBooks(emptyDesign(), books, true);
  next.bookcases.forEach((bookcase, index) => {
    bookcase.id = `migrated-case-${index}`;
    bookcase.shelves.forEach((shelf, shelfIndex) => {
      const previous = shelf.id;
      shelf.id = `migrated-shelf-${index}-${shelfIndex}`;
      next.items.forEach((item) => {
        if (item.shelf_id === previous) item.shelf_id = shelf.id;
      });
    });
  });
  next.items.forEach((item) => {
    item.id = `migrated-book-${item.book_ids[0]}`;
  });
  return next;
}
export function applyPreset(books: DesignBook[], id: string): BookshelfDesign {
  const preset = presets.find((entry) => entry.id === id) ?? presets[0];
  let next = emptyDesign();
  next.bookcases[0].material = preset.material;
  next.bookcases[0].style = (
    {
      classic: 'classic',
      warm: 'arch',
      minimal: 'floating',
      botanical: 'classic',
      night: 'industrial',
      fantasy: 'gilded',
    } as Record<string, FurnitureStyle>
  )[preset.id];
  next.background_color = preset.color;
  next.background = preset.id === 'fantasy' ? 'wallpaper' : 'wall';
  next.night = preset.night;
  next.bookcases[0].shelves.forEach((shelf, i) => {
    shelf.light.intensity = preset.night
      ? 0.75
      : preset.id === 'minimal'
        ? 0
        : 0.3;
    shelf.light.garland = preset.id === 'fantasy' || preset.id === 'warm';
    shelf.light.type =
      preset.id === 'fantasy'
        ? 'fairy'
        : preset.id === 'night'
          ? 'spots'
          : preset.id === 'warm'
            ? 'globes'
            : 'strip';
    const item = decorItem(preset.assets[i], undefined, decorationUnit(books));
    next =
      placeItem(
        next,
        item,
        shelf.id,
        next.bookcases[0].width - item.width - 24,
      ) ?? next;
  });
  return arrangeBooks(next, books, true);
}
export interface ShelfGeometry {
  shelf: Shelf;
  bookcase: Bookcase;
  x: number;
  y: number;
  bottom: number;
}
export function sceneGeometry(design: BookshelfDesign) {
  let x = 42,
    maxHeight = 0;
  const shelves: ShelfGeometry[] = [];
  const cases = design.bookcases.map((bookcase) => {
    let y = 96;
    for (const shelf of bookcase.shelves) {
      shelves.push({ shelf, bookcase, x: x + 24, y, bottom: y + shelf.height });
      y += shelf.height + 24;
    }
    const geometry = {
      bookcase,
      x,
      y: 72,
      width: bookcase.width + 48,
      height: y - 72 + 24,
    };
    x += geometry.width + 42;
    maxHeight = Math.max(maxHeight, y + 64);
    return geometry;
  });
  return { cases, shelves, width: x, height: Math.max(500, maxHeight) };
}
/** Reject malformed, oversized and overlapping scenes before they reach storage. */
export function validateDesign(
  value: unknown,
  libraryIds: number[],
): asserts value is BookshelfDesign {
  const record = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const number = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const color = (v: unknown) =>
    typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  const ids = new Set<string>();
  const id = (v: unknown) =>
    typeof v === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(v) &&
    !ids.has(v) &&
    !!ids.add(v);
  const fail = (): never => {
    throw new Error('Diseño de estantería no válido.');
  };
  if (
    !record(value) ||
    value.version !== 1 ||
    !['plain', 'wall', 'wallpaper'].includes(value.background) ||
    !color(value.background_color) ||
    typeof value.night !== 'boolean' ||
    !Array.isArray(value.bookcases) ||
    value.bookcases.length < 1 ||
    value.bookcases.length > 20 ||
    !Array.isArray(value.items) ||
    value.items.length > 5000
  )
    fail();
  const design = value as BookshelfDesign;
  if (design.atmosphere !== undefined && !validAtmosphere(design.atmosphere))
    fail();
  for (const c of design.bookcases) {
    if (
      !record(c) ||
      !id(c.id) ||
      typeof c.name !== 'string' ||
      c.name.length < 1 ||
      c.name.length > 80 ||
      !materials.includes(c.material) ||
      (c.style !== undefined && !furnitureStyles.includes(c.style)) ||
      (c.lights_on !== undefined && typeof c.lights_on !== 'boolean') ||
      !number(c.width, 320, 1600) ||
      !Array.isArray(c.shelves) ||
      c.shelves.length < 1 ||
      c.shelves.length > 100
    )
      fail();
    for (const s of c.shelves)
      if (
        !record(s) ||
        !id(s.id) ||
        !number(s.height, 160, 600) ||
        !record(s.light) ||
        !color(s.light.color) ||
        !number(s.light.intensity, 0, 1) ||
        typeof s.light.garland !== 'boolean' ||
        (s.light.type !== undefined &&
          !shelfLightTypes.includes(s.light.type)) ||
        (s.light.enabled !== undefined && typeof s.light.enabled !== 'boolean')
      )
        fail();
  }
  const used = new Set<number>(),
    allowed = new Set(libraryIds);
  for (const item of design.items) {
    if (
      !record(item) ||
      (item.active !== undefined &&
        (item.kind !== 'decor' || typeof item.active !== 'boolean')) ||
      (item.artwork !== undefined &&
        (item.kind !== 'decor' ||
          !['portrait', 'landscape'].includes(item.asset) ||
          !Number.isInteger(item.artwork) ||
          !number(item.artwork, 0, 3))) ||
      !id(item.id) ||
      !['book', 'stack', 'decor'].includes(item.kind) ||
      !['upright', 'lean', 'cover'].includes(item.mode) ||
      !number(item.width, 8, 1200) ||
      !number(item.height, 8, 580) ||
      !number(item.x, 8, 1600) ||
      !number(item.scale, 0.5, 1.5) ||
      !number(item.rotation, -20, 20) ||
      !color(item.color) ||
      typeof item.asset !== 'string' ||
      !Array.isArray(item.book_ids)
    )
      fail();
    if (
      item.kind === 'decor'
        ? item.book_ids.length !== 0 ||
          !decorations.some((a) => a[0] === item.asset)
        : item.kind === 'book'
          ? item.book_ids.length !== 1
          : item.book_ids.length < 1 || item.book_ids.length > 12
    )
      fail();
    for (const book of item.book_ids) {
      if (!Number.isInteger(book) || !allowed.has(book) || used.has(book))
        fail();
      used.add(book);
    }
    if (!canPlace(design, item, item.shelf_id, item.x)) fail();
  }
}
