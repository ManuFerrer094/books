import { jest } from '@jest/globals';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service.js';
import { CatalogQueryDto } from './wishlist.dto.js';
import { AuthClientFactory } from '../auth/auth-client.factory.js';
import type { AuthRequest } from '../auth/auth.guard.js';

describe('WishlistService', () => {
  const identity = { user: { id: 'reader-a' }, accessToken: 'token-a' } as Pick<
    AuthRequest,
    'user' | 'accessToken'
  >;
  const row = {
    user_id: 'reader-a',
    book_id: 7,
    added_at: 'original',
    books: {
      id: 7,
      title: 'Shared story',
      book_authors: [{ authors: { id: 2, name: 'Author' } }],
    },
  };
  let query: Record<string, jest.Mock<any>>;
  let from: jest.Mock<any>;
  let rpc: jest.Mock<any>;
  const clients = { create: jest.fn<any>() };
  const service = new WishlistService(clients as unknown as AuthClientFactory);
  beforeEach(() => {
    jest.resetAllMocks();
    query = {};
    for (const method of ['select', 'eq', 'order', 'delete'])
      query[method] = jest.fn().mockReturnValue(query);
    query.range = jest
      .fn<any>()
      .mockResolvedValue({ data: [row], error: null });
    query.upsert = jest.fn<any>().mockResolvedValue({ error: null });
    query.maybeSingle = jest
      .fn<any>()
      .mockResolvedValue({ data: row, error: null });
    from = jest.fn().mockReturnValue(query);
    rpc = jest
      .fn<any>()
      .mockResolvedValue({
        data: { books: [], total: 0, page: 1, page_size: 24 },
        error: null,
      });
    clients.create.mockReturnValue({ from, rpc });
  });
  it('reads only the verified user wishes and projects shared metadata without private joins', async () => {
    const entries = await service.list(identity);
    expect(entries).toEqual([
      {
        book_id: 7,
        added_at: 'original',
        book: {
          id: 7,
          title: 'Shared story',
          authors: [{ id: 2, name: 'Author' }],
        },
      },
    ]);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'reader-a');
    expect(clients.create).toHaveBeenCalledWith('token-a');
    expect(from).toHaveBeenCalledWith('user_wishlist');
    const projection = query.select.mock.calls[0][0];
    for (const field of [
      'user_books',
      'user_id',
      'rating',
      'notes',
      'lent_to',
      'metadata',
      'cover_image_path',
    ])
      expect(projection).not.toContain(field);
  });
  it('continues beyond the page size instead of truncating a large wishlist', async () => {
    query.range.mockResolvedValueOnce({
      data: Array.from({ length: 100 }, (_, i) => ({ ...row, book_id: i + 1 })),
      error: null,
    });
    expect(await service.list(identity)).toHaveLength(101);
    expect(query.range.mock.calls).toEqual([
      [0, 99],
      [100, 199],
    ]);
    expect(query.eq).toHaveBeenCalledTimes(2);
  });
  it('adds idempotently, preserving the original date without adding ownership', async () => {
    expect((await service.add(identity, 7)).added_at).toBe('original');
    expect(query.upsert).toHaveBeenCalledWith(
      { user_id: 'reader-a', book_id: 7 },
      { onConflict: 'user_id,book_id', ignoreDuplicates: true },
    );
    expect(from.mock.calls.every(([table]) => table === 'user_wishlist')).toBe(
      true,
    );
    expect(query.eq).toHaveBeenCalledWith('user_id', 'reader-a');
    expect(query.eq).toHaveBeenCalledWith('book_id', 7);
  });
  it('deletes only this reader wish and accepts already absent wishes', async () => {
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ error: null });
    await expect(service.remove(identity, 7)).resolves.toBeUndefined();
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq.mock.calls).toEqual([
      ['user_id', 'reader-a'],
      ['book_id', 7],
    ]);
  });
  it('browses the paginated catalogue using the user token without reading ownership', async () => {
    await service.catalog(identity, {
      query: '  María  ',
      page: 2,
      page_size: 24,
    });
    expect(rpc).toHaveBeenCalledWith('browse_catalog', {
      search_query: 'María',
      page_number: 2,
      page_size: 24,
    });
    expect(clients.create).toHaveBeenCalledWith('token-a');
    expect(from).not.toHaveBeenCalled();
  });
  it.each([
    ['23503', NotFoundException],
    ['23514', BadRequestException],
    ['22023', BadRequestException],
    ['42501', UnauthorizedException],
    ['PGRST301', UnauthorizedException],
    ['XX000', InternalServerErrorException],
  ])('maps %s without leaking database details', async (code, exception) => {
    query.upsert.mockResolvedValue({
      error: { code, message: 'Sensitive database detail' },
    });
    await expect(service.add(identity, 7)).rejects.toBeInstanceOf(exception);
    await expect(service.add(identity, 7)).rejects.not.toThrow(
      'Sensitive database detail',
    );
    expect(query.maybeSingle).not.toHaveBeenCalled();
  });
  it('propagates read failures rather than returning an empty success', async () => {
    query.range.mockResolvedValue({ error: { code: 'XX000' }, data: null });
    await expect(service.list(identity)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    rpc.mockResolvedValue({ error: { code: '42501' }, data: null });
    await expect(
      service.catalog(identity, new CatalogQueryDto()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(service.add(identity, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
