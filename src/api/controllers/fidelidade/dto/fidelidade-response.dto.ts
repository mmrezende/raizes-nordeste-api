import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@api/common/dtos/pagination-query.dto';
import { TipoMovimentacaoFidelidade } from '@domain/enums/fidelidade.enum';

export class ContaFidelidadeResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f11' })
  id: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f22' })
  usuarioId: string;

  @ApiProperty({ example: 25 })
  saldoPontos: number;

  @ApiProperty({ example: true })
  consentimentoAtivo: boolean;

  @ApiProperty({ type: Date, nullable: true, example: '2026-11-22T02:00:00.000Z' })
  consentimentoEm: Date | null;

  @ApiProperty({ type: Date, nullable: true, example: null })
  revogadoEm: Date | null;

  @ApiProperty({ example: '2026-11-22T02:00:00.000Z' })
  updatedAt: Date;
}

export class MovimentacaoFidelidadeResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f33' })
  id: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f11' })
  contaFidelidadeId: string;

  @ApiProperty({ type: String, nullable: true, example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f77' })
  pedidoId: string | null;

  @ApiProperty({ enum: TipoMovimentacaoFidelidade, example: TipoMovimentacaoFidelidade.ACUMULO })
  tipo: TipoMovimentacaoFidelidade;

  @ApiProperty({ example: 3 })
  pontos: number;

  @ApiProperty({ type: String, nullable: true, example: 'Acúmulo de pontos por pagamento aprovado' })
  descricao: string | null;

  @ApiProperty({ example: '2026-11-22T02:00:00.000Z' })
  createdAt: Date;
}

export class MovimentacoesFidelidadePaginadasResponseDto {
  @ApiProperty({ type: () => [MovimentacaoFidelidadeResponseDto] })
  data: MovimentacaoFidelidadeResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
