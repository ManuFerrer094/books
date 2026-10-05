import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { InternetArchiveService } from './internet-archive.service.js';

describe('InternetArchiveService', () => {
  const service = new InternetArchiveService();
  let fetchMock: ReturnType<typeof jest.spyOn<typeof globalThis, 'fetch'>>;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  const respond = (docs: unknown[]) =>
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ response: { docs } })),
    );
  it('normalizes a matching catalog record', async () => {
    respond([
      {
        identifier: 'book-1',
        isbn: ['0140328726'],
        title: 'Book',
        creator: ['Author'],
        publisher: 'Publisher',
        language: ['spa'],
        date: '2020-02-29',
        number_of_pages: 100,
      },
    ]);
    await expect(service.findByIsbn('9780140328721')).resolves.toEqual({
      isbn: '9780140328721',
      title: 'Book',
      authors: [{ name: 'Author' }],
      publisher: 'Publisher',
      language: 'es',
      publication_date: '2020-02-29',
      pages: 100,
      cover_url: 'https://archive.org/services/img/book-1',
    });
  });
  it('does not accept unrelated or ISBN-less results', async () => {
    respond([
      { title: 'Different', isbn: ['9788484454892'] },
      { title: 'No ISBN' },
    ]);
    await expect(service.findByIsbn('9780140328721')).resolves.toBeNull();
  });
  it('returns null for no results', async () => {
    respond([]);
    await expect(service.findByIsbn('9780140328721')).resolves.toBeNull();
  });
  it('does not fabricate a full publication date from a year', async () => {
    respond([{ title: 'Book', isbn: '9780140328721', date: '1988' }]);
    await expect(service.findByIsbn('9780140328721')).resolves.toMatchObject({
      publication_date: null,
    });
  });
  it('reports malformed search responses', async () => {
    fetchMock.mockResolvedValue(new Response('{}'));
    await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
