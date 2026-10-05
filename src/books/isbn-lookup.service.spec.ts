import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BooksService } from './books.service.js';
import { BookProvidersService } from './book-providers.service.js';
import { IsbnLookupService } from './isbn-lookup.service.js';

describe('IsbnLookupService', () => {
  const books = {
    findByIsbns: jest.fn<BooksService['findByIsbns']>(),
    createBook: jest.fn<BooksService['createBook']>(),
  };
  const provider = {
    findByIsbn: jest.fn<BookProvidersService['findByIsbn']>(),
  };
  const service = new IsbnLookupService(
    books as unknown as BooksService,
    provider as BookProvidersService,
  );
  beforeEach(() => jest.resetAllMocks());

  it('returns local metadata and skips the provider', async () => {
    const book = { id: 1, title: 'Local', authors: [] };
    books.findByIsbns.mockResolvedValue(book);
    await expect(service.lookup('0140328726')).resolves.toEqual({
      source: 'database',
      book,
    });
    expect(provider.findByIsbn).not.toHaveBeenCalled();
    expect(books.createBook).not.toHaveBeenCalled();
  });
  it('looks up external metadata using canonical ISBN-13', async () => {
    books.findByIsbns.mockResolvedValue(null);
    const book = { title: 'External', isbn: '9780140328721' };
    provider.findByIsbn.mockResolvedValue({ source: 'openlibrary', book });
    const saved = { ...book, id: 2, authors: [] };
    books.createBook.mockResolvedValue(saved);
    await expect(service.lookup('0140328726')).resolves.toEqual({
      source: 'openlibrary',
      book: saved,
    });
    expect(provider.findByIsbn).toHaveBeenCalledWith('9780140328721');
    expect(books.createBook).toHaveBeenCalledWith(book);
  });
  it.each(['googlebooks', 'inventaire', 'internetarchive'] as const)(
    'saves metadata from %s with the canonical ISBN and returns its source',
    async (source) => {
      books.findByIsbns.mockResolvedValue(null);
      const book = {
        title: 'External',
        authors: [{ name: 'Author' }],
        language: 'es',
        publication_date: '2020-02-29',
      };
      provider.findByIsbn.mockResolvedValue({ source, book });
      const saved = {
        ...book,
        id: 5,
        isbn: '9780140328721',
        authors: [{ id: 1, name: 'Author' }],
      };
      books.createBook.mockResolvedValue(saved);
      await expect(service.lookup('0140328726')).resolves.toEqual({
        source,
        book: saved,
      });
      expect(books.createBook).toHaveBeenCalledWith({
        ...book,
        isbn: '9780140328721',
      });
    },
  );
  it('rejects invalid input before calling dependencies', async () => {
    await expect(service.lookup('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(books.findByIsbns).not.toHaveBeenCalled();
    expect(provider.findByIsbn).not.toHaveBeenCalled();
    expect(books.createBook).not.toHaveBeenCalled();
  });
  it('returns 404 when neither source has the book', async () => {
    books.findByIsbns.mockResolvedValue(null);
    provider.findByIsbn.mockResolvedValue(null);
    await expect(service.lookup('9780140328721')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('preserves database failures and skips fallback', async () => {
    books.findByIsbns.mockRejectedValue(new InternalServerErrorException());
    await expect(service.lookup('9780140328721')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(provider.findByIsbn).not.toHaveBeenCalled();
    expect(books.createBook).not.toHaveBeenCalled();
  });
  it('reuses the row created by a concurrent request', async () => {
    const saved = { id: 3, title: 'Shared', authors: [] };
    books.findByIsbns.mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    provider.findByIsbn.mockResolvedValue({
      source: 'openlibrary',
      book: { title: 'Shared' },
    });
    books.createBook.mockRejectedValue(new ConflictException());
    await expect(service.lookup('9780140328721')).resolves.toEqual({
      source: 'database',
      book: saved,
    });
    expect(books.createBook).toHaveBeenCalledTimes(1);
  });
  it('propagates insertion errors without returning an unsaved preview', async () => {
    books.findByIsbns.mockResolvedValue(null);
    provider.findByIsbn.mockResolvedValue({
      source: 'googlebooks',
      book: { title: 'Book' },
    });
    books.createBook.mockRejectedValue(new InternalServerErrorException());
    await expect(service.lookup('9780140328721')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
  it('does not swallow a conflict when no matching ISBN exists', async () => {
    books.findByIsbns.mockResolvedValue(null);
    provider.findByIsbn.mockResolvedValue({
      source: 'googlebooks',
      book: { title: 'Book' },
    });
    books.createBook.mockRejectedValue(new ConflictException());
    await expect(service.lookup('9780140328721')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('does not write when the provider fails', async () => {
    books.findByIsbns.mockResolvedValue(null);
    provider.findByIsbn.mockRejectedValue(new Error('Provider failed'));
    await expect(service.lookup('9780140328721')).rejects.toThrow(
      'Provider failed',
    );
    expect(books.createBook).not.toHaveBeenCalled();
  });
});
