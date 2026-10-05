import { jest } from '@jest/globals';
import {
  InternalServerErrorException,
  BadRequestException,
  ConflictException,
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
  it('saves order with the user token and maps stale revisions to conflict', async () => {
    const rpc = jest
      .fn<any>()
      .mockResolvedValue({ data: { book_ids: [1], revision: 1 }, error: null });
    clients.create.mockReturnValue({ rpc });
    expect(
      await service.saveBookshelf(identity, { book_ids: [1], revision: 0 }),
    ).toEqual({ book_ids: [1], revision: 1 });
    expect(clients.create).toHaveBeenCalledWith('token-a');
    expect(rpc).toHaveBeenCalledWith('save_bookshelf_order', {
      requested_book_ids: [1],
      expected_revision: 0,
    });
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
    await expect(
      service.saveBookshelf(identity, { book_ids: [1], revision: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('reconciles persisted order with additions and removals without writing on GET', async () => {
    const layoutQuery = {
      select: jest.fn<any>(),
      eq: jest.fn<any>(),
      maybeSingle: jest.fn<any>().mockResolvedValue({
        data: { book_ids: [2, 99, 2], revision: 7 },
        error: null,
      }),
    };
    layoutQuery.select.mockReturnValue(layoutQuery);
    layoutQuery.eq.mockReturnValue(layoutQuery);
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: [{ book_id: 1 }, { book_id: 2 }, { book_id: 3 }],
      error: null,
    });
    clients.create.mockReturnValue({
      from: jest
        .fn<any>()
        .mockImplementation((table: string) =>
          table === 'user_bookshelf' ? layoutQuery : query,
        ),
    });
    expect(await service.bookshelf(identity)).toEqual({
      book_ids: [2, 1, 3],
      revision: 7,
    });
    expect(layoutQuery.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it('updates personal appearance without touching shared metadata or status', async () => {
    query.maybeSingle
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({
        data: {
          ...row,
          spine_color: '#123456',
          spine_width: 40,
          spine_height: 200,
        },
        error: null,
      });
    const saved = await service.updateSpine(identity, 1, {
      color: '#123456',
      width: 40,
      height: 200,
    });
    expect(saved.spine).toEqual({
      color: '#123456',
      width: 40,
      height: 200,
      image_path: null,
    });
    expect(query.update).toHaveBeenCalledWith({
      spine_color: '#123456',
      spine_width: 40,
      spine_height: 200,
      updated_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });
  it('rejects image paths belonging to another user or book', async () => {
    await expect(
      service.updateSpine(identity, 1, { image_path: 'victim/1/photo.jpg' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateSpine(identity, 1, { image_path: 'user-a/2/photo.jpg' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query.update).not.toHaveBeenCalled();
  });
  it('verifies images and cleans up the old photo only after saving', async () => {
    const list = jest
      .fn<any>()
      .mockResolvedValue({ data: [{ name: 'new.jpg' }], error: null });
    const remove = jest.fn<any>().mockResolvedValue({ error: null });
    clients.create.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
      storage: { from: jest.fn().mockReturnValue({ list, remove }) },
    });
    query.maybeSingle
      .mockResolvedValueOnce({
        data: { ...row, spine_image_path: 'user-a/1/old.jpg' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...row, spine_image_path: 'user-a/1/new.jpg' },
        error: null,
      });
    await service.updateSpine(identity, 1, { image_path: 'user-a/1/new.jpg' });
    expect(list).toHaveBeenCalledWith('user-a/1', { search: 'new.jpg' });
    expect(remove).toHaveBeenCalledWith(['user-a/1/old.jpg']);
    expect(query.update.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
  });
  it('does not delete the old photo if the association fails', async () => {
    const remove = jest.fn<any>();
    clients.create.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
      storage: { from: jest.fn().mockReturnValue({ remove }) },
    });
    query.maybeSingle
      .mockResolvedValueOnce({
        data: { ...row, spine_image_path: 'user-a/1/old.jpg' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    await expect(
      service.updateSpine(identity, 1, { image_path: null }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(remove).not.toHaveBeenCalled();
  });
  it('removes a personal photo after removing its library entry', async () => {
    const remove = jest.fn<any>().mockResolvedValue({ error: null });
    clients.create.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
      storage: { from: jest.fn().mockReturnValue({ remove }) },
    });
    query.maybeSingle.mockResolvedValue({
      data: { book_id: 1, spine_image_path: 'user-a/1/photo.jpg' },
      error: null,
    });
    await service.remove(identity, 1);
    expect(remove).toHaveBeenCalledWith(['user-a/1/photo.jpg']);
  });
});
