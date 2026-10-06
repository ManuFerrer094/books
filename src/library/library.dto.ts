import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsEnum,
  IsBoolean,
  IsInt,
  IsString,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BookDto } from '../books/dto/book.dto.js';
import { SpineDto } from './bookshelf.dto.js';
import { CreateAuthorDto } from '../books/dto/author.dto.js';

class PersonalAuthorDto extends CreateAuthorDto {
  @ApiPropertyOptional({ example: 1, readOnly: true })
  id?: number;
}

class PersonalBookDto extends OmitType(BookDto, ['authors'] as const) {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Foto privada en book-covers.',
  })
  cover_image_path?: string | null;
  @ApiProperty({ type: [PersonalAuthorDto] })
  authors: PersonalAuthorDto[];
}

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
  @ApiPropertyOptional({ enum: ReadingStatus })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(ReadingStatus)
  status?: ReadingStatus;

  @ApiPropertyOptional({
    description: 'Préstamo independiente del estado de lectura.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  is_lent?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(200)
  lent_to?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 10000 })
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    minimum: 0,
    maximum: 5,
    description: 'null significa sin valorar.',
  })
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  @Max(5)
  rating?: number | null;
}

export class LibraryBookDto {
  @ApiProperty()
  is_lent: boolean;
  @ApiProperty({ type: String, nullable: true })
  lent_to: string | null;
  @ApiProperty({ type: String, nullable: true })
  notes: string | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 5 })
  rating: number | null;
  @ApiProperty({
    description: 'Tiene datos personalizados por el propietario.',
  })
  customized: boolean;
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
  @ApiProperty({ type: PersonalBookDto })
  book: PersonalBookDto;
}
