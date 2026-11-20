import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva', minLength: 2, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @ApiProperty({ example: 'maria@exemplo.com', maxLength: 160 })
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({ example: 'Senha@123', minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  senha: string;

  @ApiPropertyOptional({
    description: 'Consentimento explícito (LGPD) para participar do programa de fidelidade.',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  consentimentoFidelidade?: boolean;
}
