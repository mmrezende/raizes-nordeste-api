import { ApiProperty } from '@nestjs/swagger';
import { FormaPagamento, StatusPagamento } from '@domain/enums/pagamento.enum';

export class PagamentoResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f88' })
  id: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f77' })
  pedidoId: string;

  @ApiProperty({ example: 'pay-key-001' })
  idempotencyKey: string;

  @ApiProperty({ enum: FormaPagamento, example: FormaPagamento.PIX })
  formaPagamento: FormaPagamento;

  @ApiProperty({ enum: StatusPagamento, example: StatusPagamento.APROVADO })
  status: StatusPagamento;

  @ApiProperty({ example: 3500 })
  valorCentavos: number;

  @ApiProperty({ example: 35 })
  valor: number;

  @ApiProperty({ type: String, nullable: true, example: 'MOCK-PIX-1732245600000' })
  referenciaExterna: string | null;

  @ApiProperty({ type: Date, nullable: true, example: '2026-02-15T14:00:00.000Z' })
  processadoEm: Date | null;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  createdAt: Date;
}
