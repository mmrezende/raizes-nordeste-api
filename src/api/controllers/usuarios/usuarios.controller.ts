import { Body, Controller, Get, Post } from '@nestjs/common';
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
import { UsuariosService } from '../../../application/use-cases/usuarios/usuarios.service';
import { PerfilUsuario } from '../../../domain/enums/perfil-usuario.enum';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ErrorResponseDto } from '../../common/dtos/error-response.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { UsuarioResponseDto } from './dto/usuario-response.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna dados do usuário autenticado (sem senhaHash)' })
  @ApiOkResponse({ type: UsuarioResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UsuarioResponseDto> {
    return this.usuariosService.buscarPerfil(user.id);
  }

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.GERENTE)
  @Auditable('USUARIO_CRIADO', 'usuarios')
  @ApiOperation({ summary: 'Cadastra usuário interno (ADMIN ou GERENTE para própria unidade)' })
  @ApiCreatedResponse({ type: UsuarioResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async criar(
    @Body() dto: CriarUsuarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.criarUsuarioInterno(dto, user);
  }
}
