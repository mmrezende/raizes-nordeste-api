import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@api/common/dtos/pagination-query.dto';

export class LogAuditoriaResponseDto {
  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f90' })
  id: string;

  @ApiProperty({ type: String, nullable: true, example: '019c6199-df00-7a00-8f41-9c2a1b3e4f11' })
  usuarioId: string | null;

  @ApiProperty({ example: 'PEDIDO_CRIADO' })
  acao: string;

  @ApiProperty({ example: 'pedidos' })
  entidade: string;

  @ApiProperty({ example: '019c6199-df00-7a00-8f41-9c2a1b3e4f77' })
  entidadeId: string;

  @ApiProperty({
    type: Object,
    nullable: true,
    example: { method: 'POST', path: '/pedidos', status: 'AGUARDANDO_PAGAMENTO' },
  })
  metadados: Record<string, unknown> | null;

  @ApiProperty({ type: String, nullable: true, example: 'req-1234' })
  requestId: string | null;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  createdAt: Date;
}

export class AuditoriaPaginadaResponseDto {
  @ApiProperty({ type: () => [LogAuditoriaResponseDto] })
  data: LogAuditoriaResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
