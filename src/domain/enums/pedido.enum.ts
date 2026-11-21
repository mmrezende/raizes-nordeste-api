export const CanalPedido = {
  APP: 'APP',
  TOTEM: 'TOTEM',
  BALCAO: 'BALCAO',
  PICKUP: 'PICKUP',
  WEB: 'WEB',
} as const;

export type CanalPedido = (typeof CanalPedido)[keyof typeof CanalPedido];

export const StatusPedido = {
  AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
  EM_PREPARO: 'EM_PREPARO',
  PRONTO: 'PRONTO',
  ENTREGUE: 'ENTREGUE',
  PAGAMENTO_RECUSADO: 'PAGAMENTO_RECUSADO',
  CANCELADO: 'CANCELADO',
} as const;

export type StatusPedido = (typeof StatusPedido)[keyof typeof StatusPedido];

export const StatusOperacionalPedido = {
  PRONTO: StatusPedido.PRONTO,
  ENTREGUE: StatusPedido.ENTREGUE,
} as const;

export type StatusOperacionalPedido =
  (typeof StatusOperacionalPedido)[keyof typeof StatusOperacionalPedido];

export const TipoDesconto = {
  PERCENTUAL: 'PERCENTUAL',
  VALOR_FIXO: 'VALOR_FIXO',
} as const;

export type TipoDesconto = (typeof TipoDesconto)[keyof typeof TipoDesconto];
