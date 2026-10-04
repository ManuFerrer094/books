import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { OpenLibraryService } from './open-library.service';

describe('OpenLibraryService', () => {
  const service = new OpenLibraryService();
  let fetchMock: ReturnType<typeof jest.spyOn<typeof globalThis, 'fetch'>>;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  function respond(body: unknown, status = 200) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status }),
    );
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
  }
  it('normalizes metadata and deduplicates author names without writing', async () => {
    respond({
      'ISBN:9780140328721': {
        title: ' Matilda ',
        authors: [{ name: ' Roald Dahl ' }, { name: 'Roald Dahl' }],
        publishers: [{ name: 'Puffin' }],
        number_of_pages: 240,
        publish_date: '1988-10-01',
        cover: { large: 'http://covers.openlibrary.org/test.jpg' },
      },
    });
    await expect(service.findByIsbn('9780140328721')).resolves.toEqual({
      title: 'Matilda',
      isbn: '9780140328721',
      authors: [{ name: 'Roald Dahl' }],
      publisher: 'Puffin',
      pages: 240,
      publication_date: '1988-10-01',
      cover_url: 'https://covers.openlibrary.org/test.jpg',
      language: null,
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('bibkeys=ISBN%3A9780140328721');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
  it('returns null when the provider has no match', async () => {
    respond({});
    await expect(service.findByIsbn('9780140328721')).resolves.toBeNull();
  });
  it.each(['1988', 'October 1988', '2023-02-29'])(
    'does not invent or accept an invalid full date from %s',
    async (publish_date) => {
      respond({
        'ISBN:9780140328721': {
          title: 'Book',
          publish_date,
          number_of_pages: -1,
        },
      });
      await expect(service.findByIsbn('9780140328721')).resolves.toMatchObject({
        publication_date: null,
        pages: null,
        authors: [],
      });
    },
  );
  it.each([429, 500, 404])('maps provider HTTP %s to 503', async (status) => {
    respond({}, status);
    await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it.each([null, [], { 'ISBN:9780140328721': {} }])(
    'rejects malformed payload %j',
    async (body) => {
      respond(body);
      await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
  it('maps network and timeout errors to 503', async () => {
    fetchMock.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    await expect(service.findByIsbn('9780140328721')).rejects.toThrow(
      'Book provider unavailable',
    );
  });
  it('maps invalid JSON to 503', async () => {
    fetchMock.mockResolvedValue(new Response('not json'));
    await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('enriches the preview with normalized edition language and date', async () => {
    respond({ 'ISBN:9780140328721': { title: 'Book', publish_date: '2012' } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          languages: [{ key: '/languages/spa' }],
          publish_date: 'September 15, 2012',
        }),
      ),
    );
    await expect(service.findByIsbn('9780140328721')).resolves.toMatchObject({
      language: 'es',
      publication_date: '2012-09-15',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://openlibrary.org/isbn/9780140328721.json',
    );
  });
  it.each([429, 500])(
    'does not silently import on edition HTTP failure %s',
    async (status) => {
      respond({ 'ISBN:9780140328721': { title: 'Book' } });
      fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
      await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
  it('rejects a malformed edition response', async () => {
    respond({ 'ISBN:9780140328721': { title: 'Book' } });
    fetchMock.mockResolvedValueOnce(new Response('null'));
    await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
