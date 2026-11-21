import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@api/common/dtos/pagination-query.dto';
import { CanalPedido, StatusPedido } from '@prisma/client';

export class ItemPedidoResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f88' })
  id: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f66' })
  produtoId: string;

  @ApiProperty({ example: 2 })
  quantidade: number;

  @ApiProperty({ example: 2500 })
  precoUnitarioCentavos: number;

  @ApiProperty({ example: 25 })
  precoUnitario: number;

  @ApiProperty({ example: 5000 })
  subtotalCentavos: number;

  @ApiProperty({ example: 50 })
  subtotal: number;
}

export class PedidoResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f77' })
  id: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  unidadeId: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f11' })
  clienteId: string;

  @ApiProperty({ type: String, nullable: true, example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f99' })
  promocaoId: string | null;

  @ApiProperty({ enum: CanalPedido, example: CanalPedido.TOTEM })
  canalPedido: CanalPedido;

  @ApiProperty({ enum: StatusPedido, example: StatusPedido.AGUARDANDO_PAGAMENTO })
  status: StatusPedido;

  @ApiProperty({ example: 5000 })
  subtotalCentavos: number;

  @ApiProperty({ example: 50 })
  subtotal: number;

  @ApiProperty({ example: 500 })
  descontoPromocaoCentavos: number;

  @ApiProperty({ example: 5 })
  descontoPromocao: number;

  @ApiProperty({ example: 10 })
  pontosUtilizados: number;

  @ApiProperty({ example: 500 })
  descontoFidelidadeCentavos: number;

  @ApiProperty({ example: 5 })
  descontoFidelidade: number;

  @ApiProperty({ example: 4000 })
  valorTotalCentavos: number;

  @ApiProperty({ example: 40 })
  valorTotal: number;

  @ApiProperty({ type: () => [ItemPedidoResponseDto] })
  itens: ItemPedidoResponseDto[];

  @ApiProperty({ example: '2026-11-22T01:55:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-11-22T01:55:00.000Z' })
  updatedAt: Date;
}

export class PedidosPaginadosResponseDto {
  @ApiProperty({ type: () => [PedidoResponseDto] })
  data: PedidoResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
