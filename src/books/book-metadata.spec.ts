import { normalizeLanguage, normalizePublicationDate } from './book-metadata.js';

describe('Publication date normalization', () => {
  it.each([
    ['2012-09-15', '2012-09-15'],
    ['2012-9-5', '2012-09-05'],
    ['September 15, 2012', '2012-09-15'],
    ['15 Sep. 2012', '2012-09-15'],
    ['15 de septiembre de 2012', '2012-09-15'],
    ['Feb 29, 2020', '2020-02-29'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePublicationDate(input)).toBe(expected);
  });
  it.each([
    '2012',
    'September 2012',
    '2012-09',
    '2023-02-29',
    'April 31, 2012',
    '00 Jan 2012',
    '01/02/2012',
    'garbage',
    null,
    2012,
  ])('rejects partial, ambiguous or invalid date %s', (input) => {
    expect(normalizePublicationDate(input)).toBeNull();
  });
});

describe('Edition language normalization', () => {
  it.each([
    ['spa', 'es'],
    ['eng', 'en'],
    ['fre', 'fr'],
    ['deu', 'de'],
    ['cat', 'ca'],
    ['swe', 'swe'],
  ])('normalizes %s', (code, expected) => {
    expect(normalizeLanguage([{ key: `/languages/${code}` }])).toBe(expected);
  });
  it('uses the first valid language because the schema has one field', () => {
    expect(
      normalizeLanguage([
        null,
        {},
        { key: '/languages/spa' },
        { key: '/languages/eng' },
      ]),
    ).toBe('es');
  });
  it.each([null, [], [{ key: '/languages/not-a-language' }]])(
    'returns null for missing languages %j',
    (value) => {
      expect(normalizeLanguage(value)).toBeNull();
    },
  );
});
