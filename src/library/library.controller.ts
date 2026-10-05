import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthRequest } from '../auth/auth.guard.js';
import {
  AddLibraryBookDto,
  AddLibraryIsbnDto,
  LibraryBookDto,
  UpdateLibraryBookDto,
} from './library.dto.js';
import { LibraryService } from './library.service.js';

@Controller('me/books')
@ApiTags('library')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse({ description: 'Libro no encontrado en tu biblioteca.' })
@UseGuards(AuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Listar mi biblioteca' })
  @ApiOkResponse({ type: LibraryBookDto, isArray: true })
  list(@Req() request: AuthRequest) {
    return this.library.list(request);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Añadir un libro del catálogo a mi biblioteca sin duplicarlo',
  })
  @ApiOkResponse({ type: LibraryBookDto })
  add(@Req() request: AuthRequest, @Body() input: AddLibraryBookDto) {
    return this.library.add(request, input);
  }

  @Post('isbn')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Obtener o importar por ISBN y añadir a mi biblioteca',
  })
  @ApiOkResponse({ type: LibraryBookDto })
  addByIsbn(@Req() request: AuthRequest, @Body() input: AddLibraryIsbnDto) {
    return this.library.addByIsbn(request, input);
  }

  @Get(':bookId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LibraryBookDto })
  get(
    @Req() request: AuthRequest,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.library.get(request, bookId);
  }

  @Patch(':bookId')
  @ApiOperation({ summary: 'Cambiar mi estado de lectura' })
  @ApiOkResponse({ type: LibraryBookDto })
  update(
    @Req() request: AuthRequest,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Body() input: UpdateLibraryBookDto,
  ) {
    return this.library.update(request, bookId, input);
  }

  @Delete(':bookId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar un libro de mi biblioteca' })
  @ApiNoContentResponse()
  async remove(
    @Req() request: AuthRequest,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    await this.library.remove(request, bookId);
  }
}
