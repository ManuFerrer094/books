import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.provider';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getBooks() {
    const { data, error } = await this.supabase.from('books').select('*');
    if (error) this.handleError(error);
    return data;
  }

  async getBook(id: number) {
    const { data, error } = await this.supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) this.handleError(error);
    if (!data) throw new NotFoundException('Book not found');
    return data;
  }

  async createBook(book: CreateBookDto) {
    const { data, error } = await this.supabase
      .from('books')
      .insert(book)
      .select('*')
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async updateBook(id: number, book: Partial<UpdateBookDto>) {
    const { data, error } = await this.supabase
      .from('books')
      .update({ ...book, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) this.handleError(error);
    if (!data) throw new NotFoundException('Book not found');
    return data;
  }

  async deleteBook(id: number) {
    const { data, error } = await this.supabase
      .from('books')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) this.handleError(error);
    if (!data) throw new NotFoundException('Book not found');
  }

  private handleError(error: PostgrestError): never {
    if (error.code === '23505')
      throw new ConflictException('Book already exists');
    if (
      [
        '23502',
        '23503',
        '23514',
        '22001',
        '22003',
        '22007',
        '22008',
        '22P02',
      ].includes(error.code)
    ) {
      throw new BadRequestException('Invalid book data');
    }
    throw new InternalServerErrorException('Unable to access books');
  }
}
