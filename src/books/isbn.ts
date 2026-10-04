import { BadRequestException } from '@nestjs/common';

/** Validate the check digit and return equivalent ISBN-13 / ISBN-10 keys. */
export function isbnKeys(input: string): string[] {
  const isbn = input.replace(/[\s-]/g, '').toUpperCase();
  const invalid = () => {
    throw new BadRequestException('Invalid ISBN');
  };
  let isbn13: string;
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce(
      (total, digit, i) =>
        total + (digit === 'X' ? 10 : Number(digit)) * (10 - i),
      0,
    );
    if (sum % 11 !== 0) invalid();
    const stem = '978' + isbn.slice(0, 9);
    const sum13 = [...stem].reduce(
      (total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1),
      0,
    );
    isbn13 = stem + ((10 - (sum13 % 10)) % 10);
  } else if (/^97[89]\d{10}$/.test(isbn)) {
    const sum = [...isbn].reduce(
      (total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1),
      0,
    );
    if (sum % 10 !== 0) invalid();
    isbn13 = isbn;
  } else {
    return invalid();
  }
  const keys = [isbn13];
  if (isbn13.startsWith('978')) {
    const stem = isbn13.slice(3, 12);
    const sum = [...stem].reduce(
      (total, digit, i) => total + Number(digit) * (10 - i),
      0,
    );
    const check = (11 - (sum % 11)) % 11;
    keys.push(stem + (check === 10 ? 'X' : check));
  }
  return [...new Set([...keys, input.trim()])];
}
