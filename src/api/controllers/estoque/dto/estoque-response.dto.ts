import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@api/common/dtos/pagination-query.dto';

export class MovimentacaoEstoqueDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f77' })
  id: string;

  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f88' })
  estoqueUnidadeId: string;

  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f99' })
  usuarioId: string;

  @ApiProperty({ example: 'ENTRADA' })
  tipo: string;

  @ApiProperty({ example: 10 })
  quantidade: number;

  @ApiProperty({ type: String, nullable: true, example: 'Reposição inicial' })
  motivo: string | null;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  createdAt: Date;
}

export class SaldoEstoqueDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f88' })
  id: string;

  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f55' })
  unidadeId: string;

  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f66' })
  produtoId: string;

  @ApiProperty({ example: 10 })
  quantidadeDisponivel: number;

  @ApiProperty({ example: true })
  disponivelVenda: boolean;
}

export class MovimentarEstoqueResponseDto {
  @ApiProperty({ type: () => MovimentacaoEstoqueDto })
  movimentacao: MovimentacaoEstoqueDto;

  @ApiProperty({ type: () => SaldoEstoqueDto })
  saldo: SaldoEstoqueDto;
}

export class EstoqueUnidadeItemResponseDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f66' })
  produtoId: string;

  @ApiProperty({ example: 'Bolo de Rolo Tradicional' })
  nome: string;

  @ApiProperty({ example: 'SOBREMESAS' })
  categoria: string;

  @ApiProperty({ example: 1500 })
  precoCentavos: number;

  @ApiProperty({ example: 15 })
  preco: number;

  @ApiProperty({ example: 7 })
  quantidadeDisponivel: number;

  @ApiProperty({ example: true })
  disponivelVenda: boolean;
}

export class EstoquePaginadoResponseDto {
  @ApiProperty({ type: () => [EstoqueUnidadeItemResponseDto] })
  data: EstoqueUnidadeItemResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
