import { jest } from '@jest/globals';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountService } from './account.service.js';
import { AuthClientFactory } from '../auth/auth-client.factory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../auth/auth.guard.js';

describe('AccountService', () => {
  const owner = '11111111-1111-4111-8111-111111111111';
  const identity = {
    user: { id: owner, email: 'reader@example.com' },
    accessToken: 'reader-token',
  } as Pick<AuthRequest, 'user' | 'accessToken'>;
  const verify = jest.fn<any>();
  const signOut = jest.fn<any>();
  const deleteUser = jest.fn<any>();
  const list = jest.fn<any>();
  const remove = jest.fn<any>();
  const create = jest.fn<any>();
  const fromStorage = jest.fn<any>();
  const admin = {
    storage: { from: fromStorage },
    auth: { admin: { deleteUser } },
  };
  const service = new AccountService(
    { create } as unknown as AuthClientFactory,
    admin as unknown as SupabaseClient,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    verify.mockResolvedValue({ data: { user: identity.user }, error: null });
    signOut.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    list.mockImplementation(async (path: string) => ({
      data:
        path === owner
          ? [{ name: '7', id: null }]
          : [{ name: 'photo.jpg', id: 'photo' }],
      error: null,
    }));
    fromStorage.mockReturnValue({ list, remove });
    create.mockReturnValue({ auth: { signInWithPassword: verify, signOut } });
  });
  it('verifies the current password, cleans both private buckets and deletes only the verified owner', async () => {
    await service.remove(identity, 'current-password');
    expect(create).toHaveBeenCalledWith();
    expect(verify).toHaveBeenCalledWith({
      email: identity.user.email,
      password: 'current-password',
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(fromStorage.mock.calls.map(([bucket]) => bucket)).toEqual([
      'book-spines',
      'book-covers',
      'book-spines',
      'book-covers',
    ]);
    expect(remove.mock.calls).toEqual([
      [[`${owner}/7/photo.jpg`]],
      [[`${owner}/7/photo.jpg`]],
    ]);
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith(owner);
    expect(deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      remove.mock.invocationCallOrder.at(-1)!,
    );
  });
  it.each([
    { data: { user: null }, error: { status: 400 } },
    { data: { user: { id: 'another-reader' } }, error: null },
  ])(
    'never uses the admin client when reauthentication fails or changes identity',
    async (response) => {
      verify.mockResolvedValue(response);
      await expect(
        service.remove(identity, 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fromStorage).not.toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
    },
  );
  it('does not disclose backend details when reauthentication is unavailable', async () => {
    verify.mockRejectedValue(new Error('Secret diagnostic'));
    await expect(service.remove(identity, 'password')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it('enumerates orphan uploads and pages before removing files, so deletions do not skip a page', async () => {
    list.mockImplementation(
      async (path: string, input: { offset: number }) => ({
        data:
          path === owner
            ? input.offset === 0
              ? Array.from({ length: 100 }, (_, i) => ({
                  name: `${i}.jpg`,
                  id: `${i}`,
                }))
              : [{ name: 'orphan.jpg', id: 'orphan' }]
            : [],
        error: null,
      }),
    );
    await service.remove(identity, 'password');
    expect(list).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({ offset: 100 }),
    );
    expect(remove.mock.calls.map(([paths]) => paths.length)).toEqual([
      100, 1, 100, 1,
    ]);
    expect(remove.mock.calls[1][0]).toEqual([`${owner}/orphan.jpg`]);
    expect(remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.max(...list.mock.invocationCallOrder),
    );
  });
  it('rejects unsafe paths without removing anything or deleting the user', async () => {
    list.mockResolvedValue({
      data: [{ name: '../another-reader/photo.jpg', id: 'file' }],
      error: null,
    });
    await expect(service.remove(identity, 'password')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(remove).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it('stops before deleting when a bucket cannot be read', async () => {
    list.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
    await expect(service.remove(identity, 'password')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(remove).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it('keeps the account if photo cleanup fails and permits a later retry', async () => {
    remove.mockResolvedValueOnce({ error: { message: 'Unavailable' } });
    await expect(service.remove(identity, 'password')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(deleteUser).not.toHaveBeenCalled();
    await expect(service.remove(identity, 'password')).resolves.toBeUndefined();
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });
  it('does not report success if deleting the auth user fails', async () => {
    deleteUser.mockResolvedValue({ error: { message: 'Unavailable' } });
    await expect(service.remove(identity, 'password')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('exports complete private data with the user token, never with the admin client', async () => {
    const chains: Record<string, any> = {};
    const row = {
      user_id: owner,
      book_id: 7,
      rating: 0,
      notes: 'Private notes',
      books: { id: 7, title: 'Book', book_authors: [] },
    };
    for (const table of ['user_books', 'user_wishlist', 'user_bookshelf']) {
      const query: any = {};
      for (const method of ['select', 'eq', 'order'])
        query[method] = jest.fn().mockReturnValue(query);
      query.range = jest.fn<any>().mockResolvedValue({ data: [], error: null });
      query.maybeSingle = jest.fn<any>().mockResolvedValue({
        data: { book_ids: [7], revision: 1 },
        error: null,
      });
      chains[table] = query;
    }
    chains.user_books.range
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, i) => ({
          ...row,
          book_id: i + 1,
        })),
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ ...row, book_id: 101 }], error: null });
    chains.user_wishlist.range.mockResolvedValue({
      data: [{ book_id: 7, added_at: 'original', books: row.books }],
      error: null,
    });
    create.mockReturnValue({ from: jest.fn((table: string) => chains[table]) });
    const result = await service.export(identity);
    expect(result.books).toHaveLength(101);
    expect(result.books[0]).toMatchObject({
      notes: 'Private notes',
      rating: 0,
    });
    expect(result.books[0]).not.toHaveProperty('user_id');
    expect(result.wishlist[0].book.title).toBe('Book');
    expect(result.account).toEqual({ id: owner, email: identity.user.email });
    expect(create).toHaveBeenCalledWith('reader-token');
    for (const query of Object.values(chains))
      expect(query.eq).toHaveBeenCalledWith('user_id', owner);
    expect(JSON.stringify(result)).not.toContain('reader-token');
    expect(deleteUser).not.toHaveBeenCalled();
    expect(fromStorage).not.toHaveBeenCalled();
    chains.user_books.range.mockResolvedValue({
      error: { code: '42501' },
      data: null,
    });
    await expect(service.export(identity)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
