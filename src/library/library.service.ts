import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { AuthClientFactory } from '../auth/auth-client.factory';
import { IsbnLookupService } from '../books/isbn-lookup.service';
import type { AuthRequest } from '../auth/auth.guard';
import {
  AddLibraryBookDto,
  AddLibraryIsbnDto,
  ReadingStatus,
  UpdateLibraryBookDto,
} from './library.dto';

const LIBRARY_SELECT =
  'book_id, status, added_at, updated_at, books(*, book_authors(authors(id, name)))';
type Identity = Pick<AuthRequest, 'user' | 'accessToken'>;

function libraryBook(row: any) {
  const { books, ...entry } = row;
  const { book_authors = [], ...book } = books;
  return {
    ...entry,
    book: { ...book, authors: book_authors.map((link: any) => link.authors) },
  };
}

@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(
    private readonly clients: AuthClientFactory,
    private readonly lookup: IsbnLookupService,
  ) {}

  private fail(error: PostgrestError): never {
    // Log only the diagnostic code, without query data or credentials.
    this.logger.error(`Supabase library query failed (code: ${error.code || 'unknown'})`);
    if (error.code === '23503') throw new NotFoundException('Book not found');
    if (error.code === '23505')
      throw new ConflictException('Book already in library');
    if (error.code === '42501' || error.code === 'PGRST301')
      throw new UnauthorizedException('Library access denied');
    throw new InternalServerErrorException('Unable to access library');
  }

  async list(identity: Identity) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .from('user_books')
      .select(LIBRARY_SELECT)
      .eq('user_id', identity.user.id)
      .order('added_at', { ascending: false });
    if (error) this.fail(error);
    return (data ?? []).map(libraryBook);
  }

  async get(identity: Identity, bookId: number) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .from('user_books')
      .select(LIBRARY_SELECT)
      .eq('user_id', identity.user.id)
      .eq('book_id', bookId)
      .maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Book not found in your library');
    return libraryBook(data);
  }

  async add(identity: Identity, input: AddLibraryBookDto) {
    const { error } = await this.clients
      .create(identity.accessToken)
      .from('user_books')
      .upsert(
        {
          user_id: identity.user.id,
          book_id: input.book_id,
          status: input.status ?? ReadingStatus.Pending,
        },
        { onConflict: 'user_id,book_id', ignoreDuplicates: true },
      );
    if (error) this.fail(error);
    // An existing entry keeps its original status and dates.
    return this.get(identity, input.book_id);
  }

  async addByIsbn(identity: Identity, input: AddLibraryIsbnDto) {
    const result = await this.lookup.lookup(input.isbn);
    return this.add(identity, {
      book_id: result.book.id,
      status: input.status,
    });
  }

  async update(
    identity: Identity,
    bookId: number,
    input: UpdateLibraryBookDto,
  ) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .from('user_books')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('user_id', identity.user.id)
      .eq('book_id', bookId)
      .select(LIBRARY_SELECT)
      .maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Book not found in your library');
    return libraryBook(data);
  }

  async remove(identity: Identity, bookId: number) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .from('user_books')
      .delete()
      .eq('user_id', identity.user.id)
      .eq('book_id', bookId)
      .select('book_id')
      .maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Book not found in your library');
  }
}
