import type { SupabaseClient } from '@supabase/supabase-js';

const authParameters = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'provider_token',
  'provider_refresh_token',
  'type',
  'code',
  'sb_flow_id',
  'error',
  'error_code',
  'error_description',
  'sb',
];
const callbackParameters = [
  'access_token',
  'refresh_token',
  'code',
  'error',
  'error_code',
  'error_description',
];

export function emailRedirectUrl() {
  // A canonical URL can be configured for production; local development and
  // previews otherwise return to the frontend that initiated registration.
  return new URL('/', import.meta.env.VITE_SITE_URL || window.location.origin)
    .href;
}

export function passwordRecoveryUrl() {
  return new URL('/recuperar-contrasena', emailRedirectUrl()).href;
}

export function isRecoveryCallback() {
  const url = new URL(window.location.href);
  return (
    (new URLSearchParams(url.hash.slice(1)).get('type') ||
      url.searchParams.get('type')) === 'recovery'
  );
}

export async function initializeAuthRedirect(client: SupabaseClient) {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const queryCallback = callbackParameters.some((key) =>
    url.searchParams.has(key),
  );
  const hashCallback = callbackParameters.some((key) => hash.has(key));
  const isCallback = queryCallback || hashCallback;
  const recovery =
    url.pathname === '/recuperar-contrasena' || isRecoveryCallback();
  const expired =
    (hash.get('error_code') || url.searchParams.get('error_code')) ===
    'otp_expired';
  try {
    // Let Supabase validate and persist the session before removing credentials.
    // getSession alone does not expose an error from a confirmation redirect.
    const { error } = await client.auth.initialize();
    if (error) {
      if (expired)
        return recovery
          ? 'El enlace para recuperar tu contraseña ha caducado o ya se ha utilizado. Solicita uno nuevo.'
          : 'El enlace de confirmación ha caducado o ya se ha utilizado. Prueba a entrar o solicita un nuevo correo.';
      if (recovery)
        return 'No hemos podido validar este enlace de recuperación. Solicita uno nuevo.';
      return isCallback
        ? 'No hemos podido confirmar tu cuenta con este enlace. Prueba a entrar o solicita un nuevo correo.'
        : 'No hemos podido recuperar tu sesión. Inténtalo de nuevo.';
    }
    return '';
  } catch {
    return 'No podemos conectar ahora. Comprueba tu conexión e inténtalo de nuevo.';
  } finally {
    if (isCallback) {
      if (queryCallback)
        authParameters.forEach((key) => url.searchParams.delete(key));
      if (hashCallback) {
        authParameters.forEach((key) => hash.delete(key));
        url.hash = hash.toString();
      }
      // Replace the current history entry on success and failure alike.
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search + url.hash,
      );
    }
  }
}
