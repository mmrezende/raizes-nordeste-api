import { TipoMovimentacaoEstoque } from '@prisma/client';

export { TipoMovimentacaoEstoque };

export const TipoMovimentacaoManualEstoque = {
  ENTRADA: TipoMovimentacaoEstoque.ENTRADA,
  SAIDA: TipoMovimentacaoEstoque.SAIDA,
} as const;

export type TipoMovimentacaoManualEstoque =
  (typeof TipoMovimentacaoManualEstoque)[keyof typeof TipoMovimentacaoManualEstoque];
