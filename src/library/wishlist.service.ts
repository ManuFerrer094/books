import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { AuthClientFactory } from '../auth/auth-client.factory.js';
import type { AuthRequest } from '../auth/auth.guard.js';
import { CatalogQueryDto } from './wishlist.dto.js';

type Identity = Pick<AuthRequest, 'user' | 'accessToken'>;
const WISHLIST_SELECT =
  'book_id, added_at, books(id, title, isbn, publisher, publication_date, pages, language, cover_url, created_at, updated_at, book_authors(authors(id, name)))';
function wishlistBook(row: any) {
  const { book_authors = [], ...book } = row.books;
  return {
    book_id: row.book_id,
    added_at: row.added_at,
    book: { ...book, authors: book_authors.map((link: any) => link.authors) },
  };
}

@Injectable()
export class WishlistService {
  constructor(private readonly clients: AuthClientFactory) {}
  private fail(error: PostgrestError): never {
    if (error.code === '23503') throw new NotFoundException('Book not found');
    if (['22023', '23514'].includes(error.code))
      throw new BadRequestException('Invalid wishlist data');
    if (['42501', 'PGRST301'].includes(error.code))
      throw new UnauthorizedException('Access denied');
    throw new InternalServerErrorException(
      'Unable to access catalogue or wishlist',
    );
  }
  async catalog(identity: Identity, input: CatalogQueryDto) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .rpc('browse_catalog', {
        search_query: input.query.trim(),
        page_number: input.page,
        page_size: input.page_size,
      });
    if (error) this.fail(error);
    return data;
  }
  async list(identity: Identity) {
    const client = this.clients.create(identity.accessToken);
    const entries: ReturnType<typeof wishlistBook>[] = [];
    // Page through all wishes instead of silently losing entries at the row cap.
    const batchSize = 100;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await client
        .from('user_wishlist')
        .select(WISHLIST_SELECT)
        .eq('user_id', identity.user.id)
        .order('added_at', { ascending: false })
        .order('book_id', { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (error) this.fail(error);
      entries.push(...(data ?? []).map(wishlistBook));
      if (!data || data.length < batchSize) return entries;
    }
  }
  async add(identity: Identity, bookId: number) {
    const client = this.clients.create(identity.accessToken);
    const { error } = await client
      .from('user_wishlist')
      .upsert(
        { user_id: identity.user.id, book_id: bookId },
        { onConflict: 'user_id,book_id', ignoreDuplicates: true },
      );
    if (error) this.fail(error);
    const result = await client
      .from('user_wishlist')
      .select(WISHLIST_SELECT)
      .eq('user_id', identity.user.id)
      .eq('book_id', bookId)
      .maybeSingle();
    if (result.error) this.fail(result.error);
    if (!result.data) throw new NotFoundException('Wishlist book not found');
    return wishlistBook(result.data);
  }
  async remove(identity: Identity, bookId: number) {
    const { error } = await this.clients
      .create(identity.accessToken)
      .from('user_wishlist')
      .delete()
      .eq('user_id', identity.user.id)
      .eq('book_id', bookId);
    if (error) this.fail(error);
  }
}
