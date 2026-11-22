import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CanalPedido } from '@domain/enums/pedido.enum';

export class ItemPedidoInputDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f66' })
  @IsUUID('all')
  produtoId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantidade: number;
}

export class CriarPedidoDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f55' })
  @IsUUID('all')
  unidadeId: string;

  @ApiProperty({ enum: CanalPedido, example: CanalPedido.TOTEM })
  @IsEnum(CanalPedido)
  canalPedido: CanalPedido;

  @ApiPropertyOptional({
    description: 'Identificador do cliente (opcional para atendentes/gerentes em balcão)',
    example: '019c6199-df00-7a00-8f41-9c2a1b3e4f11',
  })
  @IsOptional()
  @IsUUID('all')
  clienteId?: string;

  @ApiPropertyOptional({ example: 'TOTEM10', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigoPromocao?: string;

  @ApiPropertyOptional({ example: 10, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  pontosResgate?: number;

  @ApiProperty({ type: () => [ItemPedidoInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoInputDto)
  itens: ItemPedidoInputDto[];
}
