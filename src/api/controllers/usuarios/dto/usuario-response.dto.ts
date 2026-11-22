import { ApiProperty } from '@nestjs/swagger';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';

export class UsuarioResponseDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f55' })
  id: string;

  @ApiProperty({ example: 'Maria Silva' })
  nome: string;

  @ApiProperty({ example: 'maria@exemplo.com' })
  email: string;

  @ApiProperty({ enum: PerfilUsuario, example: PerfilUsuario.CLIENTE })
  perfil: PerfilUsuario;

  @ApiProperty({ type: String, nullable: true, example: null })
  unidadeId: string | null;

  @ApiProperty({ example: true })
  ativo: boolean;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  updatedAt: Date;
}

export class UsuarioAnonimizadoResponseDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f55' })
  id: string;

  @ApiProperty({ example: 'Usuário Anonimizado' })
  nome: string;

  @ApiProperty({ example: false })
  ativo: boolean;

  @ApiProperty({ example: '2026-02-15T14:30:00.000Z' })
  anonimizadoEm: Date;
}
