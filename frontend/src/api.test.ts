import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth } }));
beforeEach(() => {
  vi.restoreAllMocks();
  auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'user-token', user: { id: 'user-a' } } },
  });
});
describe('cliente de biblioteca', () => {
  it('identifica el servidor sin migrar y conserva mensajes genéricos sin revelar SQL', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'BOOKSHELF_SCHEMA_OUTDATED',
            message: 'Private SQL',
          }),
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Private SQL' }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(
        new Response('proxy unavailable', { status: 503 }),
      );
    await expect(api('/me/bookshelf', { method: 'PUT' })).rejects.toMatchObject(
      {
        status: 503,
        message: expect.stringContaining('Tu borrador se conserva'),
      },
    );
    await expect(api('/me/bookshelf', { method: 'PUT' })).rejects.toMatchObject(
      { status: 500, message: expect.not.stringContaining('Private SQL') },
    );
    await expect(api('/me/bookshelf', { method: 'PUT' })).rejects.toMatchObject(
      { status: 503, message: expect.stringContaining('catálogos') },
    );
  });
  it('envía la identidad del usuario a la API', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await expect(api('/me/books')).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith(
      '/api/me/books',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer user-token',
        }),
      }),
    );
  });
  it('no consulta datos personales sin sesión', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const request = vi.spyOn(globalThis, 'fetch');
    await expect(api('/me/books')).rejects.toBeInstanceOf(ApiError);
    expect(request).not.toHaveBeenCalled();
  });
  it('impide que un guardado pendiente se aplique a una cuenta diferente', async () => {
    const request = vi.spyOn(globalThis, 'fetch');
    await expect(
      api('/me/bookshelf', { method: 'PUT' }, 'user-b'),
    ).rejects.toMatchObject({ status: 401 });
    expect(request).not.toHaveBeenCalled();
  });
  it('acepta una eliminación sin body y comunica los catálogos no disponibles', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(
      api('/me/books/1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
    await expect(
      api('/me/books/isbn', { method: 'POST' }),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('a mano'),
    });
  });
});
