import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthService } from '../../../application/use-cases/auth/auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { ErrorResponseDto } from '../../common/dtos/error-response.dto';
import type { RequestWithId } from '../../common/middlewares/request-id.middleware';
import { UsuarioResponseDto } from '../usuarios/dto/usuario-response.dto';
import { LoginResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastra um novo cliente e inicializa conta de fidelidade (LGPD)' })
  @ApiCreatedResponse({ type: UsuarioResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: RequestWithId,
  ): Promise<UsuarioResponseDto> {
    return this.authService.registrarCliente(dto, req.requestId);
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
