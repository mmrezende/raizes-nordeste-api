export const TipoMovimentacaoFidelidade = {
  ACUMULO: 'ACUMULO',
  RESGATE: 'RESGATE',
  ESTORNO: 'ESTORNO',
} as const;

export type TipoMovimentacaoFidelidade =
  (typeof TipoMovimentacaoFidelidade)[keyof typeof TipoMovimentacaoFidelidade];
