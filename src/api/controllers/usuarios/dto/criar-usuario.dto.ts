import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';

export class CriarUsuarioDto {
  @ApiProperty({ example: 'Carlos Balcão', minLength: 2, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @ApiProperty({ example: 'carlos@raizes.com', maxLength: 160 })
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({ example: 'Senha@123', minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  senha: string;

  @ApiProperty({ enum: PerfilUsuario, example: PerfilUsuario.ATENDENTE })
  @IsEnum(PerfilUsuario)
  perfil: PerfilUsuario;

  @ApiPropertyOptional({
    description: 'Obrigatório para ATENDENTE, COZINHA e GERENTE.',
    type: String,
    nullable: true,
    example: '019c6199-df00-7a00-8f41-9c2a1b3e4f55',
  })
  @IsOptional()
  @IsUUID('all')
  unidadeId?: string | null;
}
