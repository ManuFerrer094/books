import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard.js';
import {
  AddWishlistBookDto,
  CatalogPageDto,
  CatalogQueryDto,
  WishlistBookDto,
} from './wishlist.dto.js';
import { WishlistService } from './wishlist.service.js';

@Controller('me/wishlist')
@ApiTags('wishlist')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@UseGuards(AuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [WishlistBookDto] })
  list(@Req() request: AuthRequest) {
    return this.wishlist.list(request);
  }
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Guardar un deseo sin añadirlo a la biblioteca' })
  @ApiOkResponse({ type: WishlistBookDto })
  add(@Req() request: AuthRequest, @Body() input: AddWishlistBookDto) {
    return this.wishlist.add(request, input.book_id);
  }
  @Delete(':bookId')
  @HttpCode(204)
  @ApiNoContentResponse()
  async remove(
    @Req() request: AuthRequest,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    await this.wishlist.remove(request, bookId);
  }
}

@Controller('catalog')
@ApiTags('catalog')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@UseGuards(AuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class CatalogController {
  constructor(private readonly wishlist: WishlistService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Explorar fichas compartidas sin datos de propietarios',
  })
  @ApiOkResponse({ type: CatalogPageDto })
  list(@Req() request: AuthRequest, @Query() input: CatalogQueryDto) {
    return this.wishlist.catalog(request, input);
  }
}
