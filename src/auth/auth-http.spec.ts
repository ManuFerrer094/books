import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { LibraryController } from '../library/library.controller.js';
import { BookshelfController } from '../library/bookshelf.controller.js';
import { LibraryService } from '../library/library.service.js';
import { BooksController } from '../books/books.controller.js';
import { BooksService } from '../books/books.service.js';
import { IsbnLookupService } from '../books/isbn-lookup.service.js';
import {
  CatalogController,
  WishlistController,
} from '../library/wishlist.controller.js';
import { WishlistService } from '../library/wishlist.service.js';
import { AccountController } from '../account/account.controller.js';
import { AccountService } from '../account/account.service.js';

describe('Authenticated HTTP routes', () => {
  let app: INestApplication;
  const auth = {
    verify: jest.fn<AuthService['verify']>(),
    register: jest.fn<any>(),
    login: jest.fn<any>(),
    refresh: jest.fn<any>(),
    logout: jest.fn<any>(),
  };
  const library = {
    list: jest.fn<any>(),
    get: jest.fn<any>(),
    add: jest.fn<any>(),
    addByIsbn: jest.fn<any>(),
    update: jest.fn<any>(),
    remove: jest.fn<any>(),
    bookshelf: jest.fn<any>(),
    saveBookshelf: jest.fn<any>(),
    updateSpine: jest.fn<any>(),
    updateMetadata: jest.fn<any>(),
    updateCover: jest.fn<any>(),
  };
  const books = {
    getBooks: jest.fn<any>(),
    getBook: jest.fn<any>(),
    createBook: jest.fn<any>(),
    updateBook: jest.fn<any>(),
    deleteBook: jest.fn<any>(),
  };
  const lookup = { lookup: jest.fn<any>() };
  const account = { export: jest.fn<any>(), remove: jest.fn<any>() };
  const wishlist = {
    list: jest.fn<any>(),
    add: jest.fn<any>(),
    remove: jest.fn<any>(),
    catalog: jest.fn<any>(),
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    auth.verify.mockImplementation(async (token) => {
      if (token !== 'valid-a' && token !== 'admin')
        throw new UnauthorizedException();
      return {
        id: token === 'admin' ? 'admin' : 'user-a',
        email: 'a@example.com',
        app_metadata: { role: token === 'admin' ? 'admin' : 'user' },
        user_metadata: { role: 'admin' },
      } as any;
    });
    library.list.mockResolvedValue([]);
    books.getBooks.mockResolvedValue([]);
    wishlist.list.mockResolvedValue([]);
    wishlist.catalog.mockResolvedValue({
      books: [],
      total: 0,
      page: 1,
      page_size: 24,
    });
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        LibraryController,
        BooksController,
        BookshelfController,
        CatalogController,
        WishlistController,
        AccountController,
      ],
      providers: [
        AuthGuard,
        AdminGuard,
        { provide: AuthService, useValue: auth },
        { provide: LibraryService, useValue: library },
        { provide: BooksService, useValue: books },
        { provide: IsbnLookupService, useValue: lookup },
        { provide: WishlistService, useValue: wishlist },
        { provide: AccountService, useValue: account },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it.each([
    '/me/books',
    '/me/bookshelf',
    '/catalog',
    '/me/wishlist',
    '/me/account/export',
    '/auth/me',
    '/books',
    '/books/isbn/9780140328721',
  ])('requires authentication for %s', async (url) => {
    await request(app.getHttpServer()).get(url).expect(401);
    expect(auth.verify).not.toHaveBeenCalled();
    expect(lookup.lookup).not.toHaveBeenCalled();
  });
  it.each(['Bearer invalid', 'Basic abc', 'Bearer token extra'])(
    'rejects invalid authorization %s',
    async (value) => {
      await request(app.getHttpServer())
        .get('/me/books')
        .set('Authorization', value)
        .expect(401);
      expect(library.list).not.toHaveBeenCalled();
    },
  );
  it('uses the verified identity for library requests', async () => {
    await request(app.getHttpServer())
      .get('/me/books')
      .set('Authorization', 'Bearer valid-a')
      .expect(200)
      .expect([]);
    expect(library.list).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-a' }),
        accessToken: 'valid-a',
      }),
    );
  });
  it('exports the verified account with private caching disabled', async () => {
    account.export.mockResolvedValue({ version: 1, books: [] });
    await request(app.getHttpServer())
      .get('/me/account/export')
      .set('Authorization', 'Bearer valid-a')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect(
        'Content-Disposition',
        'attachment; filename="entre-paginas.json"',
      );
    expect(account.export).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'valid-a',
        user: expect.objectContaining({ id: 'user-a' }),
      }),
    );
  });
  it('deletes only the verified account after validated confirmation', async () => {
    await request(app.getHttpServer())
      .delete('/me/account')
      .set('Authorization', 'Bearer valid-a')
      .send({ password: 'current-password', confirmation: 'ELIMINAR' })
      .expect(204);
    expect(account.remove).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-a' }),
      }),
      'current-password',
    );
  });
  it.each([
    { password: 'p', confirmation: 'ELIMINAR', user_id: 'victim' },
    { password: 'p', confirmation: 'ELIMINAR', email: 'victim@example.com' },
    { password: '', confirmation: 'ELIMINAR' },
    { password: null, confirmation: 'ELIMINAR' },
    { password: 'p', confirmation: 'eliminar' },
    { password: 'p' },
    { password: 'p'.repeat(129), confirmation: 'ELIMINAR' },
  ])('rejects unsafe account deletion data %j', async (body) => {
    await request(app.getHttpServer())
      .delete('/me/account')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(account.remove).not.toHaveBeenCalled();
  });
  it('requires authentication to delete an account', async () => {
    await request(app.getHttpServer())
      .delete('/me/account')
      .send({ password: 'p', confirmation: 'ELIMINAR' })
      .expect(401);
    expect(account.remove).not.toHaveBeenCalled();
  });
  it('browses the catalogue with validated defaults and private caching disabled', async () => {
    await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', 'Bearer valid-a')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(wishlist.catalog).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'valid-a' }),
      expect.objectContaining({ query: '', page: 1, page_size: 24 }),
    );
    await request(app.getHttpServer())
      .get('/catalog?query=autor&page=2&page_size=10')
      .set('Authorization', 'Bearer valid-a')
      .expect(200);
    expect(wishlist.catalog).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ query: 'autor', page: 2, page_size: 10 }),
    );
  });
  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=oops',
    'page_size=101',
    'page_size=0',
    'user_id=victim',
    `query=${'a'.repeat(201)}`,
  ])('rejects invalid catalogue query %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/catalog?${query}`)
      .set('Authorization', 'Bearer valid-a')
      .expect(400);
    expect(wishlist.catalog).not.toHaveBeenCalled();
  });
  it('uses verified ownership for all wishlist operations', async () => {
    wishlist.add.mockResolvedValue({ book_id: 7 });
    await request(app.getHttpServer())
      .get('/me/wishlist')
      .set('Authorization', 'Bearer valid-a')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect([]);
    await request(app.getHttpServer())
      .post('/me/wishlist')
      .set('Authorization', 'Bearer valid-a')
      .send({ book_id: 7 })
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({ book_id: 7 });
    await request(app.getHttpServer())
      .delete('/me/wishlist/7')
      .set('Authorization', 'Bearer valid-a')
      .expect(204);
    const verified = expect.objectContaining({
      user: expect.objectContaining({ id: 'user-a' }),
      accessToken: 'valid-a',
    });
    expect(wishlist.list).toHaveBeenCalledWith(verified);
    expect(wishlist.add).toHaveBeenCalledWith(verified, 7);
    expect(wishlist.remove).toHaveBeenCalledWith(verified, 7);
    expect(library.add).not.toHaveBeenCalled();
  }, 15000);
  it.each([
    { book_id: 7, user_id: 'victim' },
    { book_id: 0 },
    { book_id: null },
    { book_id: '7' },
    { book_id: 1.5 },
    { book_id: 7, rating: 5 },
  ])('rejects invalid or forged wishlist data %j', async (body) => {
    await request(app.getHttpServer())
      .post('/me/wishlist')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(wishlist.add).not.toHaveBeenCalled();
  });
  it('requires authentication on wishlist writes and validates delete identifiers', async () => {
    await request(app.getHttpServer())
      .post('/me/wishlist')
      .send({ book_id: 7 })
      .expect(401);
    await request(app.getHttpServer()).delete('/me/wishlist/7').expect(401);
    await request(app.getHttpServer())
      .delete('/me/wishlist/not-a-book')
      .set('Authorization', 'Bearer valid-a')
      .expect(400);
    expect(wishlist.add).not.toHaveBeenCalled();
    expect(wishlist.remove).not.toHaveBeenCalled();
  });
  it.each([
    { book_id: 1, user_id: 'victim' },
    { book_id: 1, status: 'invalid' },
    { book_id: 1, status: null },
    { book_id: -1 },
  ])('rejects forged ownership or invalid library data %j', async (body) => {
    await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(library.add).not.toHaveBeenCalled();
  });
  it('adds a book by ISBN for the verified user', async () => {
    library.addByIsbn.mockResolvedValue({ book_id: 1 });
    await request(app.getHttpServer())
      .post('/me/books/isbn')
      .set('Authorization', 'Bearer valid-a')
      .send({ isbn: '9780140328721', status: 'pending' })
      .expect(200)
      .expect({ book_id: 1 });
    expect(library.addByIsbn).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'valid-a' }),
      expect.objectContaining({ isbn: '9780140328721', status: 'pending' }),
    );
  });
  it('requires at least one field for library updates', async () => {
    await request(app.getHttpServer())
      .patch('/me/books/1')
      .set('Authorization', 'Bearer valid-a')
      .send({})
      .expect(400);
  });
  it.each([
    { is_lent: true, lent_to: 'Ana', notes: 'Mis ideas', rating: 5 },
    { rating: 0 },
    { rating: null, notes: null, lent_to: null },
    { is_lent: false },
    { status: 'read' },
  ])(
    'accepts personal details without requiring a reading status %j',
    async (body) => {
      await request(app.getHttpServer())
        .patch('/me/books/1')
        .set('Authorization', 'Bearer valid-a')
        .send(body)
        .expect(200);
      expect(library.update).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: 'user-a' }),
          accessToken: 'valid-a',
        }),
        1,
        expect.objectContaining(body),
      );
      expect(books.updateBook).not.toHaveBeenCalled();
    },
  );
  it.each([
    { rating: -1 },
    { rating: 6 },
    { rating: 2.5 },
    { rating: '5' },
    { notes: 123 },
    { notes: 'a'.repeat(10001) },
    { lent_to: 'a'.repeat(201) },
    { lent_to: {} },
    { is_lent: null },
    { is_lent: 'true' },
    { status: null },
    { user_id: 'victim', notes: 'Forged' },
  ])('rejects invalid personal details %#', async (body) => {
    await request(app.getHttpServer())
      .patch('/me/books/1')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(library.update).not.toHaveBeenCalled();
  });
  it('allows private cover association and restoration only with authentication', async () => {
    for (const image_path of [
      '11111111-1111-4111-8111-111111111111/1/33333333-3333-4333-8333-333333333333.jpg',
      null,
    ]) {
      await request(app.getHttpServer())
        .patch('/me/books/1/cover')
        .set('Authorization', 'Bearer valid-a')
        .send({ image_path })
        .expect(200);
      expect(library.updateCover).toHaveBeenLastCalledWith(
        expect.objectContaining({ accessToken: 'valid-a' }),
        1,
        expect.objectContaining({ image_path }),
      );
    }
    await request(app.getHttpServer())
      .patch('/me/books/1/cover')
      .send({ image_path: null })
      .expect(401);
    expect(books.updateBook).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { image_path: 'https://example.com/photo.jpg' },
    { image_path: '../photo.jpg' },
    { image_path: null, user_id: 'victim' },
    { cover_url: 'https://example.com/photo.jpg' },
  ])('rejects invalid cover data %j', async (body) => {
    await request(app.getHttpServer())
      .patch('/me/books/1/cover')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(library.updateCover).not.toHaveBeenCalled();
  });
  it('allows personal metadata changes and reset without allowing catalog writes', async () => {
    const body = {
      title: '  My title  ',
      authors: [{ name: '  My author  ' }],
      cover_url: 'https://example.com/cover.jpg',
      isbn: null,
      pages: 200,
      publisher: null,
      language: 'es',
      publication_date: '2020-02-29',
    };
    await request(app.getHttpServer())
      .patch('/me/books/1/metadata')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(200);
    expect(library.updateMetadata).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accessToken: 'valid-a',
        user: expect.objectContaining({ id: 'user-a' }),
      }),
      1,
      expect.objectContaining({
        ...body,
        title: 'My title',
        authors: [{ name: 'My author' }],
      }),
    );
    await request(app.getHttpServer())
      .patch('/me/books/1/metadata')
      .set('Authorization', 'Bearer valid-a')
      .send({ authors: [], cover_url: null, pages: null })
      .expect(200);
    await request(app.getHttpServer())
      .delete('/me/books/1/metadata')
      .set('Authorization', 'Bearer valid-a')
      .expect(200);
    expect(library.updateMetadata).toHaveBeenLastCalledWith(
      expect.objectContaining({ accessToken: 'valid-a' }),
      1,
      null,
    );
    expect(books.updateBook).not.toHaveBeenCalled();
    for (const method of ['patch', 'delete'] as const) {
      await request(app.getHttpServer())
        [method]('/me/books/1/metadata')
        .send({ title: 'Forged' })
        .expect(401);
    }
  });
  it.each([
    { user_id: 'victim', title: 'Changed' },
    { id: 2 },
    { book_id: 2 },
    { title: null },
    { title: '' },
    { title: '   ' },
    { title: 123 },
    { authors: null },
    { authors: [{ name: ' ' }] },
    { authors: [{ id: 1, name: 'Author' }] },
    { pages: 0 },
    { pages: 1.5 },
    { pages: '200' },
    { pages: 2147483648 },
    { cover_url: 'javascript:alert(1)' },
    { cover_url: 'ftp://example.com/a.jpg' },
    { publication_date: '2023-02-29' },
    { publisher: 3 },
    { status: 'read' },
  ])('rejects invalid or forged personal metadata %j', async (body) => {
    await request(app.getHttpServer())
      .patch('/me/books/1/metadata')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(library.updateMetadata).not.toHaveBeenCalled();
  });
  it('reads and saves only the verified user bookshelf', async () => {
    const layout = { book_ids: [2, 1], revision: 3 };
    library.bookshelf.mockResolvedValue(layout);
    library.saveBookshelf.mockResolvedValue({ ...layout, revision: 4 });
    await request(app.getHttpServer())
      .get('/me/bookshelf')
      .set('Authorization', 'Bearer valid-a')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect(layout);
    await request(app.getHttpServer())
      .put('/me/bookshelf')
      .set('Authorization', 'Bearer valid-a')
      .send(layout)
      .expect(200)
      .expect({ ...layout, revision: 4 });
    expect(library.saveBookshelf).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'valid-a' }),
      expect.objectContaining(layout),
    );
  });
  it.each([
    { book_ids: [1, 1], revision: 0 },
    { book_ids: [0], revision: 0 },
    { book_ids: [1], revision: -1 },
    { book_ids: [1], revision: '0' },
    { book_ids: [1] },
    { book_ids: null, revision: 0 },
    { book_ids: [1], revision: 0, user_id: 'victim' },
  ])('rejects invalid order %j', async (body) => {
    await request(app.getHttpServer())
      .put('/me/bookshelf')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(library.saveBookshelf).not.toHaveBeenCalled();
  });
  it.each([
    { width: 27 },
    { height: 241 },
    { color: 'red' },
    { image_path: 'https://example.com/a.jpg' },
    { status: 'read' },
    { user_id: 'victim' },
  ])('rejects invalid spine data %j', async (body) => {
    await request(app.getHttpServer())
      .patch('/me/books/1/spine')
      .set('Authorization', 'Bearer valid-a')
      .send(body)
      .expect(400);
    expect(library.updateSpine).not.toHaveBeenCalled();
  });
  it('allows spine overrides and restoration without a reading status', async () => {
    for (const body of [
      { color: '#123456', width: 28, height: 240 },
      { color: null, width: null, height: null, image_path: null },
    ]) {
      await request(app.getHttpServer())
        .patch('/me/books/1/spine')
        .set('Authorization', 'Bearer valid-a')
        .send(body)
        .expect(200);
      expect(library.updateSpine).toHaveBeenLastCalledWith(
        expect.objectContaining({ accessToken: 'valid-a' }),
        1,
        expect.objectContaining(body),
      );
    }
    await request(app.getHttpServer())
      .patch('/me/books/1/spine')
      .send({ width: 40 })
      .expect(401);
    await request(app.getHttpServer())
      .put('/me/bookshelf')
      .send({ book_ids: [], revision: 0 })
      .expect(401);
  });
  it('removes a personal relationship without invoking catalog deletion', async () => {
    await request(app.getHttpServer())
      .delete('/me/books/1')
      .set('Authorization', 'Bearer valid-a')
      .expect(204);
    expect(library.remove).toHaveBeenCalled();
    expect(books.deleteBook).not.toHaveBeenCalled();
  });
  it.each(['patch', 'delete'] as const)(
    'blocks catalog %s even with a forged user_metadata admin role',
    async (method) => {
      await request(app.getHttpServer())
        [method]('/books/1')
        .set('Authorization', 'Bearer valid-a')
        .send({ title: 'Changed' })
        .expect(403);
      expect(books.updateBook).not.toHaveBeenCalled();
      expect(books.deleteBook).not.toHaveBeenCalled();
    },
  );
  it('allows a verified app_metadata administrator to edit catalog metadata', async () => {
    books.updateBook.mockResolvedValue({ id: 1, title: 'Changed' });
    await request(app.getHttpServer())
      .patch('/books/1')
      .set('Authorization', 'Bearer admin')
      .send({ title: 'Changed' })
      .expect(200);
    expect(books.updateBook).toHaveBeenCalled();
  });
  it('allows public signup but rejects role injection and weak passwords', async () => {
    auth.register.mockResolvedValue({ user: { id: 'new' }, session: null });
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'long-password' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'a@example.com',
        password: 'long-password',
        role: 'admin',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'short' })
      .expect(400);
    expect(auth.register).toHaveBeenCalledTimes(1);
  });
  it('returns login tokens with no-store', async () => {
    auth.login.mockResolvedValue({ session: { access_token: 'token' } });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'password' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
  });
  it('returns only the verified user identity', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer valid-a')
      .expect(200)
      .expect({ id: 'user-a', email: 'a@example.com' });
  });
  it('renews a session with the supplied refresh token', async () => {
    auth.refresh.mockResolvedValue({ session: { access_token: 'new' } });
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: 'refresh-a' })
      .expect(200);
    expect(auth.refresh).toHaveBeenCalledWith('refresh-a');
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(400);
  });
  it('requires a verified token to revoke the current session', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
    expect(auth.logout).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer valid-a')
      .expect(204);
    expect(auth.logout).toHaveBeenCalledWith('valid-a');
  });
});
