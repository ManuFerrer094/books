import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BooksModule } from '../books/books.module.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { BookshelfController } from './bookshelf.controller.js';
import {
  CatalogController,
  WishlistController,
} from './wishlist.controller.js';
import { WishlistService } from './wishlist.service.js';

@Module({
  imports: [AuthModule, BooksModule],
  controllers: [
    LibraryController,
    BookshelfController,
    CatalogController,
    WishlistController,
  ],
  providers: [LibraryService, WishlistService],
})
export class LibraryModule {}
