import type { LibraryBook } from './types';

export function searchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}
export function visibleBooks(
  books: LibraryBook[],
  shelf: string,
  query: string,
  sort: string,
) {
  const term = searchText(query.trim());
  return books
    .filter(
      (entry) =>
        (shelf === 'all' ||
          (shelf === 'lent' ? entry.is_lent : entry.status === shelf)) &&
        searchText(
          `${entry.book.title} ${entry.book.authors?.map((author) => author.name).join(' ') || ''} ${entry.book.isbn || ''}`,
        ).includes(term),
    )
    .sort((a, b) =>
      sort === 'rating-desc' || sort === 'rating-asc'
        ? a.rating == null && b.rating != null
          ? 1
          : a.rating != null && b.rating == null
            ? -1
            : ((a.rating ?? 0) - (b.rating ?? 0)) *
                (sort === 'rating-desc' ? -1 : 1) ||
              a.book.title.localeCompare(b.book.title, 'es') ||
              a.book_id - b.book_id
        : sort === 'title'
          ? a.book.title.localeCompare(b.book.title, 'es')
          : sort === 'author'
            ? (a.book.authors?.[0]?.name || '').localeCompare(
                b.book.authors?.[0]?.name || '',
                'es',
              )
            : Date.parse(b.added_at) - Date.parse(a.added_at),
    );
}
