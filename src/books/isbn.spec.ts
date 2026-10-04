import { BadRequestException } from '@nestjs/common';
import { isbnKeys } from './isbn';

describe('ISBN validation', () => {
  it.each([
    '9780140328721',
    '0140328726',
    ' 978-0-14-032872-1 ',
    '0 14 032872 6',
  ])('recognizes equivalent ISBN %s', (input) => {
    expect(isbnKeys(input).slice(0, 2)).toEqual([
      '9780140328721',
      '0140328726',
    ]);
  });
  it('accepts lowercase X in ISBN-10', () => {
    expect(isbnKeys('080442957x').slice(0, 2)).toEqual([
      '9780804429573',
      '080442957X',
    ]);
  });
  it('does not convert 979 ISBNs to ISBN-10', () => {
    expect(isbnKeys('9791090636071')).toEqual(['9791090636071']);
  });
  it.each([
    '',
    '123',
    '9780140328722',
    '0140328727',
    '0000000000000',
    '978014032872X',
    'abcdefghij',
  ])('rejects invalid ISBN %s', (input) => {
    expect(() => isbnKeys(input)).toThrow(BadRequestException);
  });
});
