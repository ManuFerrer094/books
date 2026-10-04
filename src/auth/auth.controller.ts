import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import type { AuthRequest } from './auth.guard';
import {
  AuthResponseDto,
  AuthUserDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
} from './auth.dto';

@Controller('auth')
@ApiTags('auth')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: AuthResponseDto })
  register(@Body() credentials: RegisterDto) {
    return this.auth.register(credentials);
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse()
  login(@Body() credentials: LoginDto) {
    return this.auth.login(credentials);
  }

  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refresh_token);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AuthUserDto })
  me(@Req() request: AuthRequest) {
    return { id: request.user.id, email: request.user.email };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiNoContentResponse()
  async logout(@Req() request: AuthRequest) {
    await this.auth.logout(request.accessToken);
  }
}
