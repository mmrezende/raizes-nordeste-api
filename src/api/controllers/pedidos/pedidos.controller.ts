import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
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
import { Roles } from '@api/common/decorators/roles.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { PedidosService } from '@application/use-cases/pedidos/pedidos.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { AtualizarStatusPedidoDto } from './dto/atualizar-status-pedido.dto';
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
    @CurrentUser() user: UsuarioAutenticado,
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
    @CurrentUser() user: UsuarioAutenticado,
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
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PedidoResponseDto> {
    return this.pedidosService.buscarPorId(id, user);
  }

  @Patch(':id/status')
  @Roles([
    PerfilUsuario.COZINHA,
    PerfilUsuario.ATENDENTE,
    PerfilUsuario.GERENTE,
    PerfilUsuario.ADMIN,
  ])
  @Auditable({ acao: 'PEDIDO_STATUS_ATUALIZADO', entidade: 'pedidos' })
  @ApiOperation({
    summary: 'Avança status operacional do pedido (COZINHA: PRONTO; ATENDENTE: ENTREGUE)',
  })
  @ApiOkResponse({ type: PedidoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async atualizarStatus(
    @Param('id') id: string,
    @Body() dto: AtualizarStatusPedidoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PedidoResponseDto> {
    return this.pedidosService.atualizarStatus(id, dto.status, user);
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @Roles([
    PerfilUsuario.CLIENTE,
    PerfilUsuario.ATENDENTE,
    PerfilUsuario.GERENTE,
    PerfilUsuario.ADMIN,
  ])
  @Auditable({ acao: 'PEDIDO_CANCELADO', entidade: 'pedidos' })
  @ApiOperation({ summary: 'Cancela pedido antes da entrega e estorna estoque e pontos' })
  @ApiOkResponse({ type: PedidoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async cancelar(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PedidoResponseDto> {
    return this.pedidosService.cancelar(id, user);
  }
}
