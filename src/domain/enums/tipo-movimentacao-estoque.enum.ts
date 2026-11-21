export const TipoMovimentacaoEstoque = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  RESERVA: 'RESERVA',
  ESTORNO: 'ESTORNO',
} as const;

export type TipoMovimentacaoEstoque =
  (typeof TipoMovimentacaoEstoque)[keyof typeof TipoMovimentacaoEstoque];

export const TipoMovimentacaoManualEstoque = {
  ENTRADA: TipoMovimentacaoEstoque.ENTRADA,
  SAIDA: TipoMovimentacaoEstoque.SAIDA,
} as const;

export type TipoMovimentacaoManualEstoque =
  (typeof TipoMovimentacaoManualEstoque)[keyof typeof TipoMovimentacaoManualEstoque];
