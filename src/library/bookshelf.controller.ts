import {
  Body,
  Controller,
  Get,
  Header,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard.js';
import { BookshelfDto } from './bookshelf.dto.js';
import { LibraryService } from './library.service.js';

@Controller('me/bookshelf')
@ApiTags('library')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class BookshelfController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Leer el orden de mi estantería' })
  @ApiOkResponse({ type: BookshelfDto })
  get(@Req() request: AuthRequest) {
    return this.library.bookshelf(request);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Guardar el orden de mi estantería' })
  @ApiOkResponse({ type: BookshelfDto })
  @ApiConflictResponse({
    description:
      'El orden o la biblioteca han cambiado. Recarga antes de reintentar.',
  })
  save(@Req() request: AuthRequest, @Body() input: BookshelfDto) {
    return this.library.saveBookshelf(request, input);
  }
}
