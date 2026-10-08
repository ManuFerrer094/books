import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const messages: Record<number, string> = {
  400: 'Revisa los datos del libro e inténtalo de nuevo.',
  401: 'Tu sesión ha caducado. Vuelve a entrar para continuar.',
  403: 'No tienes permiso para hacer este cambio.',
  404: 'No hemos encontrado este libro. Puedes añadirlo a mano.',
  409: 'Este libro ya existe en el catálogo.',
  429: 'Hay demasiadas peticiones. Espera un momento y vuelve a intentarlo.',
  500: 'No hemos podido guardar el cambio. Inténtalo de nuevo.',
  503: 'No podemos consultar todos los catálogos ahora. Inténtalo luego o añade el libro a mano.',
};

export async function api<T>(
  path: string,
  init: RequestInit = {},
  expectedUserId?: string,
): Promise<T> {
  if (!supabase) throw new Error('La conexión todavía no está configurada.');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, messages[401]);
  if (expectedUserId && session.user.id !== expectedUserId)
    throw new ApiError(
      401,
      'La cuenta ha cambiado. Vuelve a abrir tu biblioteca.',
    );
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(90000)])
        : AbortSignal.timeout(90000),
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error(
      'No podemos conectar con tu biblioteca. Comprueba la conexión e inténtalo de nuevo.',
    );
  }
  if (!response.ok) {
    if (response.status === 503 && path === '/me/bookshelf') {
      let body: { code?: string } | null = null;
      try {
        body = await response.json();
      } catch {
        /* Keep the ordinary error for non-JSON responses. */
      }
      if (body?.code === 'BOOKSHELF_SCHEMA_OUTDATED')
        throw new ApiError(
          503,
          'El guardado de la estantería necesita una actualización del servidor. Tu borrador se conserva.',
        );
    }
    throw new ApiError(
      response.status,
      messages[response.status] ||
        'Algo no ha salido bien. Inténtalo de nuevo.',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Algo no ha salido bien. Inténtalo de nuevo.';
}
