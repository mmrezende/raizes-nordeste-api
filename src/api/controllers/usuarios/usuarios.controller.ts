import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
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
import { UsuariosService } from '@application/use-cases/usuarios/usuarios.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { UsuarioAnonimizadoResponseDto, UsuarioResponseDto } from './dto/usuario-response.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna dados do usuário autenticado (sem senhaHash)' })
  @ApiOkResponse({ type: UsuarioResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@CurrentUser() user: UsuarioAutenticado): Promise<UsuarioResponseDto> {
    return this.usuariosService.buscarPerfil(user.id);
  }

  @Delete('me')
  @Auditable({ acao: 'USUARIO_ANONIMIZADO', entidade: 'usuarios' })
  @ApiOperation({
    summary: 'Anonimiza dados pessoais do titular autenticado conforme LGPD, preservando pedidos',
  })
  @ApiOkResponse({ type: UsuarioAnonimizadoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async anonimizarMe(
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<UsuarioAnonimizadoResponseDto> {
    return this.usuariosService.anonimizar(user.id);
  }

  @Post()
  @Roles([PerfilUsuario.ADMIN, PerfilUsuario.GERENTE])
  @Auditable({ acao: 'USUARIO_CRIADO', entidade: 'usuarios' })
  @ApiOperation({ summary: 'Cadastra usuário interno (ADMIN ou GERENTE para própria unidade)' })
  @ApiCreatedResponse({ type: UsuarioResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async criar(
    @Body() dto: CriarUsuarioDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.criarUsuarioInterno(dto, user);
  }
}
