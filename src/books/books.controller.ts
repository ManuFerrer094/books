import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookDto } from './dto/book.dto';
import { IsbnLookupDto } from './dto/isbn-lookup.dto';
import { IsbnLookupService } from './isbn-lookup.service';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

@Controller('books')
@ApiTags('books')
@ApiInternalServerErrorResponse({
  description: 'No se pudo acceder a los libros.',
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly isbnLookup: IsbnLookupService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar libros' })
  @ApiOkResponse({ type: BookDto, isArray: true })
  getBooks() {
    return this.booksService.getBooks();
  }

  @Get('isbn/:isbn')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Consultar por ISBN e importar el libro si falta' })
  @ApiParam({
    name: 'isbn',
    example: '9780140328721',
    description: 'ISBN-10 o ISBN-13; admite espacios y guiones.',
  })
  @ApiOkResponse({ type: IsbnLookupDto })
  @ApiBadRequestResponse({ description: 'ISBN inválido.' })
  @ApiNotFoundResponse({ description: 'No se encontró el libro.' })
  @ApiServiceUnavailableResponse({
    description:
      'No se encontr? una ficha y uno o m?s proveedores no pudieron consultarse.',
  })
  getBookByIsbn(@Param('isbn') isbn: string) {
    return this.isbnLookup.lookup(isbn);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un libro' })
  @ApiParam({ name: 'id', type: 'integer', example: 1 })
  @ApiOkResponse({ type: BookDto })
  @ApiBadRequestResponse({ description: 'El id debe ser un número entero.' })
  @ApiNotFoundResponse({ description: 'Libro no encontrado.' })
  getBook(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.getBook(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un libro' })
  @ApiCreatedResponse({ type: BookDto })
  @ApiBadRequestResponse({ description: 'Datos del libro inválidos.' })
  @ApiConflictResponse({ description: 'Ya existe un libro con ese ISBN.' })
  createBook(@Body() book: CreateBookDto) {
    return this.booksService.createBook(book);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente un libro' })
  @ApiParam({ name: 'id', type: 'integer', example: 1 })
  @ApiOkResponse({ type: BookDto })
  @ApiBadRequestResponse({ description: 'Id o datos del libro inválidos.' })
  @ApiNotFoundResponse({ description: 'Libro no encontrado.' })
  @ApiConflictResponse({ description: 'Ya existe un libro con ese ISBN.' })
  updateBook(
    @Param('id', ParseIntPipe) id: number,
    @Body() book: UpdateBookDto,
  ) {
    return this.booksService.updateBook(id, book);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un libro' })
  @ApiParam({ name: 'id', type: 'integer', example: 1 })
  @ApiNoContentResponse({ description: 'Libro eliminado.' })
  @ApiBadRequestResponse({ description: 'El id debe ser un número entero.' })
  @ApiNotFoundResponse({ description: 'Libro no encontrado.' })
  @HttpCode(204)
  async deleteBook(@Param('id', ParseIntPipe) id: number) {
    await this.booksService.deleteBook(id);
  }
}
