import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { GoogleBooksService } from './google-books.service.js';

describe('GoogleBooksService', () => {
  const service = new GoogleBooksService(
    new ConfigService({ GOOGLE_BOOKS_API_KEY: 'test-key' }),
  );
  let fetchMock: ReturnType<typeof jest.spyOn<typeof globalThis, 'fetch'>>;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  const info = {
    title: ' Book ',
    authors: [' Author ', 'Author'],
    publisher: 'Publisher',
    publishedDate: '2020-02-29',
    pageCount: 200,
    language: 'es',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780140328721' }],
    imageLinks: { thumbnail: 'http://books.google.com/image' },
  };
  const respond = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
  it('normalizes an exact ISBN result', async () => {
    respond({ items: [{ volumeInfo: info }] });
    await expect(service.findByIsbn('9780140328721')).resolves.toEqual({
      title: 'Book',
      isbn: '9780140328721',
      authors: [{ name: 'Author' }],
      publisher: 'Publisher',
      publication_date: '2020-02-29',
      pages: 200,
      language: 'es',
      cover_url: 'https://books.google.com/image',
    });
    expect((fetchMock.mock.calls[0][0] as URL).searchParams.get('key')).toBe(
      'test-key',
    );
  });
  it('accepts a matching ISBN-10 equivalent', async () => {
    respond({
      items: [
        {
          volumeInfo: {
            ...info,
            industryIdentifiers: [
              { type: 'ISBN_10', identifier: '0140328726' },
            ],
          },
        },
      ],
    });
    await expect(service.findByIsbn('9780140328721')).resolves.toMatchObject({
      title: 'Book',
    });
  });
  it('never imports a different edition or an unverified result', async () => {
    respond({
      items: [
        {
          volumeInfo: {
            ...info,
            industryIdentifiers: [
              { type: 'ISBN_13', identifier: '9788484454892' },
            ],
          },
        },
        { volumeInfo: { title: 'Other' } },
      ],
    });
    await expect(service.findByIsbn('9780140328721')).resolves.toBeNull();
  });
  it('skips Google when no key is configured', async () => {
    await expect(
      new GoogleBooksService(
        new ConfigService({ GOOGLE_BOOKS_API_KEY: '' }),
      ).findByIsbn('9780140328721'),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('returns null for an empty search', async () => {
    respond({ totalItems: 0 });
    await expect(service.findByIsbn('9780140328721')).resolves.toBeNull();
  });
  it.each([429, 403, 500])(
    'maps HTTP %s to availability failure without leaking the key',
    async (status) => {
      respond({ error: { message: 'Private detail' } }, status);
      await expect(service.findByIsbn('9780140328721')).rejects.toThrow(
        'Google Books unavailable',
      );
    },
  );
  it.each([{}, null, { items: 'invalid' }])(
    'rejects malformed data %j',
    async (body) => {
      respond(body);
      await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
  it('handles network timeout', async () => {
    fetchMock.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
