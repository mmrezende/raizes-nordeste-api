import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CriarProdutoDto {
  @ApiProperty({ example: 'Tapioca Carne de Sol', minLength: 2, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @ApiPropertyOptional({ example: 'Com queijo coalho na brasa', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @ApiProperty({ example: 'TAPIOCAS', minLength: 2, maxLength: 60 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  categoria: string;

  @ApiProperty({ example: 2490, minimum: 1, description: 'Preço padronizado da rede em centavos' })
  @IsInt()
  @Min(1)
  precoCentavos: number;
}
