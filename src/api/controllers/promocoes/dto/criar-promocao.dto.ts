import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CanalPedido, TipoDesconto } from '@domain/enums/pedido.enum';

export class CriarPromocaoDto {
  @ApiProperty({ example: 'TOTEM10', maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  codigo: string;

  @ApiProperty({ example: '10% de desconto para pedidos realizados no totem', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  descricao: string;

  @ApiProperty({ enum: TipoDesconto, example: TipoDesconto.PERCENTUAL })
  @IsEnum(TipoDesconto)
  tipoDesconto: TipoDesconto;

  @ApiProperty({
    description: 'Percentual inteiro (1 a 100) ou valor fixo em centavos',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  valorDesconto: number;

  @ApiPropertyOptional({ example: 2000, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  valorMinimoCentavos?: number;

  @ApiPropertyOptional({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  @IsOptional()
  @IsUUID('all')
  unidadeId?: string;

  @ApiPropertyOptional({ enum: CanalPedido, example: CanalPedido.TOTEM })
  @IsOptional()
  @IsEnum(CanalPedido)
  canalAplicavel?: CanalPedido;

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  @IsDateString()
  inicioEm: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  @IsDateString()
  fimEm: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
