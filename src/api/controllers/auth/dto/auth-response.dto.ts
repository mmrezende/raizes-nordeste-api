import { ApiProperty } from '@nestjs/swagger';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';

export class AuthUserSummaryDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  id: string;

  @ApiProperty({ example: 'Maria Silva' })
  nome: string;

  @ApiProperty({ example: 'maria@exemplo.com' })
  email: string;

  @ApiProperty({ enum: PerfilUsuario, example: PerfilUsuario.CLIENTE })
  perfil: PerfilUsuario;

  @ApiProperty({ type: String, nullable: true, example: null })
  unidadeId: string | null;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 3600000, description: 'Tempo de expiração do token em milissegundos' })
  expiresIn: number;

  @ApiProperty({ type: () => AuthUserSummaryDto })
  user: AuthUserSummaryDto;
}
