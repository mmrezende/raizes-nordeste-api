import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
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
import type { Response } from 'express';
import { Auditable } from '@api/common/decorators/auditable.decorator';
import { type AuthenticatedUser, CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import { PagamentosService } from '@application/use-cases/pagamentos/pagamentos.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { CriarPagamentoDto } from './dto/criar-pagamento.dto';
import { PagamentoResponseDto } from './dto/pagamento-response.dto';

@ApiTags('Pagamentos')
@ApiBearerAuth()
@Controller('pagamentos')
export class PagamentosController {
  constructor(private readonly pagamentosService: PagamentosService) {}

  @Post()
  @Roles([
    PerfilUsuario.CLIENTE,
    PerfilUsuario.ATENDENTE,
    PerfilUsuario.GERENTE,
    PerfilUsuario.ADMIN,
  ])
  @Auditable({ acao: 'PAGAMENTO_PROCESSADO', entidade: 'pagamentos' })
  @ApiOperation({
    summary: 'Processa pagamento no gateway mock com suporte a idempotencyKey (201 novo / 200 retentativa)',
  })
  @ApiCreatedResponse({ type: PagamentoResponseDto })
  @ApiOkResponse({ type: PagamentoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async processar(
    @Body() dto: CriarPagamentoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PagamentoResponseDto> {
    const { pagamento, jaProcessado } = await this.pagamentosService.processar(dto, user);
    res.status(jaProcessado ? HttpStatus.OK : HttpStatus.CREATED);
    return pagamento;
  }
}
