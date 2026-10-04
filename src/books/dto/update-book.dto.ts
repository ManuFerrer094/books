import { ValidateIf } from 'class-validator';
import { CreateBookDto } from './create-book.dto';

export class UpdateBookDto extends CreateBookDto {
  @ValidateIf((_, value) => value !== undefined)
  declare title: string;
}
