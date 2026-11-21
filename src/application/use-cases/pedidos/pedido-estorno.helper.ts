import type { Prisma } from '@prisma/client';
import type { IdGenerator } from '@application/ports/id-generator.interface';
import { TipoMovimentacaoFidelidade } from '@domain/enums/fidelidade.enum';
import { TipoMovimentacaoEstoque } from '@domain/enums/tipo-movimentacao-estoque.enum';

export interface EstornoPedidoContext {
  pedido: {
    id: string;
    unidadeId: string;
    clienteId: string;
    pontosUtilizados: number;
    itens: { produtoId: string; quantidade: number }[];
  };
  atorUsuarioId: string;
  motivo: string;
}

export async function estornarReservasDoPedido(
  tx: Prisma.TransactionClient,
  idGenerator: IdGenerator,
  context: EstornoPedidoContext,
): Promise<void> {
  const { pedido, atorUsuarioId, motivo } = context;

  for (const item of pedido.itens) {
    const estoque = await tx.estoqueUnidade.findUnique({
      where: {
        unidadeId_produtoId: {
          unidadeId: pedido.unidadeId,
          produtoId: item.produtoId,
        },
      },
      select: { id: true },
    });

    if (estoque) {
      await tx.estoqueUnidade.update({
        where: { id: estoque.id },
        data: { quantidadeDisponivel: { increment: item.quantidade } },
      });

      await tx.movimentacaoEstoque.create({
        data: {
          id: idGenerator.generate(),
          estoqueUnidadeId: estoque.id,
          usuarioId: atorUsuarioId,
          pedidoId: pedido.id,
          tipo: TipoMovimentacaoEstoque.ESTORNO,
          quantidade: item.quantidade,
          motivo,
        },
      });
    }
  }

  if (pedido.pontosUtilizados > 0) {
    const conta = await tx.contaFidelidade.findUnique({
      where: { usuarioId: pedido.clienteId },
      select: { id: true },
    });

    if (conta) {
      await tx.contaFidelidade.update({
        where: { id: conta.id },
        data: { saldoPontos: { increment: pedido.pontosUtilizados } },
      });

      await tx.movimentacaoFidelidade.create({
        data: {
          id: idGenerator.generate(),
          contaFidelidadeId: conta.id,
          pedidoId: pedido.id,
          tipo: TipoMovimentacaoFidelidade.ESTORNO,
          pontos: pedido.pontosUtilizados,
          descricao: motivo,
        },
      });
    }
  }
}
