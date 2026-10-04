import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { InventaireService } from './inventaire.service';

describe('InventaireService', () => {
  let fetchMock: ReturnType<typeof jest.spyOn<typeof globalThis, 'fetch'>>;
  const service = new InventaireService();
  const edition = {
    type: 'edition',
    claims: {
      'wdt:P212': ['978-0-14-032872-1'],
      'wdt:P1476': ['Book'],
      'wdt:P629': ['wd:Q1'],
      'wdt:P123': ['wd:Q3'],
      'wdt:P407': ['wd:Q1321'],
      'wdt:P577': ['2020-02-29'],
      'wdt:P1104': [200],
    },
    image: { url: '/img/entities/abc' },
  };
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  const respond = (entities: unknown) =>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ entities })));
  it('resolves edition, work authors and publisher without creating remote data', async () => {
    respond({ 'inv:abc': edition });
    respond({ 'wd:Q1': { claims: { 'wdt:P50': ['wd:Q2'] } } });
    respond({
      'wd:Q2': { labels: { en: 'Author' } },
      'wd:Q3': { labels: { es: 'Publisher' } },
    });
    await expect(service.findByIsbn('9780140328721')).resolves.toEqual({
      isbn: '9780140328721',
      title: 'Book',
      authors: [{ name: 'Author' }],
      publisher: 'Publisher',
      publication_date: '2020-02-29',
      language: 'es',
      pages: 200,
      cover_url: 'https://inventaire.io/img/entities/abc',
    });
    fetchMock.mock.calls.forEach(([url]) =>
      expect((url as URL).searchParams.get('autocreate')).toBe('false'),
    );
  });
  it('rejects an edition whose claims do not match the ISBN', async () => {
    respond({
      edition: {
        ...edition,
        claims: { ...edition.claims, 'wdt:P212': ['9788484454892'] },
      },
    });
    await expect(service.findByIsbn('9780140328721')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('returns null when absent', async () => {
    respond({});
    await expect(service.findByIsbn('9780140328721')).resolves.toBeNull();
  });
  it('does not infer edition language from originalLang', async () => {
    respond({
      edition: {
        type: 'edition',
        originalLang: 'en',
        claims: { 'wdt:P212': ['9780140328721'], 'wdt:P1476': ['Book'] },
      },
    });
    await expect(service.findByIsbn('9780140328721')).resolves.toMatchObject({
      language: null,
    });
  });
  it('reports invalid API responses', async () => {
    fetchMock.mockResolvedValue(new Response('{}'));
    await expect(service.findByIsbn('9780140328721')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
