import { expect, it } from 'vitest';
import { sortSceneBooks } from './bookshelf-organize';
import type { LibraryBook } from './types';
const books = [
  {
    book_id: 1,
    status: 'read',
    spine: { color: '#0000ff' },
    book: { title: 'Azul', authors: [{ name: 'Zeta' }] },
  },
  {
    book_id: 2,
    status: 'pending',
    spine: { color: '#ff0000' },
    book: { title: 'Rojo', authors: [{ name: 'Alfa' }] },
  },
  {
    book_id: 3,
    status: 'reading',
    spine: { color: '#00ff00' },
    book: { title: 'Verde', authors: [] },
  },
] as LibraryBook[];
it('orders colors by hue and reading states in their reading sequence', () => {
  expect(sortSceneBooks(books, 'color').map((book) => book.book_id)).toEqual([
    2, 3, 1,
  ]);
  expect(sortSceneBooks(books, 'status').map((book) => book.book_id)).toEqual([
    2, 3, 1,
  ]);
  expect(sortSceneBooks(books, 'author').map((book) => book.book_id)).toEqual([
    2, 1, 3,
  ]);
  expect(books.map((book) => book.book_id)).toEqual([1, 2, 3]);
});
