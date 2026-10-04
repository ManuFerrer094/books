import { ApiProperty } from '@nestjs/swagger';
import { BookDto } from './book.dto';

export class IsbnLookupDto {
  @ApiProperty({ enum: ['database', 'openlibrary'] })
  source: 'database' | 'openlibrary';

  @ApiProperty({ type: BookDto })
  book: BookDto;
}
