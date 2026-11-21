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
import { type AuthenticatedUser, CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import { PedidosService } from '@application/use-cases/pedidos/pedidos.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { ListarPedidosQueryDto } from './dto/listar-pedidos-query.dto';
import { PedidoResponseDto, PedidosPaginadosResponseDto } from './dto/pedido-response.dto';

@ApiTags('Pedidos')
@ApiBearerAuth()
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  @Roles([
    PerfilUsuario.CLIENTE,
    PerfilUsuario.ATENDENTE,
    PerfilUsuario.GERENTE,
    PerfilUsuario.ADMIN,
  ])
  @Auditable({ acao: 'PEDIDO_CRIADO', entidade: 'pedidos' })
  @ApiOperation({
    summary: 'Cria pedido multicanal com reserva de estoque, cupom e resgate de fidelidade',
  })
  @ApiCreatedResponse({ type: PedidoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async criar(
    @Body() dto: CriarPedidoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PedidoResponseDto> {
    return this.pedidosService.criar(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lista pedidos paginados com filtros por canal, status e unidade' })
  @ApiOkResponse({ type: PedidosPaginadosResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async listar(
    @Query() query: ListarPedidosQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PedidosPaginadosResponseDto> {
    return this.pedidosService.listar(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta detalhes de um pedido por ID conforme escopo do perfil' })
  @ApiOkResponse({ type: PedidoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async buscarPorId(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PedidoResponseDto> {
    return this.pedidosService.buscarPorId(id, user);
  }
}
