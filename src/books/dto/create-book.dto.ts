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

export class CreateBookDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(20)
  isbn?: string | null;

  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(255)
  publisher?: string | null;

  @ValidateIf((_, value) => value != null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  publication_date?: string | null;

  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  pages?: number | null;

  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(50)
  language?: string | null;

  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(1000)
  cover_url?: string | null;
}
