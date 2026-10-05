import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BooksService } from './books.service.js';
import { BookProvidersService } from './book-providers.service.js';
import { isbnKeys } from './isbn.js';
import { IsbnLookupDto } from './dto/isbn-lookup.dto.js';

@Injectable()
export class IsbnLookupService {
  constructor(
    private readonly books: BooksService,
    private readonly provider: BookProvidersService,
  ) {}

  async lookup(input: string): Promise<IsbnLookupDto> {
    const keys = isbnKeys(input);
    const local = await this.books.findByIsbns(keys);
    if (local) return { source: 'database', book: local };
    const result = await this.provider.findByIsbn(keys[0]);
    if (!result) throw new NotFoundException('Book not found for this ISBN');
    try {
      const saved = await this.books.createBook({
        ...result.book,
        isbn: keys[0],
      });
      return { source: result.source, book: saved };
    } catch (error) {
      // Another request can insert this ISBN while the provider is being queried.
      if (error instanceof ConflictException) {
        const existing = await this.books.findByIsbns(keys);
        if (existing) return { source: 'database', book: existing };
      }
      throw error;
    }
  }
}
