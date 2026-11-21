import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Auditable } from '@api/common/decorators/auditable.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Public } from '@api/common/decorators/public.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import { PaginationQueryDto } from '@api/common/dtos/pagination-query.dto';
import { EstoquePaginadoResponseDto } from '@api/controllers/estoque/dto/estoque-response.dto';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { EstoqueService } from '@application/use-cases/estoque/estoque.service';
import { UnidadesService } from '@application/use-cases/unidades/unidades.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { CardapioPaginadoResponseDto } from './dto/cardapio-item-response.dto';
import { CriarUnidadeDto } from './dto/criar-unidade.dto';
import { UnidadeResponseDto, UnidadesPaginadasResponseDto } from './dto/unidade-response.dto';

@ApiTags('Unidades')
@Controller('unidades')
export class UnidadesController {
  constructor(
    private readonly unidadesService: UnidadesService,
    private readonly estoqueService: EstoqueService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @Roles([PerfilUsuario.ADMIN])
  @Auditable({ acao: 'UNIDADE_CRIADA', entidade: 'unidades' })
  @ApiOperation({ summary: 'Cadastra uma nova unidade da rede (ADMIN)' })
  @ApiCreatedResponse({ type: UnidadeResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async criar(@Body() dto: CriarUnidadeDto): Promise<UnidadeResponseDto> {
    return this.unidadesService.criar(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lista unidades ativas da rede com paginação' })
  @ApiOkResponse({ type: UnidadesPaginadasResponseDto })
  async listar(@Query() query: PaginationQueryDto): Promise<UnidadesPaginadasResponseDto> {
    return this.unidadesService.listar(query);
  }

  @Get(':id/cardapio')
  @Public()
  @ApiOperation({ summary: 'Consulta cardápio disponível para venda em uma unidade específica' })
  @ApiOkResponse({ type: CardapioPaginadoResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async cardapio(
    @Param('id') unidadeId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CardapioPaginadoResponseDto> {
    return this.unidadesService.buscarCardapio(unidadeId, query);
  }

  @Get(':id/estoque')
  @ApiBearerAuth()
  @Roles([
    PerfilUsuario.ADMIN,
    PerfilUsuario.GERENTE,
    PerfilUsuario.ATENDENTE,
    PerfilUsuario.COZINHA,
  ])
  @ApiOperation({ summary: 'Consulta saldos de estoque da unidade (restrito à equipe da loja ou ADMIN)' })
  @ApiOkResponse({ type: EstoquePaginadoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async estoque(
    @Param('id') unidadeId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<EstoquePaginadoResponseDto> {
    return this.estoqueService.listarPorUnidade(unidadeId, user, query);
  }
}
