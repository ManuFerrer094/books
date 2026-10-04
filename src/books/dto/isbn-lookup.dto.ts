import { ApiProperty } from '@nestjs/swagger';
import { BookDto } from './book.dto';
import type { BookSource } from '../book-providers.service';

export class IsbnLookupDto {
  @ApiProperty({
    enum: [
      'database',
      'openlibrary',
      'googlebooks',
      'inventaire',
      'internetarchive',
    ],
  })
  source: 'database' | BookSource;

  @ApiProperty({ type: BookDto })
  book: BookDto;
}
