import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BooksModule } from '../books/books.module.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';

@Module({
  imports: [AuthModule, BooksModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
