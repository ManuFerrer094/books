import { ApiProperty } from '@nestjs/swagger';
import { CreateBookDto } from './create-book.dto.js';
import { AuthorDto } from './author.dto.js';

export class BookDto extends CreateBookDto {
  @ApiProperty({ type: [AuthorDto] })
  declare authors: AuthorDto[];

  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  id: number;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-04T10:00:00',
    readOnly: true,
  })
  created_at: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-04T10:00:00',
    readOnly: true,
  })
  updated_at: string;
}
