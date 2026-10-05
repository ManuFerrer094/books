import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AuthClientFactory {
  constructor(private readonly config: ConfigService) {}

  create(accessToken?: string) {
    // A fresh client prevents one user's sign-in/refresh from changing another
    // request's Authorization header or the shared catalog service client.
    const publicKey = this.config.getOrThrow<string>('VITE_SUPABASE_PUBLISHABLE_KEY');
    let isSecret = publicKey.startsWith('sb_secret_');
    if (publicKey.split('.').length === 3) {
      try {
        isSecret ||=
          JSON.parse(
            Buffer.from(publicKey.split('.')[1], 'base64url').toString(),
          ).role === 'service_role';
      } catch {}
    }
    if (isSecret)
      throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or anon key');
    return createClient(
      this.config.getOrThrow<string>('VITE_SUPABASE_URL'),
      publicKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {},
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal ?? AbortSignal.timeout(10000),
            }),
        },
      },
    );
  }
}
