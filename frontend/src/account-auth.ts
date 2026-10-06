import { supabase } from './supabase';

export function accountAuthError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  const message = error instanceof Error ? error.message : '';
  if (/rate limit|too many/i.test(message) || code.includes('rate_limit'))
    return 'Espera un momento antes de volver a intentarlo.';
  if (code === 'same_password')
    return 'Elige una contraseña distinta de la actual.';
  if (code === 'weak_password' || /weak password/i.test(message))
    return 'La contraseña no cumple las reglas de seguridad. Prueba con una más larga.';
  if (
    /current[ _-]password|invalid_credentials|invalid login/i.test(
      `${code} ${message}`,
    )
  )
    return 'La contraseña actual no es correcta.';
  if (/session|jwt|token/i.test(`${code} ${message}`))
    return 'Vuelve a entrar o solicita un nuevo enlace para recuperar la contraseña.';
  return 'No hemos podido completar el cambio. Inténtalo de nuevo.';
}

export async function changePassword(
  ownerId: string,
  password: string,
  currentPassword?: string,
) {
  const {
    data: { session },
  } = await supabase!.auth.getSession();
  if (session?.user.id !== ownerId)
    throw new Error('La cuenta ha cambiado. Vuelve a entrar.');
  const { error } = await supabase!.auth.updateUser({
    password,
    ...(currentPassword !== undefined
      ? { current_password: currentPassword }
      : {}),
  });
  if (error) throw error;
}
