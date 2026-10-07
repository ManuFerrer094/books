import type { LibraryBook } from './types';
import { spineStyle } from './bookshelf-layout';

function colorPosition(color: string) {
  const [r, g, b] = [1, 3, 5].map(
    (offset) => parseInt(color.slice(offset, offset + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let hue =
    delta === 0
      ? 360
      : max === r
        ? ((g - b) / delta) * 60
        : max === g
          ? ((b - r) / delta) * 60 + 120
          : ((r - g) / delta) * 60 + 240;
  if (hue < 0) hue += 360;
  return hue * 1000 + (max + min) / 2;
}
export function sortSceneBooks(books: LibraryBook[], by: string) {
  const statuses = { pending: 0, reading: 1, read: 2 };
  return [...books].sort((a, b) => {
    const difference =
      by === 'color'
        ? colorPosition(spineStyle(a).color) -
          colorPosition(spineStyle(b).color)
        : by === 'status'
          ? statuses[a.status] - statuses[b.status]
          : by === 'author'
            ? (
                a.book.authors.map((author) => author.name).join(' ') ||
                '\uffff'
              ).localeCompare(
                b.book.authors.map((author) => author.name).join(' ') ||
                  '\uffff',
                'es',
              )
            : a.book.title.localeCompare(b.book.title, 'es');
    return (
      difference ||
      a.book.title.localeCompare(b.book.title, 'es') ||
      a.book_id - b.book_id
    );
  });
}
