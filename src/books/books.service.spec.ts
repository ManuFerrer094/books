import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { SUPABASE_CLIENT } from './supabase.provider';

describe('BooksService', () => {
  let service: BooksService;
  const book = { id: 1, title: 'Book' };
  let query: Record<string, jest.Mock<any>>;
  let supabase: { from: jest.Mock };

  beforeEach(async () => {
    query = {};
    for (const method of ['select', 'eq', 'insert', 'update', 'delete'])
      query[method] = jest.fn().mockReturnValue(query);
    query.maybeSingle = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ data: book, error: null });
    query.single = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ data: book, error: null });
    supabase = {
      from: jest.fn().mockReturnValue(query),
    };
    const module = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: SUPABASE_CLIENT, useValue: supabase },
      ],
    }).compile();
    service = module.get(BooksService);
  });

  it('lists books', async () => {
    query.select.mockResolvedValueOnce({ data: [book], error: null });
    await expect(service.getBooks()).resolves.toEqual([book]);
    expect(supabase.from).toHaveBeenCalledWith('books');
  });

  it('gets a book by id', async () => {
    await expect(service.getBook(1)).resolves.toEqual(book);
    expect(query.eq).toHaveBeenCalledWith('id', 1);
  });

  it('creates a book', async () => {
    await expect(service.createBook({ title: 'Book' })).resolves.toEqual(book);
    expect(query.insert).toHaveBeenCalledWith({ title: 'Book' });
  });

  it('updates only supplied fields and the modification timestamp', async () => {
    await expect(service.updateBook(1, { publisher: null })).resolves.toEqual(
      book,
    );
    expect(query.update).toHaveBeenCalledWith({
      publisher: null,
      updated_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith('id', 1);
  });

  it('deletes a book by id', async () => {
    await expect(service.deleteBook(1)).resolves.toBeUndefined();
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('id', 1);
    expect(query.select).toHaveBeenCalledWith('id');
  });

  it.each(['getBook', 'updateBook', 'deleteBook'] as const)(
    '%s returns 404 for a missing book',
    async (method) => {
      query.maybeSingle.mockResolvedValue({ data: null, error: null });
      await expect(
        service[method](1, { title: 'Book' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it.each([
    ['23505', ConflictException],
    ['23502', BadRequestException],
    ['22001', BadRequestException],
    ['unknown', InternalServerErrorException],
  ])('maps database error %s during creation', async (code, exception) => {
    query.single.mockResolvedValue({
      data: null,
      error: { code, message: 'private database details' },
    });
    await expect(service.createBook({ title: 'Book' })).rejects.toBeInstanceOf(
      exception,
    );
  });

  it.each(['getBook', 'updateBook', 'deleteBook'] as const)(
    '%s handles database failures before checking absence',
    async (method) => {
      query.maybeSingle.mockResolvedValue({
        data: null,
        error: { code: 'unknown' },
      });
      await expect(
        service[method](1, { title: 'Book' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    },
  );

  it('handles list failures without exposing database details', async () => {
    query.select.mockResolvedValue({
      data: null,
      error: { code: 'unknown', message: 'private details' },
    });
    await expect(service.getBooks()).rejects.toThrow('Unable to access books');
  });
});
