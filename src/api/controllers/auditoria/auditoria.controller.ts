import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { AuditoriaService } from '@application/use-cases/auditoria/auditoria.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { AuditoriaPaginadaResponseDto } from './dto/auditoria-response.dto';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles([PerfilUsuario.ADMIN, PerfilUsuario.GERENTE])
  @ApiOperation({ summary: 'Consulta trilha de auditoria paginada e filtrável' })
  @ApiOkResponse({ type: AuditoriaPaginadaResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async listar(
    @Query() query: ListarAuditoriaQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<AuditoriaPaginadaResponseDto> {
    return this.auditoriaService.listar(query, user);
  }
}
