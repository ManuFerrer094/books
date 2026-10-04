import { ValidateIf } from 'class-validator';
import { CreateBookDto } from './create-book.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBookDto extends CreateBookDto {
  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    nullable: false,
    example: 'Don Quijote de la Mancha',
  })
  @ValidateIf((_, value) => value !== undefined)
  declare title: string;
}
