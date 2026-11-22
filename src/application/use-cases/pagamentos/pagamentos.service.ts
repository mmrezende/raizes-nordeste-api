import { Inject, Injectable } from '@nestjs/common';
import type { Pagamento } from '@prisma/client';
import { validarAcessoPedido } from '@application/common/acesso-escopo.util';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import { PAYMENT_GATEWAY, type PaymentGateway } from '@application/ports/payment-gateway.interface';
import { estornarReservasDoPedido } from '@application/use-cases/pedidos/pedido-estorno.helper';
import { TipoMovimentacaoFidelidade } from '@domain/enums/fidelidade.enum';
import { type FormaPagamento, StatusPagamento } from '@domain/enums/pagamento.enum';
import { StatusPedido } from '@domain/enums/pedido.enum';
import { ConflictDomainError, NotFoundDomainError } from '@domain/errors/domain.error';
import { calcularPontosAcumulo } from '@domain/rules/pedido-calculo.rule';
import { centavosParaReais } from '@domain/utils/money.util';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface ProcessarPagamentoInput {
  pedidoId: string;
  formaPagamento: FormaPagamento;
  idempotencyKey: string;
  simularRecusa?: boolean;
}

export interface PagamentoResultado {
  id: string;
  pedidoId: string;
  unidadeId: string;
  idempotencyKey: string;
  formaPagamento: FormaPagamento;
  status: StatusPagamento;
  valorCentavos: number;
  valor: number;
  referenciaExterna: string | null;
  payloadRetorno: Record<string, unknown> | null;
  processadoEm: Date | null;
  createdAt: Date;
}

export interface ProcessarPagamentoOutput {
  pagamento: PagamentoResultado;
  jaProcessado: boolean;
}

function parsePayloadRetorno(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function formatarPagamento(pagamento: Pagamento, unidadeId: string): PagamentoResultado {
  return {
    id: pagamento.id,
    pedidoId: pagamento.pedidoId,
    unidadeId,
    idempotencyKey: pagamento.idempotencyKey,
    formaPagamento: pagamento.formaPagamento,
    status: pagamento.status,
    valorCentavos: pagamento.valorCentavos,
    valor: centavosParaReais(pagamento.valorCentavos),
    referenciaExterna: pagamento.referenciaExterna,
    payloadRetorno: parsePayloadRetorno(pagamento.payloadRetorno),
    processadoEm: pagamento.processadoEm,
    createdAt: pagamento.createdAt,
  };
}

const MENSAGENS_ACESSO_PAGAMENTO = {
  cliente: 'Você só pode pagar seus próprios pedidos.',
  unidade: 'Você só pode operar pagamentos da sua própria unidade.',
};

@Injectable()
export class PagamentosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
  ) {}

  async processar(
    input: ProcessarPagamentoInput,
    ator: UsuarioAutenticado,
  ): Promise<ProcessarPagamentoOutput> {
    const existente = await this.prisma.pagamento.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: {
        pedido: {
          select: { clienteId: true, unidadeId: true },
        },
      },
    });

    if (existente) {
      if (existente.pedidoId !== input.pedidoId) {
        throw new ConflictDomainError(
          'Chave de idempotência já utilizada para outro pedido.',
          [{ field: 'idempotencyKey', issue: 'Chave vinculada a outro pedido.' }],
          'IDEMPOTENCY_KEY_CONFLITO',
        );
      }

      validarAcessoPedido(existente.pedido, ator, MENSAGENS_ACESSO_PAGAMENTO);
      return {
        pagamento: formatarPagamento(existente, existente.pedido.unidadeId),
        jaProcessado: true,
      };
    }

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: input.pedidoId },
      include: { itens: true },
    });

    if (!pedido) {
      throw new NotFoundDomainError('Pedido não encontrado.', [], 'PEDIDO_NAO_ENCONTRADO');
    }

    validarAcessoPedido(pedido, ator, MENSAGENS_ACESSO_PAGAMENTO);

    if (pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO) {
      throw new ConflictDomainError(
        'Este pedido não está aguardando pagamento.',
        [{ field: 'pedidoId', issue: `Status atual: ${pedido.status}` }],
        'PEDIDO_NAO_PAGAVEL',
      );
    }

    const retornoGateway = await this.paymentGateway.processar({
      pedidoId: pedido.id,
      valorCentavos: pedido.valorTotalCentavos,
      formaPagamento: input.formaPagamento,
      idempotencyKey: input.idempotencyKey,
      simularRecusa: input.simularRecusa,
    });

    const pagamentoCriado = await this.prisma.$transaction(async (tx) => {
      const novoStatusPedido =
        retornoGateway.status === StatusPagamento.APROVADO
          ? StatusPedido.EM_PREPARO
          : StatusPedido.PAGAMENTO_RECUSADO;

      const pedidoAtualizado = await tx.pedido.updateMany({
        where: {
          id: pedido.id,
          status: StatusPedido.AGUARDANDO_PAGAMENTO,
        },
        data: { status: novoStatusPedido },
      });

      if (pedidoAtualizado.count === 0) {
        throw new ConflictDomainError(
          'Este pedido não está aguardando pagamento.',
          [{ field: 'pedidoId', issue: 'Status alterado concorrentemente.' }],
          'PEDIDO_NAO_PAGAVEL',
        );
      }

      const pagamento = await tx.pagamento.create({
        data: {
          id: this.idGenerator.generate(),
          pedidoId: pedido.id,
          idempotencyKey: input.idempotencyKey,
          formaPagamento: input.formaPagamento,
          status: retornoGateway.status,
          valorCentavos: pedido.valorTotalCentavos,
          referenciaExterna: retornoGateway.referenciaExterna,
          payloadRetorno: retornoGateway.payloadRetorno,
          processadoEm: retornoGateway.processadoEm,
        },
      });

      if (retornoGateway.status === StatusPagamento.APROVADO) {
        const pontosAcumulo = calcularPontosAcumulo(pedido.valorTotalCentavos);
        if (pontosAcumulo > 0) {
          const conta = await tx.contaFidelidade.findUnique({
            where: { usuarioId: pedido.clienteId },
            select: { id: true, consentimentoAtivo: true },
          });

          if (conta && conta.consentimentoAtivo) {
            await tx.contaFidelidade.update({
              where: { id: conta.id },
              data: { saldoPontos: { increment: pontosAcumulo } },
            });

            await tx.movimentacaoFidelidade.create({
              data: {
                id: this.idGenerator.generate(),
                contaFidelidadeId: conta.id,
                pedidoId: pedido.id,
                tipo: TipoMovimentacaoFidelidade.ACUMULO,
                pontos: pontosAcumulo,
                descricao: 'Acúmulo de pontos por pagamento aprovado',
              },
            });
          }
        }
      } else {
        await estornarReservasDoPedido(tx, this.idGenerator, {
          pedido,
          atorUsuarioId: ator.id,
          motivo: 'Estorno automático por pagamento recusado',
        });
      }

      return pagamento;
    });

    return {
      pagamento: formatarPagamento(pagamentoCriado, pedido.unidadeId),
      jaProcessado: false,
    };
  }
}
