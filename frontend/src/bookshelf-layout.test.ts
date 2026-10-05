import { describe, expect, it } from 'vitest';
import {
  bookshelfRows,
  moveBook,
  orderedBooks,
  spineStyle,
  textColor,
} from './bookshelf-layout';
import { cropGeometry, validateSpineFile } from './spine-photo';
import type { LibraryBook } from './types';

function book(id: number, width = 40): LibraryBook {
  return {
    book_id: id,
    status: 'pending',
    added_at: `2026-01-0${id}`,
    updated_at: '',
    spine: { color: null, height: null, width, image_path: null },
    book: {
      id,
      title: `Libro ${id}`,
      authors: [],
      isbn: null,
      publisher: null,
      publication_date: null,
      pages: null,
      language: null,
      cover_url: null,
    },
  };
}
describe('estantería personal', () => {
  it('conserva el orden, descarta libros retirados y duplicados y añade los nuevos al final', () => {
    const books = [book(3), book(1), book(2)];
    expect(
      orderedBooks(books, [2, 99, 2]).map((entry) => entry.book_id),
    ).toEqual([2, 1, 3]);
    expect(books.map((entry) => entry.book_id)).toEqual([3, 1, 2]);
  });
  it('crea baldas según los grosores reales sin alterar el orden al cambiar de ancho', () => {
    const books = [book(1, 28), book(2, 64), book(3, 40)];
    expect(
      bookshelfRows(books, 100).map((row) => row.map((entry) => entry.book_id)),
    ).toEqual([[1, 2], [3]]);
    expect(
      bookshelfRows(books, 70).map((row) => row.map((entry) => entry.book_id)),
    ).toEqual([[1], [2], [3]]);
    expect(bookshelfRows(books, 200).flat()).toEqual(books);
    expect(bookshelfRows([], 100)).toEqual([[]]);
  });
  it('mueve libros antes de otro o al final, también entre baldas', () => {
    expect(moveBook([1, 2, 3, 4], 1, 4)).toEqual([2, 3, 1, 4]);
    expect(moveBook([1, 2, 3, 4], 4, 1)).toEqual([4, 1, 2, 3]);
    expect(moveBook([1, 2, 3], 1, null)).toEqual([2, 3, 1]);
    expect(moveBook([1, 2], 1, 99)).toEqual([1, 2]);
  });
  it('limita las dimensiones automáticas y elige texto legible sobre colores claros y oscuros', () => {
    const entry = book(1);
    entry.spine = null;
    entry.book.pages = 2000;
    expect(spineStyle(entry).width).toBe(64);
    entry.book.pages = 1;
    expect(spineStyle(entry).width).toBe(28);
    entry.book.pages = null;
    expect(spineStyle(entry)).toEqual(spineStyle(entry));
    expect(textColor('#ffffff')).toBe('#28261f');
    expect(textColor('#000000')).toBe('#fff9ed');
  });
});
describe('fotos de lomos', () => {
  it('valida tipo, tamaño y archivos vacíos', () => {
    expect(() =>
      validateSpineFile({ type: 'image/webp', size: 5242880 }),
    ).not.toThrow();
    expect(() =>
      validateSpineFile({ type: 'image/jpeg', size: 5242881 }),
    ).toThrow('5 MB');
    expect(() =>
      validateSpineFile({ type: 'image/svg+xml', size: 30 }),
    ).toThrow('JPEG');
    expect(() => validateSpineFile({ type: 'image/png', size: 0 })).toThrow(
      'vacía',
    );
  });
  it.each([
    [1200, 800],
    [800, 1200],
    [100, 3000],
  ])('recorta sin salir de la imagen %i × %i', (w, h) => {
    for (const zoom of [1, 2, 4])
      for (const x of [-1, 0, 1])
        for (const y of [-1, 0, 1]) {
          const crop = cropGeometry(w, h, 40 / 200, zoom, x, y);
          expect(crop.x).toBeGreaterThanOrEqual(0);
          expect(crop.y).toBeGreaterThanOrEqual(0);
          expect(crop.x + crop.width).toBeLessThanOrEqual(w + 0.0001);
          expect(crop.y + crop.height).toBeLessThanOrEqual(h + 0.0001);
          expect(crop.width / crop.height).toBeCloseTo(0.2);
        }
  });
});
