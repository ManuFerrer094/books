export function normalizeIsbn(value: string): string | null {
  const isbn = value.replace(/[\s-]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(isbn)) {
    return [...isbn].reduce(
      (sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1),
      0,
    ) %
      10 ===
      0
      ? isbn
      : null;
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    return [...isbn].reduce(
      (sum, digit, i) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - i),
      0,
    ) %
      11 ===
      0
      ? isbn
      : null;
  }
  return null;
}
