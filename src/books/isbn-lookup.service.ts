import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { OpenLibraryService } from './open-library.service';
import { isbnKeys } from './isbn';
import { IsbnLookupDto } from './dto/isbn-lookup.dto';

@Injectable()
export class IsbnLookupService {
  constructor(
    private readonly books: BooksService,
    private readonly provider: OpenLibraryService,
  ) {}

  async lookup(input: string): Promise<IsbnLookupDto> {
    const keys = isbnKeys(input);
    const local = await this.books.findByIsbns(keys);
    if (local) return { source: 'database', book: local };
    const book = await this.provider.findByIsbn(keys[0]);
    if (!book) throw new NotFoundException('Book not found for this ISBN');
    try {
      const saved = await this.books.createBook({ ...book, isbn: keys[0] });
      return { source: 'openlibrary', book: saved };
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
