import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { AuthClientFactory } from '../auth/auth-client.factory.js';
import { IsbnLookupService } from '../books/isbn-lookup.service.js';
import type { AuthRequest } from '../auth/auth.guard.js';
import {
  AddLibraryBookDto,
  AddLibraryIsbnDto,
  ReadingStatus,
  UpdateLibraryBookDto,
} from './library.dto.js';
import { BookshelfDto, SpineDto } from './bookshelf.dto.js';
import { PersonalBookMetadataDto } from './book-metadata.dto.js';

const LIBRARY_SELECT =
  'book_id, status, added_at, updated_at, metadata, spine_color, spine_width, spine_height, spine_image_path, books(*, book_authors(authors(id, name)))';
type Identity = Pick<AuthRequest, 'user' | 'accessToken'>;

function libraryBook(row: any) {
  const {
    books,
    metadata = {},
    spine_color,
    spine_width,
    spine_height,
    spine_image_path,
    ...entry
  } = row;
  const { book_authors = [], ...book } = books;
  return {
    ...entry,
    spine: {
      color: spine_color ?? null,
      width: spine_width ?? null,
      height: spine_height ?? null,
      image_path: spine_image_path ?? null,
    },
    customized: Object.keys(metadata).length > 0,
    book: {
      ...book,
      authors: book_authors.map((link: any) => link.authors),
      ...metadata,
    },
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
    this.logger.error(
      `Supabase library query failed (code: ${error.code || 'unknown'})`,
    );
    if (error.code === '23503') throw new NotFoundException('Book not found');
    if (error.code === '40001')
      throw new ConflictException('Bookshelf changed');
    if (error.code === '22023' || error.code === '23514')
      throw new BadRequestException('Invalid library data');
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

  async bookshelf(identity: Identity) {
    const client = this.clients.create(identity.accessToken);
    const [layout, library] = await Promise.all([
      client
        .from('user_bookshelf')
        .select('book_ids, revision')
        .eq('user_id', identity.user.id)
        .maybeSingle(),
      client
        .from('user_books')
        .select('book_id, added_at')
        .eq('user_id', identity.user.id)
        .order('added_at', { ascending: true })
        .order('book_id', { ascending: true }),
    ]);
    if (layout.error) this.fail(layout.error);
    if (library.error) this.fail(library.error);
    const currentIds = (library.data ?? []).map(
      (entry) => entry.book_id as number,
    );
    const remaining = new Set(currentIds);
    const ordered = ((layout.data?.book_ids ?? []) as number[]).filter((id) => {
      const exists = remaining.has(id);
      remaining.delete(id);
      return exists;
    });
    return {
      book_ids: [...ordered, ...currentIds.filter((id) => remaining.has(id))],
      revision: layout.data?.revision ?? 0,
    };
  }

  async updateMetadata(
    identity: Identity,
    bookId: number,
    input: PersonalBookMetadataDto | null,
  ) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .rpc('update_personal_book_metadata', {
        requested_book_id: bookId,
        metadata_patch: input,
      });
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Book not found in your library');
    return this.get(identity, bookId);
  }

  async saveBookshelf(identity: Identity, input: BookshelfDto) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .rpc('save_bookshelf_order', {
        requested_book_ids: input.book_ids,
        expected_revision: input.revision,
      });
    if (error) this.fail(error);
    return data;
  }

  async updateSpine(identity: Identity, bookId: number, input: SpineDto) {
    const previous = await this.get(identity, bookId);
    const client = this.clients.create(identity.accessToken);
    if (input.image_path) {
      const prefix = `${identity.user.id}/${bookId}/`;
      if (!input.image_path.startsWith(prefix))
        throw new BadRequestException('Invalid spine image owner');
      const filename = input.image_path.slice(prefix.length);
      const { data, error } = await client.storage
        .from('book-spines')
        .list(prefix.slice(0, -1), { search: filename });
      if (error) throw new BadRequestException('Unable to verify spine image');
      if (!data?.some((file) => file.name === filename))
        throw new BadRequestException('Spine image not found');
    }
    const fields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of ['color', 'width', 'height', 'image_path'] as const) {
      if (input[key] !== undefined) fields[`spine_${key}`] = input[key];
    }
    const { data, error } = await client
      .from('user_books')
      .update(fields)
      .eq('user_id', identity.user.id)
      .eq('book_id', bookId)
      .select(LIBRARY_SELECT)
      .maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Book not found in your library');
    const next = libraryBook(data);
    if (
      previous.spine.image_path &&
      previous.spine.image_path !== next.spine.image_path
    ) {
      await this.removeSpineImage(identity, previous.spine.image_path);
    }
    return next;
  }

  private async removeSpineImage(identity: Identity, path: string) {
    try {
      const { error } = await this.clients
        .create(identity.accessToken)
        .storage.from('book-spines')
        .remove([path]);
      if (error) this.logger.warn('Unable to clean up a spine image');
    } catch {
      this.logger.warn('Unable to clean up a spine image');
    }
  }

  async remove(identity: Identity, bookId: number) {
    const { data, error } = await this.clients
      .create(identity.accessToken)
      .from('user_books')
      .delete()
      .eq('user_id', identity.user.id)
      .eq('book_id', bookId)
      .select('book_id, spine_image_path')
      .maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Book not found in your library');
    if (data.spine_image_path)
      await this.removeSpineImage(identity, data.spine_image_path);
  }
}
