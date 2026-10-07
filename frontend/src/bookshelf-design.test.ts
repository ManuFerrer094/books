import { describe, expect, it } from 'vitest';
import {
  applyPreset,
  arrangeBooks,
  bookItem,
  canPlace,
  cloneDesign,
  decorItem,
  dropItem,
  decorations,
  designOrder,
  emptyDesign,
  migrateDesign,
  placeItem,
  placedIds,
  presets,
  reconcileDesign,
  refreshBookSizes,
  sceneGeometry,
  validateDesign,
  stableJson,
} from '../../src/library/bookshelf-design';

const books = Array.from({ length: 500 }, (_, i) => ({
  book_id: i + 1,
  book: { pages: 240, title: `Historia ${i + 1}` },
}));
describe('persistent bookshelf geometry', () => {
  it('compares jsonb snapshots independently of object key order', () => {
    const original = migrateDesign(books.slice(0, 2));
    const reverseKeys = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reverseKeys)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, entry]) => [key, reverseKeys(entry)]),
            )
          : value;
    expect(JSON.stringify(reverseKeys(original))).not.toBe(
      JSON.stringify(original),
    );
    expect(stableJson(reverseKeys(original))).toBe(stableJson(original));
  });
  it('migrates 500 books without changing order, with deterministic identifiers and no overlap', () => {
    const design = migrateDesign(books);
    expect(placedIds(design)).toEqual(books.map((b) => b.book_id));
    expect(migrateDesign(books)).toEqual(design);
    expect(() =>
      validateDesign(
        design,
        books.map((b) => b.book_id),
      ),
    ).not.toThrow();
    expect(sceneGeometry(design)).toEqual(sceneGeometry(cloneDesign(design)));
  });
  it.each(presets.map((preset) => [preset.id]))(
    'builds a complete valid %s composition',
    (id) => {
      const design = applyPreset(books, id);
      expect(placedIds(design)).toHaveLength(500);
      expect(design.items.filter((item) => item.kind === 'decor')).toHaveLength(
        3,
      );
      expect(() =>
        validateDesign(
          design,
          books.map((b) => b.book_id),
        ),
      ).not.toThrow();
    },
  );
  it('has more than 24 own decorations', () =>
    expect(decorations.length).toBeGreaterThanOrEqual(24));
  it('keeps assisted and legacy order when books have different heights and decorations leave small gaps', () => {
    const design = emptyDesign();
    design.bookcases[0].shelves[0].height = 190;
    const decorated = placeItem(
      design,
      decorItem('vase'),
      design.bookcases[0].shelves[0].id,
      60,
    )!;
    const sorted = arrangeBooks(
      decorated,
      [
        { book_id: 1, spine: { width: 64, height: 224 } },
        { book_id: 2, spine: { width: 28, height: 176 } },
      ],
      true,
    );
    expect(placedIds(sorted)).toEqual([1, 2]);
    expect(sorted.items.find((item) => item.kind === 'decor')).toEqual(
      decorated.items[0],
    );
    expect(() => validateDesign(sorted, [1, 2])).not.toThrow();
  });
  it('rejects collision, shelf overflow, excessive height and unknown shelves', () => {
    const design = migrateDesign(books.slice(0, 2));
    const item = { ...decorItem('fern'), id: 'new' },
      shelf = design.bookcases[0].shelves[0].id;
    expect(canPlace(design, item, shelf, 8)).toBe(false);
    expect(canPlace(design, item, shelf, 940)).toBe(false);
    expect(canPlace(design, { ...item, height: 400 }, shelf, 300)).toBe(false);
    expect(canPlace(design, item, 'missing', 300)).toBe(false);
    expect(placeItem(design, item, shelf, 300)).not.toBeNull();
  });
  it('inserts a book in an occupied row without moving decorations or overlapping neighbors', () => {
    const original = placeItem(
      migrateDesign(books.slice(0, 5)),
      decorItem('vase'),
    )!;
    const moving = original.items.find((item) => item.book_ids[0] === 5)!;
    const first = original.items.find((item) => item.book_ids[0] === 1)!;
    const next = dropItem(original, moving, first.shelf_id, first.x)!;
    expect(placedIds(next)).toEqual([5, 1, 2, 3, 4]);
    expect(next.items.find((item) => item.kind === 'decor')).toEqual(
      original.items.find((item) => item.kind === 'decor'),
    );
    expect(() => validateDesign(next, [1, 2, 3, 4, 5])).not.toThrow();
  });
  it('keeps decorations in place during assisted arrangement and leaves new books unplaced', () => {
    const original = placeItem(
      migrateDesign(books.slice(0, 8)),
      decorItem('vase'),
    )!;
    const decor = original.items.find((item) => item.kind === 'decor');
    const result = arrangeBooks(original, books.slice(0, 8).reverse());
    expect(result.items.find((item) => item.kind === 'decor')).toEqual(decor);
    expect(placedIds(result)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    expect(
      designOrder(reconcileDesign(result, [1, 2, 3, 9]), [1, 2, 3, 9]),
    ).toEqual([3, 2, 1, 9]);
  });
  it('supports an explicit stack and reconciles books removed from it', () => {
    const design = emptyDesign();
    const item = {
      ...bookItem(books[0]),
      kind: 'stack' as const,
      book_ids: [1, 2],
      width: 200,
      height: 80,
    };
    const next = placeItem(design, item)!;
    expect(() => validateDesign(next, [1, 2])).not.toThrow();
    const reduced = reconcileDesign(next, [2, 3]);
    expect(() => validateDesign(reduced, [2, 3])).not.toThrow();
    expect(designOrder(reduced, [2, 3])).toEqual([2, 3]);
  });
  it('updates photographed spine dimensions while preserving a valid composition', () => {
    const original = migrateDesign(books.slice(0, 3));
    const changed = books.slice(0, 3).map((book, i) => ({
      ...book,
      spine: { width: i === 0 ? 64 : 40, height: 220 },
    }));
    const next = refreshBookSizes(original, changed);
    expect(next.items.find((item) => item.book_ids[0] === 1)?.width).toBe(64);
    expect(() => validateDesign(next, [1, 2, 3])).not.toThrow();
    expect(original.items[0].width).toBeLessThan(64);
  });
  it('rejects duplicate books, invalid asset references, malformed values and forged membership', () => {
    for (const alter of [
      (d: ReturnType<typeof emptyDesign>) => {
        d.items[1].book_ids = [1];
      },
      (d: ReturnType<typeof emptyDesign>) => {
        d.items[0].book_ids = [999];
      },
      (d: ReturnType<typeof emptyDesign>) => {
        d.items[0].scale = NaN;
      },
      (d: ReturnType<typeof emptyDesign>) => {
        d.items[0].shelf_id = 'missing';
      },
    ]) {
      const design = migrateDesign(books.slice(0, 2));
      alter(design);
      expect(() => validateDesign(design, [1, 2])).toThrow();
    }
    const bad = placeItem(emptyDesign(), {
      ...decorItem('fern'),
      asset: 'https://untrusted.example/image',
    })!;
    expect(() => validateDesign(bad, [])).toThrow();
  });
});
