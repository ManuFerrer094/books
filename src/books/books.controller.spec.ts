import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import request from 'supertest';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { IsbnLookupService } from './isbn-lookup.service';

describe('BooksController', () => {
  let app: INestApplication;
  const book = {
    id: 1,
    title: 'Book',
    authors: [],
    created_at: '2026-10-04T10:00:00',
    updated_at: '2026-10-04T10:00:00',
  };
  const service = {
    getBooks: jest.fn<BooksService['getBooks']>(),
    getBook: jest.fn<BooksService['getBook']>(),
    createBook: jest.fn<BooksService['createBook']>(),
    updateBook: jest.fn<BooksService['updateBook']>(),
    deleteBook: jest.fn<BooksService['deleteBook']>(),
  };

  const lookup = { lookup: jest.fn<IsbnLookupService['lookup']>() };

  beforeEach(async () => {
    jest.resetAllMocks();
    service.getBooks.mockResolvedValue([book]);
    service.getBook.mockResolvedValue(book);
    service.createBook.mockResolvedValue(book);
    service.updateBook.mockResolvedValue(book);
    service.deleteBook.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        { provide: BooksService, useValue: service },
        { provide: IsbnLookupService, useValue: lookup },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('GET /books/isbn/:isbn routes to lookup without treating ISBN as an id', async () => {
    lookup.lookup.mockResolvedValue({ source: 'database', book });
    await request(app.getHttpServer())
      .get('/books/isbn/9780140328721')
      .expect(200)
      .expect({ source: 'database', book });
    expect(lookup.lookup).toHaveBeenCalledWith('9780140328721');
    expect(service.getBook).not.toHaveBeenCalled();
  });

  it('GET /books preserves the list endpoint', async () => {
    await request(app.getHttpServer()).get('/books').expect(200).expect([book]);
  });
  it('GET /books/:id parses the id and returns the book', async () => {
    await request(app.getHttpServer()).get('/books/1').expect(200).expect(book);
    expect(service.getBook).toHaveBeenCalledWith(1);
  });
  it.each(['get', 'patch', 'delete'] as const)(
    '%s returns 404 for a missing book',
    async (method) => {
      service.getBook.mockRejectedValue(new NotFoundException());
      service.updateBook.mockRejectedValue(new NotFoundException());
      service.deleteBook.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        [method]('/books/99')
        .send({ title: 'Book' })
        .expect(404);
    },
  );
  it('POST /books creates a book', async () => {
    await request(app.getHttpServer())
      .post('/books')
      .send({
        title: 'Book',
        isbn: '123',
        pages: 100,
        publication_date: '2020-02-29',
      })
      .expect(201)
      .expect(book);
    expect(service.createBook).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Book', isbn: '123' }),
    );
  });
  it('creates a book with trimmed author names', async () => {
    await request(app.getHttpServer())
      .post('/books')
      .send({
        title: 'Book',
        authors: [{ name: ' Author A ' }, { name: 'Author B' }],
      })
      .expect(201);
    expect(service.createBook).toHaveBeenCalledWith(
      expect.objectContaining({
        authors: [{ name: 'Author A' }, { name: 'Author B' }],
      }),
    );
  });
  it.each([
    null,
    'Author',
    [{}],
    [{ name: '   ' }],
    [{ name: 1 }],
    [{ name: 'x'.repeat(256) }],
    [{ name: 'Author', id: 1 }],
  ])('rejects invalid authors %j', async (authors) => {
    await request(app.getHttpServer())
      .post('/books')
      .send({ title: 'Book', authors })
      .expect(400);
    expect(service.createBook).not.toHaveBeenCalled();
  });
  it('PATCH accepts an empty author list to remove relationships', async () => {
    await request(app.getHttpServer())
      .patch('/books/1')
      .send({ authors: [] })
      .expect(200);
    expect(service.updateBook).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ authors: [] }),
    );
  });

  it('POST /books returns 409 for duplicate ISBN', async () => {
    service.createBook.mockRejectedValue(new ConflictException());
    await request(app.getHttpServer())
      .post('/books')
      .send({ title: 'Book', isbn: '123' })
      .expect(409);
  });
  it('PATCH /books/:id supports partial updates and nullable fields', async () => {
    await request(app.getHttpServer())
      .patch('/books/1')
      .send({ publisher: null })
      .expect(200)
      .expect(book);
    expect(service.updateBook).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ publisher: null }),
    );
  });
  it('DELETE /books/:id returns 204 without a body', async () => {
    const response = await request(app.getHttpServer())
      .delete('/books/1')
      .expect(204);
    expect(response.text).toBe('');
    expect(service.deleteBook).toHaveBeenCalledWith(1);
  });
  it.each([
    {},
    { title: null },
    { title: 42 },
    { title: 'x'.repeat(501) },
    { title: 'Book', id: 1 },
    { title: 'Book', isbn: 'x'.repeat(21) },
    { title: 'Book', pages: 1.5 },
    { title: 'Book', publication_date: '2023-02-29' },
  ])('rejects invalid creation data %j', async (body) => {
    await request(app.getHttpServer()).post('/books').send(body).expect(400);
    expect(service.createBook).not.toHaveBeenCalled();
  });
  it('rejects null titles in PATCH', async () => {
    await request(app.getHttpServer())
      .patch('/books/1')
      .send({ title: null })
      .expect(400);
    expect(service.updateBook).not.toHaveBeenCalled();
  });
  it.each(['get', 'patch', 'delete'] as const)(
    '%s rejects noninteger ids',
    async (method) => {
      await request(app.getHttpServer())
        [method]('/books/abc')
        .send({ title: 'Book' })
        .expect(400);
    },
  );
});
