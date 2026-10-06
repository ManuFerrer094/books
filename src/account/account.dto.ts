import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ format: 'password', minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @ApiProperty({ enum: ['ELIMINAR'] })
  @IsIn(['ELIMINAR'])
  confirmation: string;
}
