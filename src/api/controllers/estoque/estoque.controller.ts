import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { EstoqueService } from '../../../application/use-cases/estoque/estoque.service';
import { PerfilUsuario } from '../../../domain/enums/perfil-usuario.enum';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ErrorResponseDto } from '../../common/dtos/error-response.dto';
import { MovimentarEstoqueResponseDto } from './dto/estoque-response.dto';
import { MovimentarEstoqueDto } from './dto/movimentar-estoque.dto';

@ApiTags('Estoque')
@ApiBearerAuth()
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoqueService: EstoqueService) {}

  @Post('movimentacoes')
  @Roles([PerfilUsuario.ADMIN, PerfilUsuario.GERENTE])
  @Auditable({ acao: 'ESTOQUE_MOVIMENTADO', entidade: 'estoque_unidades' })
  @ApiOperation({ summary: 'Registra entrada ou saída manual no estoque de uma unidade' })
  @ApiCreatedResponse({ type: MovimentarEstoqueResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async movimentar(
    @Body() dto: MovimentarEstoqueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MovimentarEstoqueResponseDto> {
    return this.estoqueService.movimentar(dto, user);
  }
}
