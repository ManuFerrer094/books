import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BookDto } from '../books/dto/book.dto.js';
import { SpineDto } from './bookshelf.dto.js';

export enum ReadingStatus {
  Pending = 'pending',
  Reading = 'reading',
  Read = 'read',
}

export class ReadingStatusDto {
  @ApiPropertyOptional({ enum: ReadingStatus, default: ReadingStatus.Pending })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(ReadingStatus)
  status?: ReadingStatus;
}

export class AddLibraryBookDto extends ReadingStatusDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  book_id: number;
}

export class AddLibraryIsbnDto extends ReadingStatusDto {
  @ApiProperty({ example: '9788484454892' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  isbn: string;
}

export class UpdateLibraryBookDto {
  @ApiProperty({ enum: ReadingStatus })
  @IsEnum(ReadingStatus)
  status: ReadingStatus;
}

export class LibraryBookDto {
  @ApiProperty({ type: SpineDto })
  spine: SpineDto;
  @ApiProperty({ example: 1 })
  book_id: number;
  @ApiProperty({ enum: ReadingStatus })
  status: ReadingStatus;
  @ApiProperty({ format: 'date-time' })
  added_at: string;
  @ApiProperty({ format: 'date-time' })
  updated_at: string;
  @ApiProperty({ type: BookDto })
  book: BookDto;
}
