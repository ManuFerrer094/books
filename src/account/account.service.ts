import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../books/supabase.provider.js';
import { AuthClientFactory } from '../auth/auth-client.factory.js';
import type { AuthRequest } from '../auth/auth.guard.js';
import { LIBRARY_SELECT, libraryBook } from '../library/library.service.js';
import { WISHLIST_SELECT, wishlistBook } from '../library/wishlist.service.js';

type Identity = Pick<AuthRequest, 'user' | 'accessToken'>;
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  constructor(
    private readonly clients: AuthClientFactory,
    @Inject(SUPABASE_CLIENT) private readonly admin: SupabaseClient,
  ) {}

  private unavailable(): never {
    throw new ServiceUnavailableException('Account operation unavailable');
  }
  private async rows(
    client: SupabaseClient,
    table: string,
    columns: string,
    ownerId: string,
    order: string,
  ) {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client
        .from(table)
        .select(columns)
        .eq('user_id', ownerId)
        .order(order, { ascending: true })
        .range(offset, offset + 99);
      if (error) this.unavailable();
      rows.push(...(data ?? []));
      if (!data || data.length < 100) return rows;
    }
  }
  async export(identity: Identity) {
    try {
      const client = this.clients.create(identity.accessToken);
      const [books, wishes, shelf] = await Promise.all([
        this.rows(
          client,
          'user_books',
          LIBRARY_SELECT,
          identity.user.id,
          'book_id',
        ),
        this.rows(
          client,
          'user_wishlist',
          WISHLIST_SELECT,
          identity.user.id,
          'book_id',
        ),
        client
          .from('user_bookshelf')
          .select('book_ids, revision')
          .eq('user_id', identity.user.id)
          .maybeSingle(),
      ]);
      if (shelf.error) this.unavailable();
      // No auth tokens, passwords or signed URLs belong in a personal export.
      const personalBooks = books.map((row) => {
        const { user_id: _owner, ...entry } = libraryBook(row);
        return entry;
      });
      return {
        version: 1,
        exported_at: new Date().toISOString(),
        account: { id: identity.user.id, email: identity.user.email },
        books: personalBooks,
        wishlist: wishes.map(wishlistBook),
        bookshelf: shelf.data,
      };
    } catch {
      this.unavailable();
    }
  }

  private async photoPaths(bucket: string, ownerId: string) {
    const storage = this.admin.storage.from(bucket);
    const paths: string[] = [];
    let folders = [ownerId];
    // Our objects are owner/book/file. Limit depth and validate every segment
    // before ever using the administrative client to remove files.
    for (let depth = 0; folders.length; depth++) {
      if (depth > 4) this.unavailable();
      const next: string[] = [];
      for (let group = 0; group < folders.length; group += 8) {
        await Promise.all(
          folders.slice(group, group + 8).map(async (folder) => {
            for (let offset = 0; ; offset += 100) {
              const { data, error } = await storage.list(folder, {
                limit: 100,
                offset,
                sortBy: { column: 'name', order: 'asc' },
              });
              if (error) this.unavailable();
              for (const object of data ?? []) {
                if (
                  !object.name ||
                  object.name === '.' ||
                  object.name === '..' ||
                  /[\\/]/.test(object.name)
                )
                  this.unavailable();
                const path = `${folder}/${object.name}`;
                if (!path.startsWith(`${ownerId}/`)) this.unavailable();
                if (object.id == null) next.push(path);
                else paths.push(path);
              }
              if (!data || data.length < 100) break;
            }
          }),
        );
      }
      folders = next;
    }
    return paths;
  }

  async remove(identity: Identity, password: string) {
    if (!identity.user.email)
      throw new UnauthorizedException('Password verification required');
    // A separate client means reauthentication never replaces a shared session.
    const verifier = this.clients.create();
    let verified;
    try {
      verified = await verifier.auth.signInWithPassword({
        email: identity.user.email,
        password,
      });
    } catch {
      this.unavailable();
    }
    if (verified.error || verified.data.user?.id !== identity.user.id) {
      if (verified.error?.status === 429)
        throw new HttpException(
          'Password verification rate limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      if (
        verified.error &&
        (!verified.error.status || verified.error.status >= 500)
      )
        this.unavailable();
      throw new UnauthorizedException('Password verification failed');
    }
    try {
      const signedOut = await verifier.auth.signOut({ scope: 'local' });
      if (signedOut.error) this.unavailable();
      const ownerId = identity.user.id;
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          ownerId,
        )
      )
        this.unavailable();
      const buckets = ['book-spines', 'book-covers'];
      // Enumerate both buckets completely before deleting. Include abandoned
      // uploads as well as photos referenced by current library entries.
      const paths = await Promise.all(
        buckets.map((bucket) => this.photoPaths(bucket, ownerId)),
      );
      for (let i = 0; i < buckets.length; i++) {
        for (let offset = 0; offset < paths[i].length; offset += 100) {
          const { error } = await this.admin.storage
            .from(buckets[i])
            .remove(paths[i].slice(offset, offset + 100));
          if (error) this.unavailable();
        }
      }
      // Existing foreign keys cascade only personal libraries, wishes and shelf
      // layouts. Shared books/authors stay available to the other readers.
      const { error } = await this.admin.auth.admin.deleteUser(ownerId);
      if (error) this.unavailable();
    } catch {
      this.logger.warn('Unable to complete account deletion');
      this.unavailable();
    }
  }
}
