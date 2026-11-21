import { Injectable } from '@nestjs/common';
import { StatusPagamento } from '@prisma/client';
import type {
  PaymentGateway,
  ProcessarPagamentoGatewayInput,
  ProcessarPagamentoGatewayOutput,
} from '@application/ports/payment-gateway.interface';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async processar(input: ProcessarPagamentoGatewayInput): Promise<ProcessarPagamentoGatewayOutput> {
    const aprovado = !input.simularRecusa;
    const status = aprovado ? StatusPagamento.APROVADO : StatusPagamento.RECUSADO;
    const processadoEm = new Date();
    const referenciaExterna = `MOCK-${input.formaPagamento}-${processadoEm.getTime()}`;

    const payloadRetorno = JSON.stringify({
      provider: 'raizes-mock-gateway',
      aprovado,
      motivo: aprovado ? null : 'RECUSA_SIMULADA_GATEWAY',
      formaPagamento: input.formaPagamento,
      valorCentavos: input.valorCentavos,
      idempotencyKey: input.idempotencyKey,
      referenciaExterna,
    });

    return {
      status,
      referenciaExterna,
      payloadRetorno,
      processadoEm,
    };
  }
}
