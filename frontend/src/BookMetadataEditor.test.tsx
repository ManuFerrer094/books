// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookMetadataEditor from './BookMetadataEditor';
import type { LibraryBook } from './types';

const request = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({
  api: request,
  errorMessage: (error: Error) => error.message,
}));
const entry: LibraryBook = {
  book_id: 1,
  status: 'reading',
  added_at: '2026-10-04',
  updated_at: '2026-10-04',
  book: {
    id: 1,
    title: 'Título original',
    authors: [],
    isbn: '9780140328721',
    publisher: 'Editorial original',
    publication_date: '2020-01-01',
    pages: 200,
    language: 'es',
    cover_url: null,
  },
};
function editor(customized = false) {
  const props = {
    ownerId: 'user-a',
    entry: { ...entry, customized },
    onUpdated: vi.fn(),
    onClose: vi.fn(),
    onBusy: vi.fn(),
  };
  render(<BookMetadataEditor {...props} />);
  return props;
}
beforeEach(() => request.mockReset());
afterEach(cleanup);
describe('edición de mi libro', () => {
  it('añade autores y guarda solo los campos editados para el propietario', async () => {
    const user = userEvent.setup();
    const props = editor();
    const saved = {
      ...entry,
      customized: true,
      book: {
        ...entry.book,
        title: 'Mi título',
        authors: [{ name: 'Mi autor' }],
      },
    };
    request.mockResolvedValue(saved);
    await user.clear(screen.getByLabelText('Título'));
    await user.paste('Mi título');
    await user.click(screen.getByRole('button', { name: 'Añadir autor' }));
    await user.click(screen.getByLabelText('Autor 1'));
    await user.paste('Mi autor');
    await user.click(screen.getByLabelText('URL de la portada'));
    await user.paste('https://example.com/cover.jpg');
    await user.clear(screen.getByLabelText('Editorial'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/me/books/1/metadata',
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Mi título',
          authors: [{ name: 'Mi autor' }],
          publisher: null,
          cover_url: 'https://example.com/cover.jpg',
        }),
      },
      'user-a',
    );
    expect(props.onUpdated).toHaveBeenCalledWith(saved);
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(entry.book.title).toBe('Título original');
  });
  it('conserva el borrador si falla y permite reintentar', async () => {
    const user = userEvent.setup();
    const props = editor();
    request
      .mockRejectedValueOnce(new Error('No se pudo guardar'))
      .mockResolvedValueOnce(entry);
    await user.clear(screen.getByLabelText('Título'));
    await user.paste('Mi título');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo guardar',
    );
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(
      'Mi título',
    );
    expect(props.onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(props.onBusy.mock.calls).toEqual([[true], [false], [true], [false]]);
  });
  it('cancela sin guardar y exige confirmar antes de restaurar', async () => {
    const user = userEvent.setup();
    const props = editor(true);
    await user.click(screen.getByRole('button', { name: 'Cancelar edición' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    props.onClose.mockClear();
    request.mockResolvedValue(entry);
    await user.click(
      screen.getByRole('button', { name: 'Restaurar datos del catálogo' }),
    );
    expect(request).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sí, restaurar' }));
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/me/books/1/metadata',
      { method: 'DELETE' },
      'user-a',
    );
    expect(props.onUpdated).toHaveBeenCalledWith(entry);
  });
});
