import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty({ example: 'Don Quijote de la Mancha', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 20,
    description: 'Único cuando se proporciona.',
    example: '9788420412146',
  })
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(20)
  isbn?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    example: 'Alfaguara',
  })
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(255)
  publisher?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'date',
    example: '2004-09-01',
  })
  @ValidateIf((_, value) => value != null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  publication_date?: string | null;

  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: -2147483648,
    maximum: 2147483647,
    example: 863,
  })
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  pages?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    example: 'es',
  })
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(50)
  language?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 1000,
    example: 'https://example.com/cover.jpg',
  })
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(1000)
  cover_url?: string | null;
}
