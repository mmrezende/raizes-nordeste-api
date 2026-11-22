import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Auditable } from '@api/common/decorators/auditable.decorator';
import { Public } from '@api/common/decorators/public.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import { ProdutosService } from '@application/use-cases/produtos/produtos.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { CriarProdutoDto } from './dto/criar-produto.dto';
import { ListarProdutosQueryDto } from './dto/listar-produtos-query.dto';
import { ProdutoResponseDto, ProdutosPaginadosResponseDto } from './dto/produto-response.dto';

@ApiTags('Produtos')
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Post()
  @ApiBearerAuth()
  @Roles([PerfilUsuario.ADMIN])
  @Auditable({ acao: 'PRODUTO_CRIADO', entidade: 'produtos' })
  @ApiOperation({ summary: 'Cadastra novo produto no catálogo da rede' })
  @ApiCreatedResponse({ type: ProdutoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async criar(@Body() dto: CriarProdutoDto): Promise<ProdutoResponseDto> {
    return this.produtosService.criar(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lista catálogo de produtos paginado com filtro opcional por categoria' })
  @ApiOkResponse({ type: ProdutosPaginadosResponseDto })
  async listar(@Query() query: ListarProdutosQueryDto): Promise<ProdutosPaginadosResponseDto> {
    return this.produtosService.listar(query);
  }
}
