import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsObject,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class BookshelfDto {
  @ApiProperty({ type: [Number], example: [3, 1, 2] })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  book_ids: number[];

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  revision: number;

  @ApiPropertyOptional({
    description: 'Versioned bookshelf scene; omitted by legacy order clients.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  design?: import('./bookshelf-design.js').BookshelfDesign;
}

export class SpineDto {
  @ApiPropertyOptional({ nullable: true, example: '#45634a' })
  @ValidateIf((_, value) => value != null)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 28, maximum: 64 })
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(28)
  @Max(64)
  width?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 160, maximum: 240 })
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(160)
  @Max(240)
  height?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value != null)
  @Matches(/^[0-9a-f-]{36}\/[1-9][0-9]*\/[0-9a-f-]{36}\.jpg$/)
  image_path?: string | null;
}
