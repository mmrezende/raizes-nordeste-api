import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@api/common/dtos/pagination-query.dto';
import { CanalPedido, TipoDesconto } from '@domain/enums/pedido.enum';

export class PromocaoResponseDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f77' })
  id: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  unidadeId: string | null;

  @ApiProperty({ example: 'TOTEM10' })
  codigo: string;

  @ApiProperty({ example: '10% de desconto no totem' })
  descricao: string;

  @ApiProperty({ enum: TipoDesconto, example: TipoDesconto.PERCENTUAL })
  tipoDesconto: TipoDesconto;

  @ApiProperty({ example: 10 })
  valorDesconto: number;

  @ApiProperty({ example: 2000 })
  valorMinimoCentavos: number;

  @ApiProperty({ example: 20 })
  valorMinimo: number;

  @ApiProperty({ enum: CanalPedido, nullable: true, example: CanalPedido.TOTEM })
  canalAplicavel: CanalPedido | null;

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  inicioEm: Date;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  fimEm: Date;

  @ApiProperty({ example: true })
  ativo: boolean;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  updatedAt: Date;
}

export class PromocoesPaginadasResponseDto {
  @ApiProperty({ type: () => [PromocaoResponseDto] })
  data: PromocaoResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
