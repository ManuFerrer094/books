/** Shared, dependency-free scene model and geometry used by the API and editor. */
export const materials = ['oak', 'walnut', 'birch', 'white', 'black'] as const;
export type Material = (typeof materials)[number];
export type BookMode = 'upright' | 'lean' | 'cover';
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
  light: { color: string; intensity: number; garland: boolean };
}
export interface Bookcase {
  id: string;
  name: string;
  width: number;
  material: Material;
  shelves: Shelf[];
}
export interface SceneItem {
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
}
export const decorations = [
  ['fern', 'Helecho', 'plant'],
  ['monstera', 'Monstera', 'plant'],
  ['ivy', 'Hiedra', 'plant'],
  ['cactus', 'Cactus', 'plant'],
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
export function decorItem(asset: string): SceneItem {
  const category = decorations.find((entry) => entry[0] === asset)?.[2];
  return {
    id: sceneId('decor'),
    kind: 'decor',
    shelf_id: '',
    x: 0,
    width: category === 'divider' ? 28 : category === 'plant' ? 130 : 90,
    height: category === 'plant' ? 190 : category === 'lamp' ? 175 : 125,
    book_ids: [],
    mode: 'upright',
    asset,
    color: category === 'plant' ? '#72865b' : '#b18a60',
    scale: 1,
    rotation: 0,
  };
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
/** Insert amongst books within a lane bounded by fixed decorations. */
export function dropItem(
  design: BookshelfDesign,
  item: SceneItem,
  shelfId: string,
  desiredX: number,
): BookshelfDesign | null {
  const direct = placeItem(design, item, shelfId, desiredX);
  if (direct || item.kind === 'decor') return direct;
  const entry = shelfEntries(design).find(({ shelf }) => shelf.id === shelfId);
  if (!entry || itemSize(item).height > entry.shelf.height - 16) return null;
  const center = desiredX + itemSize(item).width / 2;
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
  if (total > end - start) return null;
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
  for (const item of next.items) {
    if (item.kind === 'decor') continue;
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
    const item = decorItem(preset.assets[i]);
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
  for (const c of design.bookcases) {
    if (
      !record(c) ||
      !id(c.id) ||
      typeof c.name !== 'string' ||
      c.name.length < 1 ||
      c.name.length > 80 ||
      !materials.includes(c.material) ||
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
        typeof s.light.garland !== 'boolean'
      )
        fail();
  }
  const used = new Set<number>(),
    allowed = new Set(libraryIds);
  for (const item of design.items) {
    if (
      !record(item) ||
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
