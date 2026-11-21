import type { FormaPagamento, StatusPagamento } from '@prisma/client';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface ProcessarPagamentoGatewayInput {
  pedidoId: string;
  valorCentavos: number;
  formaPagamento: FormaPagamento;
  idempotencyKey: string;
  simularRecusa?: boolean;
}

export interface ProcessarPagamentoGatewayOutput {
  status: StatusPagamento;
  referenciaExterna: string;
  payloadRetorno: string;
  processadoEm: Date;
}

export interface PaymentGateway {
  processar(input: ProcessarPagamentoGatewayInput): Promise<ProcessarPagamentoGatewayOutput>;
}
