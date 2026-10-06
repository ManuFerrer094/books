import { ApiProperty } from '@nestjs/swagger';
import { Matches, ValidateIf } from 'class-validator';

export class CoverDto {
  @ApiProperty({
    nullable: true,
    description: 'Ruta privada de la foto; null recupera la portada original.',
  })
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[0-9a-f-]{36}\/[1-9][0-9]*\/[0-9a-f-]{36}\.jpg$/)
  image_path: string | null;
}
