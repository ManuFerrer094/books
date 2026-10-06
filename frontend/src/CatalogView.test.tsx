// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogView from './CatalogView';
import type { Book, CatalogPage, WishlistBook } from './types';

const request = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({
  api: request,
  errorMessage: (error: Error) => error.message,
}));
// These tests exercise request ordering; the real covers and native dialog run in Playwright.
vi.mock('./components', () => ({
  Cover: () => <div />,
  Feedback: ({ error }: { error: string }) =>
    error ? <p role="alert">{error}</p> : null,
}));
const book: Book = {
  id: 7,
  title: 'Historia compartida',
  authors: [],
  isbn: null,
  publisher: null,
  pages: null,
  language: null,
  publication_date: null,
  cover_url: null,
};
const pageResult: CatalogPage = {
  books: [book],
  total: 1,
  page: 1,
  page_size: 24,
};
function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function view() {
  const props = {
    mode: 'catalog' as const,
    ownerId: 'reader-a',
    wishlist: [] as WishlistBook[],
    wishlistLoading: false,
    wishlistError: '',
    onRetryWishlist: vi.fn(),
    onAddedWish: vi.fn(),
    onRemovedWish: vi.fn(),
    onExplore: vi.fn(),
  };
  return { ...render(<CatalogView {...props} />), props };
}
beforeEach(() => request.mockReset());
afterEach(cleanup);
describe('peticiones del catálogo y deseos', () => {
  it('ignora una respuesta anterior cuando ya hay una búsqueda más reciente', async () => {
    const old = deferred<CatalogPage>();
    request
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({
        ...pageResult,
        books: [{ ...book, id: 8, title: 'Resultado reciente' }],
      });
    const user = userEvent.setup();
    view();
    const signal = request.mock.calls[0][1].signal as AbortSignal;
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar en el catálogo' }),
      'reciente',
    );
    await user.click(
      screen.getByRole('button', { name: 'Buscar' }),
    );
    await screen.findByRole('button', { name: 'Ver Resultado reciente' });
    expect(signal.aborted).toBe(true);
    expect(request.mock.calls[1][0]).toBe(
      '/catalog?query=reciente&page=1&page_size=24',
    );
    await act(async () => old.resolve(pageResult));
    expect(
      screen.queryByRole('button', { name: 'Ver Historia compartida' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Ver Resultado reciente' }),
    ).toBeTruthy();
  });
  it('impide envíos simultáneos y conserva los deseos si falla, permitiendo reintentar', async () => {
    const pending = deferred<WishlistBook>();
    request
      .mockResolvedValueOnce(pageResult)
      .mockRejectedValueOnce(new Error('Cambio no guardado'))
      .mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    const { props } = view();
    const save = await screen.findByRole('button', {
      name: 'Guardar deseo: Historia compartida',
    });
    await user.click(save);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cambio no guardado',
    );
    expect(props.onAddedWish).not.toHaveBeenCalled();
    await user.click(save);
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.click(save);
    expect(request).toHaveBeenCalledTimes(3);
    const wish = { book_id: book.id, added_at: 'original', book };
    await act(async () => pending.resolve(wish));
    await waitFor(() =>
      expect(props.onAddedWish).toHaveBeenCalledExactlyOnceWith(wish),
    );
    expect(request.mock.calls[2]).toEqual([
      '/me/wishlist',
      { method: 'POST', body: JSON.stringify({ book_id: 7 }) },
      'reader-a',
    ]);
  });
});
