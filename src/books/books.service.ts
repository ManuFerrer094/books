import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.provider';

@Injectable()
export class BooksService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async getBooks() {
  const { data, error } = await this.supabase
    .from('books')
    .select('*');

  if (error) {
    throw error;
  }

  return data;
}
}