import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { BookDto } from '../books/dto/book.dto.js';

export class AddWishlistBookDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  book_id: number;
}
export class WishlistBookDto {
  @ApiProperty()
  book_id: number;
  @ApiProperty({ format: 'date-time' })
  added_at: string;
  @ApiProperty({ type: BookDto })
  book: BookDto;
}
export class CatalogQueryDto {
  @ApiPropertyOptional({ default: '', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  query: string = '';
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page: number = 1;
  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size: number = 24;
}
export class CatalogPageDto {
  @ApiProperty({ type: [BookDto] })
  books: BookDto[];
  @ApiProperty()
  total: number;
  @ApiProperty()
  page: number;
  @ApiProperty()
  page_size: number;
}
