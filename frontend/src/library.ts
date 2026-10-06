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
      sort === 'title'
        ? a.book.title.localeCompare(b.book.title, 'es')
        : sort === 'author'
          ? (a.book.authors?.[0]?.name || '').localeCompare(
              b.book.authors?.[0]?.name || '',
              'es',
            )
          : Date.parse(b.added_at) - Date.parse(a.added_at),
    );
}
