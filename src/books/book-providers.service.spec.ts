import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { BookProvidersService } from './book-providers.service.js';
import { OpenLibraryService } from './open-library.service.js';
import { GoogleBooksService } from './google-books.service.js';
import { InventaireService } from './inventaire.service.js';
import { InternetArchiveService } from './internet-archive.service.js';

describe('BookProvidersService', () => {
  const providers = Array.from({ length: 4 }, () => ({
    findByIsbn: jest.fn<OpenLibraryService['findByIsbn']>(),
  }));
  const service = new BookProvidersService(
    providers[0] as OpenLibraryService,
    providers[1] as unknown as GoogleBooksService,
    providers[2] as unknown as InventaireService,
    providers[3] as InternetArchiveService,
  );
  const book = { title: 'Book', isbn: '9780140328721' };
  beforeEach(() => {
    jest.resetAllMocks();
    providers.forEach((p) => p.findByIsbn.mockResolvedValue(null));
  });
  it.each(['openlibrary', 'googlebooks', 'inventaire', 'internetarchive'])(
    'returns the first match from %s and skips later providers',
    async (source) => {
      const index = [
        'openlibrary',
        'googlebooks',
        'inventaire',
        'internetarchive',
      ].indexOf(source);
      providers[index].findByIsbn.mockResolvedValue(book);
      await expect(service.findByIsbn(book.isbn)).resolves.toEqual({
        source,
        book,
      });
      providers
        .slice(index + 1)
        .forEach((p) => expect(p.findByIsbn).not.toHaveBeenCalled());
    },
  );
  it('continues after a provider is unavailable', async () => {
    providers[0].findByIsbn.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    providers[1].findByIsbn.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    providers[2].findByIsbn.mockResolvedValue(book);
    await expect(service.findByIsbn(book.isbn)).resolves.toEqual({
      source: 'inventaire',
      book,
    });
  });
  it('returns null only when every enabled provider confirms absence', async () => {
    await expect(service.findByIsbn(book.isbn)).resolves.toBeNull();
    providers.forEach((p) =>
      expect(p.findByIsbn).toHaveBeenCalledWith(book.isbn),
    );
  });
  it('reports failed providers instead of pretending the book does not exist', async () => {
    providers[1].findByIsbn.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    try {
      await service.findByIsbn(book.isbn);
      throw new Error('Expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(
        (error as ServiceUnavailableException).getResponse(),
      ).toMatchObject({ unavailableProviders: ['googlebooks'] });
    }
    expect(providers[3].findByIsbn).toHaveBeenCalled();
  });
  it('does not hide unexpected programming errors', async () => {
    providers[0].findByIsbn.mockRejectedValue(new Error('Unexpected'));
    await expect(service.findByIsbn(book.isbn)).rejects.toThrow('Unexpected');
    expect(providers[1].findByIsbn).not.toHaveBeenCalled();
  });
});
