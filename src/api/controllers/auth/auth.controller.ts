import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Auditable } from '@api/common/decorators/auditable.decorator';
import { Public } from '@api/common/decorators/public.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import { UsuarioResponseDto } from '@api/controllers/usuarios/dto/usuario-response.dto';
import { AuthService } from '@application/use-cases/auth/auth.service';
import { LoginResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Auditable({ acao: 'USUARIO_CADASTRADO', entidade: 'usuarios' })
  @ApiOperation({ summary: 'Cadastra um novo cliente e inicializa conta de fidelidade' })
  @ApiCreatedResponse({ type: UsuarioResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async register(@Body() dto: RegisterDto): Promise<UsuarioResponseDto> {
    return this.authService.registrarCliente(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica usuário e retorna token JWT' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
