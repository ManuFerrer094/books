import { describe, expect, it } from 'vitest';
import { visibleBooks } from './library';
import type { LibraryBook } from './types';

const books: LibraryBook[] = [
  {
    book_id: 1,
    status: 'pending',
    added_at: '2026-01-01',
    updated_at: '2026-01-01',
    book: {
      id: 1,
      title: 'Árboles',
      authors: [{ id: 1, name: 'María' }],
      isbn: '9788484454892',
      publisher: null,
      pages: null,
      publication_date: null,
      cover_url: null,
      language: null,
    },
  },
  {
    book_id: 2,
    status: 'reading',
    added_at: '2026-02-01',
    updated_at: '2026-02-01',
    book: {
      id: 2,
      title: 'Bosque',
      authors: [],
      isbn: null,
      publisher: null,
      pages: null,
      publication_date: null,
      cover_url: null,
      language: null,
    },
  },
];
describe('organización de la biblioteca', () => {
  it('filtra préstamos sin perder el estado de lectura', () => {
    const lent = [{ ...books[0], is_lent: true, lent_to: 'Ana' }, books[1]];
    expect(
      visibleBooks(lent, 'lent', '', 'recent').map((b) => b.book_id),
    ).toEqual([1]);
    expect(
      visibleBooks(lent, 'pending', '', 'recent').map((b) => b.book_id),
    ).toEqual([1]);
    expect(
      visibleBooks(lent, 'reading', '', 'recent').map((b) => b.book_id),
    ).toEqual([2]);
    expect(visibleBooks(lent, 'lent', 'bosque', 'recent')).toEqual([]);
  });
  it('busca títulos y autores sin distinguir acentos ni mayúsculas', () => {
    expect(
      visibleBooks(books, 'all', '  ARBOLES ', 'recent').map((b) => b.book_id),
    ).toEqual([1]);
    expect(
      visibleBooks(books, 'all', 'maria', 'recent').map((b) => b.book_id),
    ).toEqual([1]);
    expect(
      visibleBooks(books, 'all', '9788484454892', 'recent').map(
        (b) => b.book_id,
      ),
    ).toEqual([1]);
  });
  it('filtra por estado y no muta el orden recibido de la API', () => {
    expect(
      visibleBooks(books, 'reading', '', 'recent').map((b) => b.book_id),
    ).toEqual([2]);
    expect(
      visibleBooks(books, 'all', '', 'recent').map((b) => b.book_id),
    ).toEqual([2, 1]);
    expect(
      visibleBooks(books, 'all', '', 'title').map((b) => b.book_id),
    ).toEqual([1, 2]);
    expect(books.map((b) => b.book_id)).toEqual([1, 2]);
  });
});
