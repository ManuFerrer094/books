import { describe, expect, it } from 'vitest';
import { normalizeIsbn } from './isbn';

describe('validación del ISBN', () => {
  it.each(['9788484454892', '9788410989788', '9791090636071'])(
    'acepta ISBN-13 válido %s',
    (isbn) => expect(normalizeIsbn(isbn)).toBe(isbn),
  );
  it('quita separadores y reconoce la X del ISBN-10', () =>
    expect(normalizeIsbn(' 0-8044-2957-x ')).toBe('080442957X'));
  it.each([
    '9788410989789',
    '978848445489',
    '1234567890128',
    '97884844548922',
    '0804429570',
    'hello',
    '',
  ])('rechaza un código incorrecto %s', (isbn) =>
    expect(normalizeIsbn(isbn)).toBeNull(),
  );
});
