import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

export const supabaseProvider = {
  provide: SUPABASE_CLIENT,

  inject: [ConfigService],

  useFactory: (configService: ConfigService) => {
    const supabaseUrl = configService.getOrThrow<string>('VITE_SUPABASE_URL');
    const supabaseKey = configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  },
};
