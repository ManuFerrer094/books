import { jest } from '@jest/globals';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LibraryService } from './library.service.js';
import { AuthClientFactory } from '../auth/auth-client.factory.js';
import { IsbnLookupService } from '../books/isbn-lookup.service.js';
import type { AuthRequest } from '../auth/auth.guard.js';
import { ReadingStatus } from './library.dto.js';

describe('LibraryService', () => {
  let query: Record<string, jest.Mock<any>>;
  const row = {
    book_id: 1,
    status: 'reading',
    added_at: 'original',
    updated_at: 'original',
    books: {
      id: 1,
      title: 'Shared book',
      book_authors: [{ authors: { id: 1, name: 'Author' } }],
    },
  };
  const identity = { user: { id: 'user-a' }, accessToken: 'token-a' } as Pick<
    AuthRequest,
    'user' | 'accessToken'
  >;
  const clients = { create: jest.fn<any>() };
  const lookup = { lookup: jest.fn<IsbnLookupService['lookup']>() };
  const service = new LibraryService(
    clients as unknown as AuthClientFactory,
    lookup as IsbnLookupService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    query = {};
    for (const method of ['select', 'eq', 'order', 'update', 'delete'])
      query[method] = jest.fn().mockReturnValue(query);
    query.maybeSingle = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({ data: row, error: null });
    query.upsert = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({ data: null, error: null });
    clients.create.mockReturnValue({ from: jest.fn().mockReturnValue(query) });
  });

  it('lists only the verified user library with authors', async () => {
    query.order.mockResolvedValue({ data: [row], error: null });
    const results = await service.list(identity);
    expect(results[0].book.authors).toEqual([{ id: 1, name: 'Author' }]);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(clients.create).toHaveBeenCalledWith('token-a');
  });
  it('adds idempotently without changing an existing reading status or date', async () => {
    const saved = await service.add(identity, { book_id: 1 });
    expect(query.upsert).toHaveBeenCalledWith(
      { user_id: 'user-a', book_id: 1, status: 'pending' },
      { onConflict: 'user_id,book_id', ignoreDuplicates: true },
    );
    expect(saved.status).toBe('reading');
    expect(saved.added_at).toBe('original');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });
  it('imports an ISBN and adds the saved shared book', async () => {
    lookup.lookup.mockResolvedValue({
      source: 'inventaire',
      book: {
        id: 1,
        title: 'Shared',
        authors: [],
        created_at: '',
        updated_at: '',
      },
    });
    await service.addByIsbn(identity, {
      isbn: '9780140328721',
      status: ReadingStatus.Read,
    });
    expect(lookup.lookup).toHaveBeenCalledWith('9780140328721');
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        book_id: 1,
        user_id: 'user-a',
        status: 'read',
      }),
      expect.anything(),
    );
  });
  it('does not add anything when ISBN lookup fails', async () => {
    lookup.lookup.mockRejectedValue(new NotFoundException());
    await expect(
      service.addByIsbn(identity, { isbn: '9780140328721' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it.each(['get', 'update', 'remove'] as const)(
    '%s always scopes the book to its owner',
    async (method) => {
      await service[method](identity, 1, { status: ReadingStatus.Read });
      expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
      expect(query.eq).toHaveBeenCalledWith('book_id', 1);
    },
  );
  it.each(['get', 'update', 'remove'] as const)(
    '%s does not expose other users entries',
    async (method) => {
      query.maybeSingle.mockResolvedValue({ data: null, error: null });
      await expect(
        service[method](identity, 1, { status: ReadingStatus.Read }),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );
  it('removes only the relationship table', async () => {
    const from = jest.fn().mockReturnValue(query);
    clients.create.mockReturnValue({ from });
    await service.remove(identity, 1);
    expect(from).toHaveBeenCalledWith('user_books');
    expect(from).not.toHaveBeenCalledWith('books');
  });
  it('reports missing catalog books on insertion', async () => {
    query.upsert.mockResolvedValue({ error: { code: '23503' } });
    await expect(
      service.add(identity, { book_id: 999 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('handles database failures before checking absence', async () => {
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'unknown', message: 'Secret database details' },
    });
    await expect(service.get(identity, 1)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
