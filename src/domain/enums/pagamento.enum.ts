export const FormaPagamento = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'CARTAO_CREDITO',
  CARTAO_DEBITO: 'CARTAO_DEBITO',
  MOCK: 'MOCK',
} as const;

export type FormaPagamento = (typeof FormaPagamento)[keyof typeof FormaPagamento];

export const StatusPagamento = {
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  RECUSADO: 'RECUSADO',
} as const;

export type StatusPagamento = (typeof StatusPagamento)[keyof typeof StatusPagamento];
