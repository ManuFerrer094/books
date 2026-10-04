import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { supabaseProvider } from './supabase.provider';
import { IsbnLookupService } from './isbn-lookup.service';
import { OpenLibraryService } from './open-library.service';
import { GoogleBooksService } from './google-books.service';
import { InventaireService } from './inventaire.service';
import { InternetArchiveService } from './internet-archive.service';
import { BookProvidersService } from './book-providers.service';

@Module({
  imports: [AuthModule],
  exports: [BooksService, IsbnLookupService],
  controllers: [BooksController],
  providers: [
    BooksService,
    supabaseProvider,
    IsbnLookupService,
    OpenLibraryService,
    GoogleBooksService,
    InventaireService,
    InternetArchiveService,
    BookProvidersService,
  ],
})
export class BooksModule {}
