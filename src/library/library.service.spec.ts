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
import {
  migrateDesign,
  placedIds,
  decorItem,
  placeItem,
} from './bookshelf-design.js';

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
  it('updates only edited personal fields, keeping zero distinct from no rating', async () => {
    await service.update(identity, 1, {
      is_lent: true,
      lent_to: '  Ana  ',
      notes: '  Ideas\nprivadas  ',
      rating: 0,
    });
    expect(query.update).toHaveBeenCalledWith({
      is_lent: true,
      lent_to: 'Ana',
      notes: 'Ideas\nprivadas',
      rating: 0,
      updated_at: expect.any(String),
    });
    expect(query.update.mock.calls[0][0]).not.toHaveProperty('status');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(query.eq).toHaveBeenCalledWith('book_id', 1);
    await service.update(identity, 1, { rating: null, notes: '' });
    expect(query.update).toHaveBeenLastCalledWith({
      rating: null,
      notes: null,
      updated_at: expect.any(String),
    });
  });
  it('clears the borrower on return without clearing notes or reading status', async () => {
    await service.update(identity, 1, { is_lent: false });
    expect(query.update).toHaveBeenCalledWith({
      is_lent: false,
      lent_to: null,
      updated_at: expect.any(String),
    });
    await expect(
      service.update(identity, 1, { is_lent: false, lent_to: 'Ana' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(identity, 1, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(query.update).toHaveBeenCalledTimes(1);
  });
  it('returns private fields from reads and keeps the shared book untouched', async () => {
    query.maybeSingle.mockResolvedValue({
      data: {
        ...row,
        is_lent: true,
        lent_to: 'Ana',
        notes: 'Private',
        rating: 4,
      },
      error: null,
    });
    const saved = await service.get(identity, 1);
    expect(saved).toMatchObject({
      is_lent: true,
      lent_to: 'Ana',
      notes: 'Private',
      rating: 4,
      status: 'reading',
    });
    expect(saved.book).not.toHaveProperty('notes');
    expect(saved.book).not.toHaveProperty('rating');
    expect(row.books).not.toHaveProperty('notes');
  });
  it('applies personal fields on every read without changing shared metadata', async () => {
    const personal = {
      ...row,
      metadata: {
        title: 'My title',
        authors: [{ name: 'My author' }],
        cover_url: null,
      },
    };
    query.order.mockResolvedValue({ data: [personal, row], error: null });
    const [mine, unchanged] = await service.list(identity);
    expect(mine.customized).toBe(true);
    expect(mine.book.title).toBe('My title');
    expect(mine.book.authors).toEqual([{ name: 'My author' }]);
    expect(mine.book.cover_url).toBeNull();
    expect(mine).not.toHaveProperty('metadata');
    expect(unchanged.customized).toBe(false);
    expect(unchanged.book.title).toBe('Shared book');
    expect(row.books.title).toBe('Shared book');
    query.maybeSingle.mockResolvedValue({ data: personal, error: null });
    expect(
      (await service.update(identity, 1, { status: ReadingStatus.Read })).book
        .title,
    ).toBe('My title');
  });
  it('atomically edits or resets only the personal entry using the user token', async () => {
    const rpc = jest.fn<any>().mockResolvedValue({ data: true, error: null });
    const from = jest.fn().mockReturnValue(query);
    clients.create.mockReturnValue({ rpc, from });
    await service.updateMetadata(identity, 1, {
      authors: [{ name: 'Personal author' }],
    });
    expect(rpc).toHaveBeenCalledWith('update_personal_book_metadata', {
      requested_book_id: 1,
      metadata_patch: { authors: [{ name: 'Personal author' }] },
    });
    expect(clients.create).toHaveBeenCalledWith('token-a');
    expect(from).toHaveBeenCalledWith('user_books');
    expect(from).not.toHaveBeenCalledWith('books');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
    await service.updateMetadata(identity, 1, null);
    expect(rpc).toHaveBeenLastCalledWith('update_personal_book_metadata', {
      requested_book_id: 1,
      metadata_patch: null,
    });
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(
      service.updateMetadata(identity, 2, { title: 'Other book' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    rpc.mockResolvedValue({ data: null, error: { code: '22023' } });
    await expect(
      service.updateMetadata(identity, 1, { title: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
    const design = migrateDesign([{ book_id: 1 }]);
    expect(
      await service.saveBookshelf(identity, {
        book_ids: [1],
        revision: 0,
        design,
      }),
    ).toEqual({ book_ids: [1], revision: 1 });
    expect(clients.create).toHaveBeenCalledWith('token-a');
    expect(rpc).toHaveBeenCalledWith('save_bookshelf_design', {
      requested_book_ids: [1],
      expected_revision: 0,
      requested_design: design,
    });
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
    await expect(
      service.saveBookshelf(identity, { book_ids: [1], revision: 0, design }),
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
    const result = await service.bookshelf(identity);
    expect(result).toMatchObject({
      book_ids: [2, 1, 3],
      revision: 7,
    });
    expect(placedIds(result.design)).toEqual([2, 1, 3]);
    expect(layoutQuery.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it('rejects overlapping and duplicate book placements before the RPC', async () => {
    const design = migrateDesign([{ book_id: 1 }, { book_id: 2 }]);
    design.items[1].x = design.items[0].x;
    await expect(
      service.saveBookshelf(identity, {
        book_ids: [1, 2],
        revision: 0,
        design,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    design.items[1].x = 200;
    design.items[1].book_ids = [1];
    await expect(
      service.saveBookshelf(identity, {
        book_ids: [1, 2],
        revision: 0,
        design,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('legacy order writes retain decorations and use the same revision transaction', async () => {
    const original = placeItem(
      migrateDesign([{ book_id: 1 }, { book_id: 2 }]),
      decorItem('fern'),
    )!;
    const layoutSpy = jest
      .spyOn(service, 'bookshelf')
      .mockResolvedValueOnce({
        book_ids: [1, 2],
        revision: 0,
        design: original,
      });
    const listSpy = jest
      .spyOn(service, 'list')
      .mockResolvedValueOnce([{ book_id: 1 }, { book_id: 2 }] as any);
    const rpc = jest.fn<any>().mockResolvedValue({ data: {}, error: null });
    clients.create.mockReturnValue({ rpc });
    await service.saveBookshelf(identity, { book_ids: [2, 1], revision: 0 });
    const saved = rpc.mock.calls[0][1].requested_design;
    expect(placedIds(saved)).toEqual([2, 1]);
    expect(saved.items.find((item: any) => item.kind === 'decor')).toEqual(
      original.items.find((item) => item.kind === 'decor'),
    );
    layoutSpy.mockRestore();
    listSpy.mockRestore();
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
  it('verifies private covers and cleans up the previous photo after saving', async () => {
    const list = jest
      .fn<any>()
      .mockResolvedValue({ data: [{ name: 'new.jpg' }], error: null });
    const remove = jest.fn<any>().mockResolvedValue({ error: null });
    const storageFrom = jest.fn().mockReturnValue({ list, remove });
    const from = jest.fn().mockReturnValue(query);
    clients.create.mockReturnValue({ from, storage: { from: storageFrom } });
    query.maybeSingle
      .mockResolvedValueOnce({
        data: { ...row, cover_image_path: 'user-a/1/old.jpg' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...row, cover_image_path: 'user-a/1/new.jpg' },
        error: null,
      });
    const saved = await service.updateCover(identity, 1, {
      image_path: 'user-a/1/new.jpg',
    });
    expect(saved.book.cover_image_path).toBe('user-a/1/new.jpg');
    expect(saved.customized).toBe(true);
    expect(saved.status).toBe('reading');
    expect(storageFrom).toHaveBeenCalledWith('book-covers');
    expect(list).toHaveBeenCalledWith('user-a/1', { search: 'new.jpg' });
    expect(query.update).toHaveBeenCalledWith({
      cover_image_path: 'user-a/1/new.jpg',
      updated_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(remove).toHaveBeenCalledWith(['user-a/1/old.jpg']);
    expect(query.update.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(from).not.toHaveBeenCalledWith('books');
  });
  it('rejects another owner, another book or a missing cover photo', async () => {
    const list = jest.fn<any>().mockResolvedValue({ data: [], error: null });
    clients.create.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
      storage: { from: jest.fn().mockReturnValue({ list }) },
    });
    for (const path of [
      'victim/1/photo.jpg',
      'user-a/2/photo.jpg',
      'user-a/1/missing.jpg',
    ])
      await expect(
        service.updateCover(identity, 1, { image_path: path }),
      ).rejects.toBeInstanceOf(BadRequestException);
    expect(query.update).not.toHaveBeenCalled();
  });
  it('preserves the old cover when saving fails and cleans it after a reset', async () => {
    const rpc = jest.fn<any>().mockResolvedValue({ data: true, error: null });
    const remove = jest.fn<any>().mockResolvedValue({ error: null });
    clients.create.mockReturnValue({
      rpc,
      from: jest.fn().mockReturnValue(query),
      storage: { from: jest.fn().mockReturnValue({ remove }) },
    });
    query.maybeSingle
      .mockResolvedValueOnce({
        data: { ...row, cover_image_path: 'user-a/1/old.jpg' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    await expect(
      service.updateCover(identity, 1, { image_path: null }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(remove).not.toHaveBeenCalled();
    query.maybeSingle
      .mockResolvedValueOnce({
        data: { ...row, cover_image_path: 'user-a/1/old.jpg' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...row, cover_image_path: null },
        error: null,
      });
    const saved = await service.updateMetadata(identity, 1, null);
    expect(saved.book.cover_image_path).toBeNull();
    expect(remove).toHaveBeenCalledWith(['user-a/1/old.jpg']);
  });
  it('cleans both cover and spine photos when removing an entry', async () => {
    const remove = jest.fn<any>().mockResolvedValue({ error: null });
    const storageFrom = jest.fn().mockReturnValue({ remove });
    clients.create.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
      storage: { from: storageFrom },
    });
    query.maybeSingle.mockResolvedValue({
      data: {
        book_id: 1,
        cover_image_path: 'user-a/1/cover.jpg',
        spine_image_path: 'user-a/1/spine.jpg',
      },
      error: null,
    });
    await service.remove(identity, 1);
    expect(storageFrom).toHaveBeenCalledWith('book-covers');
    expect(storageFrom).toHaveBeenCalledWith('book-spines');
    expect(remove).toHaveBeenCalledWith(['user-a/1/cover.jpg']);
    expect(remove).toHaveBeenCalledWith(['user-a/1/spine.jpg']);
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
