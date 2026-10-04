import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { supabaseProvider } from './supabase.provider';

@Module({
  controllers: [BooksController],
  providers: [BooksService, supabaseProvider]
})
export class BooksModule {}
