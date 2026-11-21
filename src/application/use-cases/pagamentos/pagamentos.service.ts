import { Inject, Injectable } from '@nestjs/common';
import {
  type FormaPagamento,
  type Pagamento,
  StatusPagamento,
  StatusPedido,
  TipoMovimentacaoFidelidade,
} from '@prisma/client';
import type { AuthenticatedUser } from '@api/common/decorators/current-user.decorator';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import { PAYMENT_GATEWAY, type PaymentGateway } from '@application/ports/payment-gateway.interface';
import { estornarReservasDoPedido } from '@application/use-cases/pedidos/pedido-estorno.helper';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
} from '@domain/errors/domain.error';
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
  idempotencyKey: string;
  formaPagamento: FormaPagamento;
  status: StatusPagamento;
  valorCentavos: number;
  valor: number;
  referenciaExterna: string | null;
  processadoEm: Date | null;
  createdAt: Date;
}

export interface ProcessarPagamentoOutput {
  pagamento: PagamentoResultado;
  jaProcessado: boolean;
}

function formatarPagamento(pagamento: Pagamento): PagamentoResultado {
  return {
    id: pagamento.id,
    pedidoId: pagamento.pedidoId,
    idempotencyKey: pagamento.idempotencyKey,
    formaPagamento: pagamento.formaPagamento,
    status: pagamento.status,
    valorCentavos: pagamento.valorCentavos,
    valor: centavosParaReais(pagamento.valorCentavos),
    referenciaExterna: pagamento.referenciaExterna,
    processadoEm: pagamento.processadoEm,
    createdAt: pagamento.createdAt,
  };
}

function validarAcessoAoPedido(
  pedido: { clienteId: string; unidadeId: string },
  ator: AuthenticatedUser,
): void {
  if (ator.perfil === PerfilUsuario.CLIENTE && pedido.clienteId !== ator.id) {
    throw new ForbiddenDomainError(
      'Você só pode pagar seus próprios pedidos.',
      [],
      'ACESSO_NEGADO',
    );
  }

  if (
    ator.perfil !== PerfilUsuario.CLIENTE &&
    ator.perfil !== PerfilUsuario.ADMIN &&
    pedido.unidadeId !== ator.unidadeId
  ) {
    throw new ForbiddenDomainError(
      'Você só pode operar pagamentos da sua própria unidade.',
      [],
      'ACESSO_NEGADO',
    );
  }
}

@Injectable()
export class PagamentosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
  ) {}

  async processar(
    input: ProcessarPagamentoInput,
    ator: AuthenticatedUser,
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

      validarAcessoAoPedido(existente.pedido, ator);
      return {
        pagamento: formatarPagamento(existente),
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

    validarAcessoAoPedido(pedido, ator);

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
        await tx.pedido.update({
          where: { id: pedido.id },
          data: { status: StatusPedido.EM_PREPARO },
        });

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
        await tx.pedido.update({
          where: { id: pedido.id },
          data: { status: StatusPedido.PAGAMENTO_RECUSADO },
        });

        await estornarReservasDoPedido(tx, this.idGenerator, {
          pedido,
          atorUsuarioId: ator.id,
          motivo: 'Estorno automático por pagamento recusado',
        });
      }

      return pagamento;
    });

    return {
      pagamento: formatarPagamento(pagamentoCriado),
      jaProcessado: false,
    };
  }
}
