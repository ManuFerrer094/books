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

const BOOK_SELECT = '*, book_authors(authors(id, name))';

function withAuthors(row: any) {
  const { book_authors = [], ...book } = row;
  return { ...book, authors: book_authors.map((link: any) => link.authors) };
}

@Injectable()
export class BooksService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getBooks() {
    const { data, error } = await this.supabase
      .from('books')
      .select(BOOK_SELECT);
    if (error) this.handleError(error);
    return (data ?? []).map(withAuthors);
  }

  async getBook(id: number) {
    const { data, error } = await this.supabase
      .from('books')
      .select(BOOK_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) this.handleError(error);
    if (!data) throw new NotFoundException('Book not found');
    return withAuthors(data);
  }

  async findByIsbns(isbns: string[]) {
    const { data, error } = await this.supabase
      .from('books')
      .select(BOOK_SELECT)
      .in('isbn', isbns)
      .order('id')
      .limit(1)
      .maybeSingle();
    if (error) this.handleError(error);
    return data ? withAuthors(data) : null;
  }

  async createBook(book: CreateBookDto) {
    const { data, error } = await this.supabase.rpc(
      'create_book_with_authors',
      {
        payload: book,
      },
    );
    if (error) this.handleError(error);
    return data;
  }

  async updateBook(id: number, book: Partial<UpdateBookDto>) {
    if (book.authors !== undefined) {
      const { data, error } = await this.supabase.rpc(
        'update_book_with_authors',
        {
          target_id: id,
          payload: book,
        },
      );
      if (error) this.handleError(error);
      if (!data) throw new NotFoundException('Book not found');
      return data;
    }
    const { data, error } = await this.supabase
      .from('books')
      .update({ ...book, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(BOOK_SELECT)
      .maybeSingle();
    if (error) this.handleError(error);
    if (!data) throw new NotFoundException('Book not found');
    return withAuthors(data);
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
