import { ConfigService } from '@nestjs/config';
import { AuthClientFactory } from './auth-client.factory';

describe('AuthClientFactory', () => {
  it('creates independent clients with a public key, never the catalog secret', () => {
    const factory = new AuthClientFactory(
      new ConfigService({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
        SUPABASE_SERVICE_ROLE_KEY: 'private-catalog-key',
      }),
    );
    const first = factory.create('token-a');
    const second = factory.create('token-b');
    expect(first).not.toBe(second);
    expect((first as any).supabaseKey).toBe('public-test-key');
    expect((first as any).headers.Authorization).toBe('Bearer token-a');
    expect((second as any).headers.Authorization).toBe('Bearer token-b');
    expect((first.auth as any).persistSession).toBe(false);
    expect((first.auth as any).autoRefreshToken).toBe(false);
  });
  it('requires a separate public auth key instead of silently bypassing RLS', () => {
    const factory = new AuthClientFactory(
      new ConfigService({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'catalog-secret',
      }),
    );
    expect(() => factory.create()).toThrow('VITE_SUPABASE_PUBLISHABLE_KEY');
  });
  it('rejects a server secret in the public auth variable', () => {
    const factory = new AuthClientFactory(
      new ConfigService({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test',
      }),
    );
    expect(() => factory.create()).toThrow('publishable or anon');
  });
});
