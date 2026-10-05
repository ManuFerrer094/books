import type { LibraryBook, SpineAppearance } from './types';

export const spineColors = [
  '#51624e',
  '#a46145',
  '#d0b783',
  '#344c58',
  '#733f45',
  '#86875c',
  '#c6926e',
  '#3e625f',
  '#716076',
  '#c6bba2',
];
export const automaticSpine: SpineAppearance = {
  color: null,
  width: null,
  height: null,
  image_path: null,
};
export function spineStyle(entry: LibraryBook) {
  const id = Math.abs(entry.book_id);
  return {
    color: entry.spine?.color ?? spineColors[id % spineColors.length],
    width:
      entry.spine?.width ??
      Math.round(
        Math.max(28, Math.min(64, 26 + (entry.book.pages ?? 220) / 18)),
      ),
    height: entry.spine?.height ?? 176 + (id % 5) * 12,
  };
}
export function orderedBooks(books: LibraryBook[], order: number[]) {
  const remaining = new Map(books.map((book) => [book.book_id, book]));
  const result: LibraryBook[] = [];
  for (const id of order) {
    const entry = remaining.get(id);
    if (entry) {
      result.push(entry);
      remaining.delete(id);
    }
  }
  return [
    ...result,
    ...[...remaining.values()].sort(
      (a, b) =>
        Date.parse(a.added_at) - Date.parse(b.added_at) ||
        a.book_id - b.book_id,
    ),
  ];
}
export function bookshelfRows(books: LibraryBook[], width: number) {
  const rows: LibraryBook[][] = [[]];
  let used = 0;
  for (const book of books) {
    const size = spineStyle(book).width + 4;
    if (used + size > width && rows[rows.length - 1].length) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(book);
    used += size;
  }
  return rows;
}
export function moveBook(order: number[], id: number, before: number | null) {
  if (
    !order.includes(id) ||
    before === id ||
    (before !== null && !order.includes(before))
  )
    return order;
  const next = order.filter((item) => item !== id);
  next.splice(before === null ? next.length : next.indexOf(before), 0, id);
  return next;
}
export function textColor(color: string) {
  const rgb = [1, 3, 5]
    .map((start) => parseInt(color.slice(start, start + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.35
    ? '#28261f'
    : '#fff9ed';
}
