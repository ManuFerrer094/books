import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { supabaseProvider } from './supabase.provider';
import { IsbnLookupService } from './isbn-lookup.service';
import { OpenLibraryService } from './open-library.service';

@Module({
  controllers: [BooksController],
  providers: [
    BooksService,
    supabaseProvider,
    IsbnLookupService,
    OpenLibraryService,
  ],
})
export class BooksModule {}
