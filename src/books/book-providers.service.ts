import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OpenLibraryService } from './open-library.service';
import { GoogleBooksService } from './google-books.service';
import { InventaireService } from './inventaire.service';
import { InternetArchiveService } from './internet-archive.service';
import { CreateBookDto } from './dto/create-book.dto';

export type BookSource =
  'openlibrary' | 'googlebooks' | 'inventaire' | 'internetarchive';

@Injectable()
export class BookProvidersService {
  constructor(
    private readonly openLibrary: OpenLibraryService,
    private readonly googleBooks: GoogleBooksService,
    private readonly inventaire: InventaireService,
    private readonly internetArchive: InternetArchiveService,
  ) {}

  async findByIsbn(
    isbn: string,
  ): Promise<{ source: BookSource; book: CreateBookDto } | null> {
    const providers = [
      ['openlibrary', this.openLibrary],
      ['googlebooks', this.googleBooks],
      ['inventaire', this.inventaire],
      ['internetarchive', this.internetArchive],
    ] as const;
    const unavailable: string[] = [];
    for (const [source, provider] of providers) {
      try {
        const book = await provider.findByIsbn(isbn);
        if (book) return { source, book };
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
        unavailable.push(source);
      }
    }
    if (unavailable.length) {
      throw new ServiceUnavailableException({
        message: 'Some book providers could not be checked; retry later',
        unavailableProviders: unavailable,
      });
    }
    return null;
  }
}
