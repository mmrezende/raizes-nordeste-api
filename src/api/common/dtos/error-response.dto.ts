import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({ example: 'canalPedido' })
  field: string;

  @ApiProperty({ example: 'Valor inválido para canalPedido.' })
  issue: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 'ERRO_VALIDACAO' })
  error: string;

  @ApiProperty({ example: 'Dados de entrada inválidos.' })
  message: string;

  @ApiProperty({ type: () => [ErrorDetailDto] })
  details: ErrorDetailDto[];

  @ApiProperty({ example: '2026-11-21T22:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/pedidos' })
  path: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  requestId: string;
}
