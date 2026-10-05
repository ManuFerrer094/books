import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { LibraryController } from '../library/library.controller.js';
import { LibraryService } from '../library/library.service.js';
import { BooksController } from '../books/books.controller.js';
import { BooksService } from '../books/books.service.js';
import { IsbnLookupService } from '../books/isbn-lookup.service.js';

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
  };
  const books = {
    getBooks: jest.fn<any>(),
    getBook: jest.fn<any>(),
    createBook: jest.fn<any>(),
    updateBook: jest.fn<any>(),
    deleteBook: jest.fn<any>(),
  };
  const lookup = { lookup: jest.fn<any>() };
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
    const module = await Test.createTestingModule({
      controllers: [AuthController, LibraryController, BooksController],
      providers: [
        AuthGuard,
        AdminGuard,
        { provide: AuthService, useValue: auth },
        { provide: LibraryService, useValue: library },
        { provide: BooksService, useValue: books },
        { provide: IsbnLookupService, useValue: lookup },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it.each(['/me/books', '/auth/me', '/books', '/books/isbn/9780140328721'])(
    'requires authentication for %s',
    async (url) => {
      await request(app.getHttpServer()).get(url).expect(401);
      expect(auth.verify).not.toHaveBeenCalled();
      expect(lookup.lookup).not.toHaveBeenCalled();
    },
  );
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
  it('requires a status for library updates', async () => {
    await request(app.getHttpServer())
      .patch('/me/books/1')
      .set('Authorization', 'Bearer valid-a')
      .send({})
      .expect(400);
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
