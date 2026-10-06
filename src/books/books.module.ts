import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';
import { supabaseProvider } from './supabase.provider.js';
import { IsbnLookupService } from './isbn-lookup.service.js';
import { OpenLibraryService } from './open-library.service.js';
import { GoogleBooksService } from './google-books.service.js';
import { InventaireService } from './inventaire.service.js';
import { InternetArchiveService } from './internet-archive.service.js';
import { BookProvidersService } from './book-providers.service.js';

@Module({
  imports: [AuthModule],
  exports: [BooksService, IsbnLookupService, supabaseProvider.provide],
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
