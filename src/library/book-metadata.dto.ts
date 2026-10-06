import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CreateBookDto } from '../books/dto/create-book.dto.js';

export class PersonalBookMetadataDto extends PartialType(CreateBookDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  declare title?: string;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @ValidateIf((_, value) => value != null)
  @Min(1)
  @IsInt()
  @Max(2147483647)
  declare pages?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @ValidateIf((_, value) => value != null)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(1000)
  declare cover_url?: string | null;
}
