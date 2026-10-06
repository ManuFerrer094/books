import { createClient } from '@supabase/supabase-js';
import { initializeAuthRedirect, isRecoveryCallback } from './auth-redirect';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Capture the recovery intent before Supabase/URL cleanup consumes the hash.
export const recoveryCallback = isRecoveryCallback();
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Share URL processing between React StrictMode mounts. Supabase initialization
// is also idempotent; the URL must only be captured/cleaned once.
let initialization: Promise<string> | undefined;
export function initializeAuth() {
  return (initialization ??= supabase
    ? initializeAuthRedirect(supabase)
    : Promise.resolve(''));
}
