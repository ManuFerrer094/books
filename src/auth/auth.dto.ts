import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'lector@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 1, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @MinLength(8)
  declare password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  refresh_token: string;
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional()
  email?: string;
}

export class AuthSessionDto {
  @ApiProperty()
  access_token: string;
  @ApiProperty()
  refresh_token: string;
  @ApiProperty()
  expires_in: number;
  @ApiPropertyOptional()
  expires_at?: number;
  @ApiProperty({ example: 'bearer' })
  token_type: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto, nullable: true })
  user: AuthUserDto | null;
  @ApiProperty({
    type: AuthSessionDto,
    nullable: true,
    description:
      'Puede ser null si debes confirmar el email antes de iniciar sesión.',
  })
  session: AuthSessionDto | null;
}
