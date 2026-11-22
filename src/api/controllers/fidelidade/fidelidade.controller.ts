import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Auditable } from '@api/common/decorators/auditable.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import { PaginationQueryDto } from '@api/common/dtos/pagination-query.dto';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { FidelidadeService } from '@application/use-cases/fidelidade/fidelidade.service';
import { AtualizarConsentimentoDto } from './dto/atualizar-consentimento.dto';
import {
  ContaFidelidadeResponseDto,
  MovimentacoesFidelidadePaginadasResponseDto,
} from './dto/fidelidade-response.dto';

@ApiTags('Fidelidade')
@ApiBearerAuth()
@Controller('fidelidade')
export class FidelidadeController {
  constructor(private readonly fidelidadeService: FidelidadeService) {}

  @Get('conta')
  @ApiOperation({ summary: 'Consulta saldo e status de consentimento do programa de fidelidade' })
  @ApiOkResponse({ type: ContaFidelidadeResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async buscarConta(@CurrentUser() user: UsuarioAutenticado): Promise<ContaFidelidadeResponseDto> {
    return this.fidelidadeService.buscarConta(user.id);
  }

  @Patch('consentimento')
  @Auditable({ acao: 'FIDELIDADE_CONSENTIMENTO_ATUALIZADO', entidade: 'contas_fidelidade' })
  @ApiOperation({ summary: 'Ativa ou revoga o consentimento explícito para fidelidade' })
  @ApiOkResponse({ type: ContaFidelidadeResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async atualizarConsentimento(
    @Body() dto: AtualizarConsentimentoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<ContaFidelidadeResponseDto> {
    return this.fidelidadeService.atualizarConsentimento(user.id, dto.consentimentoAtivo);
  }

  @Get('movimentacoes')
  @ApiOperation({ summary: 'Lista histórico paginado de movimentações de pontos do usuário' })
  @ApiOkResponse({ type: MovimentacoesFidelidadePaginadasResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async listarMovimentacoes(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<MovimentacoesFidelidadePaginadasResponseDto> {
    return this.fidelidadeService.listarMovimentacoes(user.id, query);
  }
}
