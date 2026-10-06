import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard.js';
import { AccountService } from './account.service.js';
import { DeleteAccountDto } from './account.dto.js';

@Controller('me/account')
@ApiTags('account')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AccountController {
  constructor(private readonly account: AccountService) {}
  @Get('export')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Disposition', 'attachment; filename="entre-paginas.json"')
  @ApiOperation({
    summary: 'Exportar los datos personales del lector autenticado',
  })
  export(@Req() identity: AuthRequest) {
    return this.account.export(identity);
  }

  @Delete()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Eliminar la cuenta propia tras verificar su contraseña',
  })
  async remove(@Req() identity: AuthRequest, @Body() input: DeleteAccountDto) {
    await this.account.remove(identity, input.password);
  }
}
