import { expect, type Page } from '@playwright/test';
import type {
  Book,
  LibraryBook,
  WishlistBook,
  BookshelfLayout,
} from '../src/types';
import {
  migrateDesign,
  reconcileDesign,
  validateDesign,
} from '../../src/library/bookshelf-design';

const fixtures = [
  ['El infinito en un junco', 'Irene Vallejo', 'pending'],
  ['El principito', 'Antoine de Saint-Exupéry', 'read'],
  ['La librería', 'Penelope Fitzgerald', 'reading'],
  ['Una habitación propia', 'Virginia Woolf', 'pending'],
  ['La elegancia del erizo', 'Muriel Barbery', 'pending'],
  ['El jardín secreto', 'Frances Hodgson Burnett', 'read'],
  ['Sobre el miedo', 'Jiddu Krishnamurti', 'reading'],
  ['La sombra del viento', 'Carlos Ruiz Zafón', 'pending'],
];
export function fixtureBooks(): LibraryBook[] {
  return fixtures.map(([title, author, status], index) => ({
    book_id: index + 1,
    status: status as LibraryBook['status'],
    added_at: '2026-10-04T09:00:00Z',
    updated_at: '2026-10-04T09:00:00Z',
    book: {
      id: index + 1,
      title,
      authors: [{ id: index + 1, name: author }],
      isbn: null,
      cover_url: null,
      publisher: 'Una editorial',
      publication_date: '2020-01-01',
      language: 'es',
      pages: 240,
    },
  }));
}
export async function setup(
  page: Page,
  options: {
    missing?: boolean;
    empty?: boolean;
    failPersonalOnce?: boolean;
    many?: boolean;
    count?: number;
    failShelfOnce?: boolean;
    staleShelfOnce?: boolean;
    failUploadOnce?: boolean;
    failSpineOnce?: boolean;
    brokenPhoto?: boolean;
    photo?: boolean;
    ambiguousPhotoOnce?: boolean;
    failMetadataOnce?: boolean;
    failCoverOnce?: boolean;
    failDetailsOnce?: boolean;
    ratings?: boolean;
    failWishOnce?: boolean;
    failWishlistOnce?: boolean;
    failCatalogOnce?: boolean;
  } = {},
) {
  let books = options.empty ? [] : fixtureBooks();
  if (options.ratings) {
    books[0].rating = 5;
    books[1].rating = 0;
  }
  const platformBooks = [
    ...fixtureBooks().map((entry) => ({ ...entry.book })),
    ...Array.from({ length: 18 }, (_, i) => ({
      ...fixtureBooks()[0].book,
      id: 300 + i,
      title: i === 0 ? 'Árboles de otro lector' : `Otra historia ${i}`,
      authors: [{ id: 99, name: 'María del Bosque' }],
      isbn: i === 0 ? '9788484454892' : null,
    })),
  ].sort((a, b) => a.title.localeCompare(b.title, 'es') || a.id - b.id);
  let wishlist: WishlistBook[] = [];
  let failWish = options.failWishOnce;
  let failWishlist = options.failWishlistOnce;
  let failCatalog = options.failCatalogOnce;
  if (options.many)
    for (let i = 9; i <= 24; i++)
      books.push({
        ...fixtureBooks()[i % 8],
        book_id: i,
        book: { ...fixtureBooks()[i % 8].book, id: i, title: `Historia ${i}` },
      });
  if (options.count)
    for (let i = books.length + 1; i <= options.count; i++)
      books.push({
        ...fixtureBooks()[i % 8],
        book_id: i,
        book: { ...fixtureBooks()[i % 8].book, id: i, title: `Historia ${i}` },
      });
  if (options.photo && books.length)
    books[0] = {
      ...books[0],
      spine: {
        color: '#a46145',
        width: 39,
        height: 188,
        image_path:
          'd052e849-4262-4878-b7a7-22687d835bc0/1/33333333-3333-4333-8333-333333333333.jpg',
      },
    };
  let layout: BookshelfLayout = {
    book_ids: books.map((entry) => entry.book_id),
    revision: 0,
    design: migrateDesign(books),
  };
  let failShelf = options.failShelfOnce;
  let staleShelf = options.staleShelfOnce;
  let failUpload = options.failUploadOnce;
  let failSpine = options.failSpineOnce;
  let failCover = options.failCoverOnce;
  let failDetails = options.failDetailsOnce;
  let ambiguous = options.ambiguousPhotoOnce;
  const deletedPhotos: string[] = [];
  const uploadedPhotos: { path: string; size: number }[] = [];
  let nextId = 100;
  const originalBooks = new Map(
    books.map((entry) => [entry.book_id, { ...entry.book }]),
  );
  const customizedMetadata = new Set<number>();
  let failMetadata = options.failMetadataOnce;
  let catalog: Book | null = null;
  let creates = 0;
  let fail = options.failPersonalOnce;
  const uuid = 'd052e849-4262-4878-b7a7-22687d835bc0';
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uuid, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
  const user = {
    id: uuid,
    email: 'lectora@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-04T09:00:00Z',
  };
  await page.route(/\/auth\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      json: path.endsWith('/signup')
        ? { user, session: null }
        : path.endsWith('/logout')
          ? {}
          : {
              access_token: token,
              refresh_token: 'test-refresh',
              expires_in: 3600,
              token_type: 'bearer',
              user,
            },
    });
  });
  await page.route(/\/storage\/v1\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === 'DELETE') {
      deletedPhotos.push(...route.request().postDataJSON().prefixes);
      return route.fulfill({ json: [] });
    }
    if (
      path.includes('/object/sign/') &&
      method === 'POST' &&
      route.request().postDataJSON().paths
    )
      return route.fulfill({
        json: route
          .request()
          .postDataJSON()
          .paths.map((file: string) => ({
            path: file,
            signedURL: `/object/sign/${path.split('/object/sign/')[1]}/${file}?token=fixture`,
            error: null,
          })),
      });
    if (path.includes('/object/sign/') && method === 'POST')
      return route.fulfill({
        json: {
          signedURL: `/object/sign/${path.split('/object/sign/')[1]}?token=fixture`,
        },
      });
    if (path.includes('/object/sign/') && method === 'GET') {
      if (options.brokenPhoto) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    }
    if (
      (path.includes('/object/book-spines/') ||
        path.includes('/object/book-covers/')) &&
      method === 'POST'
    ) {
      if (failUpload) {
        failUpload = false;
        return route.fulfill({
          status: 500,
          json: { message: 'Upload failed' },
        });
      }
      const key = path.split('/object/')[1];
      uploadedPhotos.push({
        path: key.replace(/^book-(spines|covers)\//, ''),
        size: route.request().postDataBuffer()?.length ?? 0,
      });
      return route.fulfill({ json: { Key: key, Id: 'photo-id' } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (!request.headers().authorization?.startsWith('Bearer ')) {
      await route.fulfill({ status: 401, json: {} });
      return;
    }
    const method = request.method();
    const body =
      method === 'POST' || method === 'PATCH' || method === 'PUT'
        ? request.postDataJSON()
        : null;
    if (path === '/me/books' && method === 'GET')
      return route.fulfill({ json: books });
    if (path === '/catalog' && method === 'GET') {
      if (failCatalog) {
        failCatalog = false;
        return route.fulfill({ status: 500, json: {} });
      }
      const params = new URL(request.url()).searchParams;
      const normalize = (text: string) =>
        text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      const term = normalize(params.get('query') ?? '');
      const matching = platformBooks.filter((book) =>
        normalize(
          `${book.title} ${book.authors.map((author) => author.name).join(' ')} ${book.isbn ?? ''}`,
        ).includes(term),
      );
      const pageNumber = Number(params.get('page') ?? 1),
        pageSize = Number(params.get('page_size') ?? 24);
      return route.fulfill({
        json: {
          books: matching.slice(
            (pageNumber - 1) * pageSize,
            pageNumber * pageSize,
          ),
          total: matching.length,
          page: pageNumber,
          page_size: pageSize,
        },
      });
    }
    if (path === '/me/wishlist' && method === 'GET') {
      if (failWishlist) {
        failWishlist = false;
        return route.fulfill({ status: 500, json: {} });
      }
      return route.fulfill({ json: wishlist });
    }
    if (
      (path === '/me/wishlist' && method === 'POST') ||
      (path.startsWith('/me/wishlist/') && method === 'DELETE')
    ) {
      if (failWish) {
        failWish = false;
        return route.fulfill({ status: 500, json: {} });
      }
      const bookId =
        method === 'POST' ? body.book_id : Number(path.split('/').at(-1));
      if (method === 'DELETE') {
        wishlist = wishlist.filter((entry) => entry.book_id !== bookId);
        return route.fulfill({ status: 204 });
      }
      const book = platformBooks.find((book) => book.id === bookId);
      if (!book) return route.fulfill({ status: 404, json: {} });
      let entry = wishlist.find((entry) => entry.book_id === bookId);
      if (!entry) {
        entry = { book_id: bookId, added_at: '2026-10-06T10:00:00Z', book };
        wishlist.push(entry);
      }
      return route.fulfill({ json: entry });
    }
    if (path === '/me/bookshelf' && method === 'GET') {
      const remaining = new Set(books.map((entry) => entry.book_id));
      const saved = layout.book_ids.filter((id) => {
        const found = remaining.has(id);
        remaining.delete(id);
        return found;
      });
      return route.fulfill({
        json: {
          ...layout,
          book_ids: [...saved, ...remaining],
          design: layout.design
            ? reconcileDesign(
                layout.design,
                books.map((book) => book.book_id),
              )
            : undefined,
        },
      });
    }
    if (path === '/me/bookshelf' && method === 'PUT') {
      if (failShelf) {
        failShelf = false;
        return route.fulfill({ status: 500, json: {} });
      }
      if (staleShelf) {
        staleShelf = false;
        layout = {
          book_ids: [...layout.book_ids].reverse(),
          revision: layout.revision + 1,
          design: migrateDesign([...books].reverse()),
        };
        return route.fulfill({ status: 409, json: {} });
      }
      if (body.revision !== layout.revision)
        return route.fulfill({ status: 409, json: {} });
      if (body.design) {
        try {
          validateDesign(
            body.design,
            books.map((b) => b.book_id),
          );
        } catch {
          return route.fulfill({ status: 400, json: {} });
        }
      }
      layout = {
        book_ids: body.book_ids,
        revision: layout.revision + 1,
        design: body.design,
      };
      return route.fulfill({ json: layout });
    }
    if (path === '/books' && method === 'POST') {
      creates++;
      catalog = {
        ...fixtureBooks()[0].book,
        ...body,
        id: nextId++,
        authors: body.authors.map((author: { name: string }, i: number) => ({
          ...author,
          id: i + 100,
        })),
      };
      return route.fulfill({ json: catalog });
    }
    if (
      (path === '/me/books/isbn' || path === '/me/books') &&
      method === 'POST'
    ) {
      if (options.missing && path.endsWith('/isbn'))
        return route.fulfill({
          status: 404,
          json: { message: 'Book not found' },
        });
      if (fail && path === '/me/books') {
        fail = false;
        return route.fulfill({ status: 503, json: {} });
      }
      const existing = books.find(
        (entry) =>
          (entry.book.isbn && entry.book.isbn === body.isbn) ||
          entry.book_id === body.book_id,
      );
      const entry: LibraryBook = existing || {
        ...fixtureBooks()[0],
        book_id: catalog?.id || nextId++,
        status: body.status || 'pending',
        book: catalog || {
          ...fixtureBooks()[0].book,
          id: nextId - 1,
          isbn: body.isbn,
          title: 'Un libro recién llegado',
        },
      };
      if (!existing) {
        books.push(entry);
        layout = {
          ...layout,
          book_ids: [...layout.book_ids, entry.book_id],
          revision: layout.revision + 1,
        };
      }
      return route.fulfill({ json: entry });
    }
    const id = Number(path.split('/')[3]);
    if (
      path.endsWith('/metadata') &&
      (method === 'PATCH' || method === 'DELETE')
    ) {
      if (failMetadata) {
        failMetadata = false;
        return route.fulfill({ status: 500, json: {} });
      }
      const entry = books.find((item) => item.book_id === id);
      if (!entry) return route.fulfill({ status: 404, json: {} });
      const previousPhoto = entry.book.cover_image_path;
      entry.book =
        method === 'DELETE'
          ? { ...originalBooks.get(id)! }
          : { ...entry.book, ...body };
      if (method === 'DELETE') customizedMetadata.delete(id);
      else if (Object.keys(body).length) customizedMetadata.add(id);
      entry.customized =
        customizedMetadata.has(id) || !!entry.book.cover_image_path;
      if (method === 'DELETE' && previousPhoto) {
        deletedPhotos.push(previousPhoto);
      }
      return route.fulfill({ json: entry });
    }
    if (path.endsWith('/cover') && method === 'PATCH') {
      if (failCover) {
        failCover = false;
        return route.fulfill({ status: 500, json: {} });
      }
      const entry = books.find((item) => item.book_id === id)!;
      const previous = entry.book.cover_image_path;
      entry.book.cover_image_path = body.image_path;
      entry.customized = !!body.image_path || customizedMetadata.has(id);
      if (previous && previous !== body.image_path)
        deletedPhotos.push(previous);
      if (ambiguous) {
        ambiguous = false;
        return route.abort('failed');
      }
      return route.fulfill({ json: entry });
    }
    if (path.endsWith('/spine') && method === 'PATCH') {
      if (failSpine) {
        failSpine = false;
        return route.fulfill({ status: 500, json: {} });
      }
      const entry = books.find((b) => b.book_id === id)!;
      const previous = entry.spine?.image_path;
      entry.spine = {
        color: null,
        width: null,
        height: null,
        image_path: null,
        ...entry.spine,
        ...body,
      };
      if (previous && previous !== body.image_path)
        deletedPhotos.push(previous);
      if (ambiguous) {
        ambiguous = false;
        return route.abort('failed');
      }
      return route.fulfill({ json: entry });
    }
    if (method === 'GET') {
      const entry = books.find((b) => b.book_id === id);
      return route.fulfill(entry ? { json: entry } : { status: 404, json: {} });
    }
    if (method === 'PATCH') {
      if (failDetails) {
        failDetails = false;
        return route.fulfill({ status: 500, json: {} });
      }
      const entry = books.find((b) => b.book_id === id)!;
      Object.assign(entry, body);
      if (body.is_lent === false) entry.lent_to = null;
      return route.fulfill({ json: entry });
    }
    if (method === 'DELETE') {
      books = books.filter((b) => b.book_id !== id);
      layout = {
        ...layout,
        book_ids: layout.book_ids.filter((bookId) => bookId !== id),
        revision: layout.revision + 1,
        design: layout.design
          ? reconcileDesign(
              layout.design,
              books.map((book) => book.book_id),
            )
          : undefined,
      };
      return route.fulfill({ status: 204 });
    }
    await route.fulfill({ status: 404, json: {} });
  });
  return {
    getCreates: () => creates,
    getLayout: () => layout,
    getBooks: () => books,
    getWishlist: () => wishlist,
    getDeletedPhotos: () => deletedPhotos,
    getUploadedPhotos: () => uploadedPhotos,
  };
}
export async function login(page: Page, covers = true) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Tu correo').fill('lectora@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('una-clave-de-prueba');
  await page.getByRole('button', { name: 'Entrar en mi biblioteca' }).click();
  await expect(
    page.getByRole('heading', { name: 'Todos mis libros' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Añadir un libro', exact: true }).first(),
  ).toBeEnabled();
  if (covers)
    await page.getByRole('button', { name: 'Portadas', exact: true }).click();
}
