// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookPersonalDetails from './BookPersonalDetails';
import type { LibraryBook } from './types';

const request = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({
  api: request,
  errorMessage: (error: Error) => error.message,
}));
const entry: LibraryBook = {
  book_id: 1,
  status: 'read',
  is_lent: false,
  lent_to: null,
  notes: null,
  rating: null,
  added_at: '2026-10-06',
  updated_at: '2026-10-06',
  book: {
    id: 1,
    title: 'Mi libro',
    authors: [],
    isbn: null,
    publisher: null,
    pages: null,
    language: null,
    publication_date: null,
    cover_url: null,
  },
};
function editor(custom: Partial<LibraryBook> = {}) {
  const props = {
    ownerId: 'user-a',
    entry: { ...entry, ...custom },
    disabled: false,
    onUpdated: vi.fn(),
    onBusy: vi.fn(),
  };
  const view = render(<BookPersonalDetails {...props} />);
  return { ...props, view };
}
beforeEach(() => request.mockReset());
afterEach(cleanup);
describe('préstamos, anotaciones y estrellas', () => {
  it('guarda el préstamo, destinatario, notas y 0 estrellas sin cambiar la lectura', async () => {
    const user = userEvent.setup();
    const props = editor();
    await user.click(screen.getByLabelText('Libro prestado'));
    await user.type(screen.getByLabelText('Prestado a'), 'Ana');
    await user.type(
      screen.getByLabelText('Mis anotaciones'),
      'Una idea\nOtra idea',
    );
    await user.click(screen.getByRole('radio', { name: '0 estrellas' }));
    const next = {
      ...entry,
      is_lent: true,
      lent_to: 'Ana',
      notes: 'Una idea\nOtra idea',
      rating: 0,
    };
    request.mockResolvedValue(next);
    await user.click(
      screen.getByRole('button', { name: 'Guardar datos personales' }),
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/me/books/1',
      {
        method: 'PATCH',
        body: JSON.stringify({
          is_lent: true,
          lent_to: 'Ana',
          notes: 'Una idea\nOtra idea',
          rating: 0,
        }),
      },
      'user-a',
    );
    expect(props.onUpdated).toHaveBeenCalledWith(next);
    expect(props.onBusy.mock.calls).toEqual([[true], [false]]);
  });
  it('conserva el borrador si falla, permite reintentar y distingue sin valorar', async () => {
    const user = userEvent.setup();
    editor({ rating: 5, notes: 'Anotación guardada' });
    await user.click(screen.getByRole('button', { name: 'Quitar valoración' }));
    expect(screen.getByText('Sin valorar')).toBeTruthy();
    request
      .mockRejectedValueOnce(new Error('No se pudo guardar'))
      .mockResolvedValueOnce({ ...entry, notes: 'Anotación guardada' });
    await user.click(
      screen.getByRole('button', { name: 'Guardar datos personales' }),
    );
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo guardar',
    );
    expect(
      (screen.getByLabelText('Mis anotaciones') as HTMLTextAreaElement).value,
    ).toBe('Anotación guardada');
    await user.click(
      screen.getByRole('button', { name: 'Guardar datos personales' }),
    );
    expect(request).toHaveBeenLastCalledWith(
      '/me/books/1',
      { method: 'PATCH', body: JSON.stringify({ rating: null }) },
      'user-a',
    );
  });
  it('devuelve el libro y limpia el destinatario sin sobrescribir notas ni estrellas', async () => {
    const user = userEvent.setup();
    editor({
      is_lent: true,
      lent_to: 'Ana',
      notes: 'Mis recuerdos',
      rating: 4,
    });
    await user.click(screen.getByLabelText('Libro prestado'));
    expect(screen.queryByLabelText('Prestado a')).toBeNull();
    request.mockResolvedValue({ ...entry, notes: 'Mis recuerdos', rating: 4 });
    await user.click(
      screen.getByRole('button', { name: 'Guardar datos personales' }),
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/me/books/1',
      {
        method: 'PATCH',
        body: JSON.stringify({ is_lent: false, lent_to: null }),
      },
      'user-a',
    );
  });
  it('permite cambiar las estrellas y descartar los cambios', async () => {
    const user = userEvent.setup();
    editor({ rating: 2 });
    const two = screen.getByRole('radio', { name: '2 estrellas' });
    await user.click(screen.getByRole('radio', { name: '3 estrellas' }));
    expect(
      (
        screen.getByRole('radio', {
          name: '3 estrellas',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect((two as HTMLInputElement).checked).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});
