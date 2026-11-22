import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { validarAcessoPedido, validarEscopoUnidade } from '@application/common/acesso-escopo.util';
import {
  calcularOffset,
  montarResultadoPaginado,
  type PaginacaoInput,
  type ResultadoPaginado,
} from '@application/common/paginacao.util';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import { TipoMovimentacaoFidelidade } from '@domain/enums/fidelidade.enum';
import { type CanalPedido, StatusPedido } from '@domain/enums/pedido.enum';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { TipoMovimentacaoEstoque } from '@domain/enums/tipo-movimentacao-estoque.enum';
import {
  ConflictDomainError,
  type ErrorDetail,
  NotFoundDomainError,
  ValidationDomainError,
} from '@domain/errors/domain.error';
import {
  calcularDescontoFidelidade,
  validarECalcularDescontoPromocao,
} from '@domain/rules/pedido-calculo.rule';
import { validarTransicaoStatusPedido, validarCancelamentoPedido } from '@domain/rules/pedido-status.rule';
import { centavosParaReais } from '@domain/utils/money.util';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { estornarReservasDoPedido } from './pedido-estorno.helper';

export interface ItemPedidoInput {
  produtoId: string;
  quantidade: number;
}

export interface CriarPedidoInput {
  unidadeId: string;
  canalPedido: CanalPedido;
  clienteId?: string;
  codigoPromocao?: string;
  pontosResgate?: number;
  itens: ItemPedidoInput[];
}

export interface ListarPedidosInput extends PaginacaoInput {
  canalPedido?: CanalPedido;
  status?: StatusPedido;
  unidadeId?: string;
}

export interface ItemPedidoResultado {
  id: string;
  produtoId: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  precoUnitario: number;
  subtotalCentavos: number;
  subtotal: number;
}

export interface PedidoResultado {
  id: string;
  unidadeId: string;
  clienteId: string;
  promocaoId: string | null;
  canalPedido: CanalPedido;
  status: StatusPedido;
  subtotalCentavos: number;
  subtotal: number;
  descontoPromocaoCentavos: number;
  descontoPromocao: number;
  pontosUtilizados: number;
  descontoFidelidadeCentavos: number;
  descontoFidelidade: number;
  valorTotalCentavos: number;
  valorTotal: number;
  itens: ItemPedidoResultado[];
  createdAt: Date;
  updatedAt: Date;
}

type PedidoComItens = Prisma.PedidoGetPayload<{ include: { itens: true } }>;

function formatarPedido(pedido: PedidoComItens): PedidoResultado {
  return {
    id: pedido.id,
    unidadeId: pedido.unidadeId,
    clienteId: pedido.clienteId,
    promocaoId: pedido.promocaoId,
    canalPedido: pedido.canalPedido,
    status: pedido.status,
    subtotalCentavos: pedido.subtotalCentavos,
    subtotal: centavosParaReais(pedido.subtotalCentavos),
    descontoPromocaoCentavos: pedido.descontoPromocaoCentavos,
    descontoPromocao: centavosParaReais(pedido.descontoPromocaoCentavos),
    pontosUtilizados: pedido.pontosUtilizados,
    descontoFidelidadeCentavos: pedido.descontoFidelidadeCentavos,
    descontoFidelidade: centavosParaReais(pedido.descontoFidelidadeCentavos),
    valorTotalCentavos: pedido.valorTotalCentavos,
    valorTotal: centavosParaReais(pedido.valorTotalCentavos),
    itens: pedido.itens.map((item) => ({
      id: item.id,
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      precoUnitarioCentavos: item.precoUnitarioCentavos,
      precoUnitario: centavosParaReais(item.precoUnitarioCentavos),
      subtotalCentavos: item.subtotalCentavos,
      subtotal: centavosParaReais(item.subtotalCentavos),
    })),
    createdAt: pedido.createdAt,
    updatedAt: pedido.updatedAt,
  };
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async criar(input: CriarPedidoInput, ator: UsuarioAutenticado): Promise<PedidoResultado> {
    if (ator.perfil !== PerfilUsuario.CLIENTE) {
      validarEscopoUnidade(
        ator,
        input.unidadeId,
        'Você só pode criar pedidos para a sua própria unidade.',
      );
    }

    const clienteId =
      ator.perfil === PerfilUsuario.CLIENTE ? ator.id : (input.clienteId ?? ator.id);

    const produtoIds = input.itens.map((item) => item.produtoId);
    if (new Set(produtoIds).size !== produtoIds.length) {
      throw new ValidationDomainError(
        'Não envie o mesmo produto repetido na lista de itens.',
        [{ field: 'itens', issue: 'Existem produtos duplicados no pedido.' }],
      );
    }

    const [unidade, produtos, cliente] = await Promise.all([
      this.prisma.unidade.findUnique({ where: { id: input.unidadeId } }),
      this.prisma.produto.findMany({ where: { id: { in: produtoIds } } }),
      this.prisma.usuario.findUnique({
        where: { id: clienteId },
        select: { id: true, ativo: true, anonimizadoEm: true },
      }),
    ]);

    if (!unidade) {
      throw new NotFoundDomainError('Unidade não encontrada.', [], 'UNIDADE_NAO_ENCONTRADA');
    }
    if (!unidade.ativo) {
      throw new ConflictDomainError('Unidade inativa para receber pedidos.', [], 'UNIDADE_INATIVA');
    }
    if (!cliente || !cliente.ativo || cliente.anonimizadoEm !== null) {
      throw new NotFoundDomainError('Cliente não encontrado.', [], 'USUARIO_NAO_ENCONTRADO');
    }

    const produtosMap = new Map(produtos.map((p) => [p.id, p]));
    const itensCalculados = input.itens.map((item) => {
      const produto = produtosMap.get(item.produtoId);
      if (!produto) {
        throw new NotFoundDomainError(
          'Produto não encontrado.',
          [{ field: 'itens', issue: `Produto ${item.produtoId} não encontrado.` }],
          'PRODUTO_NAO_ENCONTRADO',
        );
      }
      if (!produto.ativo) {
        throw new ValidationDomainError(
          'Produto inativo não pode ser incluído no pedido.',
          [{ field: 'itens', issue: `${produto.nome} está inativo.` }],
          'PRODUTO_INATIVO',
        );
      }

      const itemSubtotal = produto.precoCentavos * item.quantidade;
      return {
        produtoId: produto.id,
        nome: produto.nome,
        quantidade: item.quantidade,
        precoUnitarioCentavos: produto.precoCentavos,
        subtotalCentavos: itemSubtotal,
      };
    });

    const subtotalCentavos = itensCalculados.reduce((acc, item) => acc + item.subtotalCentavos, 0);

    let promocaoId: string | null = null;
    let descontoPromocaoCentavos = 0;

    if (input.codigoPromocao?.trim()) {
      const codigoNormalizado = input.codigoPromocao.trim().toUpperCase();
      const promocao = await this.prisma.promocao.findUnique({
        where: { codigo: codigoNormalizado },
      });

      if (!promocao) {
        throw new ValidationDomainError(
          'Cupom promocional inválido.',
          [{ field: 'codigoPromocao', issue: 'Cupom não encontrado.' }],
          'PROMOCAO_INVALIDA',
        );
      }

      descontoPromocaoCentavos = validarECalcularDescontoPromocao(promocao, {
        subtotalCentavos,
        unidadeId: input.unidadeId,
        canalPedido: input.canalPedido,
      });
      promocaoId = promocao.id;
    }

    const pedidoCriado = await this.prisma.$transaction(async (tx) => {
      const estoques = await tx.estoqueUnidade.findMany({
        where: {
          unidadeId: input.unidadeId,
          produtoId: { in: produtoIds },
        },
      });
      const estoqueMap = new Map(estoques.map((e) => [e.produtoId, e]));
      const detalhesEstoque: ErrorDetail[] = [];

      for (const item of itensCalculados) {
        const estoque = estoqueMap.get(item.produtoId);
        const disponivel = estoque && estoque.disponivelVenda ? estoque.quantidadeDisponivel : 0;
        if (!estoque || !estoque.disponivelVenda || disponivel < item.quantidade) {
          detalhesEstoque.push({
            field: 'itens',
            issue: `${item.nome}: solicitado ${item.quantidade}, disponível ${disponivel}`,
          });
        }
      }

      if (detalhesEstoque.length > 0) {
        throw new ConflictDomainError(
          'Estoque insuficiente na unidade selecionada.',
          detalhesEstoque,
          'ESTOQUE_INSUFICIENTE',
        );
      }

      const valorAposPromocao = subtotalCentavos - descontoPromocaoCentavos;
      const pontosSolicitados = input.pontosResgate ?? 0;
      let pontosUtilizados = 0;
      let descontoFidelidadeCentavos = 0;
      let contaFidelidadeId: string | null = null;

      if (pontosSolicitados > 0) {
        const conta = await tx.contaFidelidade.findUnique({
          where: { usuarioId: clienteId },
        });

        const calculoFidelidade = calcularDescontoFidelidade({
          pontosSolicitados,
          saldoDisponivel: conta?.saldoPontos ?? 0,
          consentimentoAtivo: conta?.consentimentoAtivo ?? false,
          valorRestanteCentavos: valorAposPromocao,
        });

        pontosUtilizados = calculoFidelidade.pontosUtilizados;
        descontoFidelidadeCentavos = calculoFidelidade.descontoCentavos;
        contaFidelidadeId = conta?.id ?? null;
      }

      const valorTotalCentavos = Math.max(0, valorAposPromocao - descontoFidelidadeCentavos);
      const pedidoId = this.idGenerator.generate();

      const pedido = await tx.pedido.create({
        data: {
          id: pedidoId,
          unidadeId: input.unidadeId,
          clienteId,
          promocaoId,
          canalPedido: input.canalPedido,
          status: StatusPedido.AGUARDANDO_PAGAMENTO,
          subtotalCentavos,
          descontoPromocaoCentavos,
          pontosUtilizados,
          descontoFidelidadeCentavos,
          valorTotalCentavos,
          itens: {
            create: itensCalculados.map((item) => ({
              id: this.idGenerator.generate(),
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitarioCentavos: item.precoUnitarioCentavos,
              subtotalCentavos: item.subtotalCentavos,
            })),
          },
        },
        include: { itens: true },
      });

      for (const item of itensCalculados) {
        const estoque = estoqueMap.get(item.produtoId);
        if (!estoque) {
          throw new ConflictDomainError(
            'Estoque insuficiente na unidade selecionada.',
            [{ field: 'itens', issue: `${item.nome}: estoque não encontrado na unidade.` }],
            'ESTOQUE_INSUFICIENTE',
          );
        }

        const atualizado = await tx.estoqueUnidade.updateMany({
          where: {
            id: estoque.id,
            disponivelVenda: true,
            quantidadeDisponivel: { gte: item.quantidade },
          },
          data: {
            quantidadeDisponivel: { decrement: item.quantidade },
          },
        });

        if (atualizado.count === 0) {
          throw new ConflictDomainError(
            'Estoque insuficiente na unidade selecionada.',
            [{ field: 'itens', issue: `${item.nome}: saldo alterado durante a reserva.` }],
            'ESTOQUE_INSUFICIENTE',
          );
        }

        await tx.movimentacaoEstoque.create({
          data: {
            id: this.idGenerator.generate(),
            estoqueUnidadeId: estoque.id,
            usuarioId: ator.id,
            pedidoId,
            tipo: TipoMovimentacaoEstoque.RESERVA,
            quantidade: item.quantidade,
            motivo: 'Reserva automática na criação do pedido',
          },
        });
      }

      if (pontosUtilizados > 0 && contaFidelidadeId) {
        const contaAtualizada = await tx.contaFidelidade.updateMany({
          where: {
            id: contaFidelidadeId,
            consentimentoAtivo: true,
            saldoPontos: { gte: pontosUtilizados },
          },
          data: {
            saldoPontos: { decrement: pontosUtilizados },
          },
        });

        if (contaAtualizada.count === 0) {
          throw new ConflictDomainError(
            'Saldo de pontos insuficiente para o resgate solicitado.',
            [{ field: 'pontosResgate', issue: 'Saldo alterado durante o processamento.' }],
            'SALDO_PONTOS_INSUFICIENTE',
          );
        }

        await tx.movimentacaoFidelidade.create({
          data: {
            id: this.idGenerator.generate(),
            contaFidelidadeId,
            pedidoId,
            tipo: TipoMovimentacaoFidelidade.RESGATE,
            pontos: pontosUtilizados,
            descricao: 'Resgate de pontos como desconto no pedido',
          },
        });
      }

      return pedido;
    });

    return formatarPedido(pedidoCriado);
  }

  async listar(
    query: ListarPedidosInput,
    ator: UsuarioAutenticado,
  ): Promise<ResultadoPaginado<PedidoResultado>> {
    const where: Prisma.PedidoWhereInput = {};

    if (ator.perfil === PerfilUsuario.CLIENTE) {
      where.clienteId = ator.id;
    } else if (ator.perfil !== PerfilUsuario.ADMIN) {
      if (query.unidadeId) {
        validarEscopoUnidade(
          ator,
          query.unidadeId,
          'Você só pode consultar pedidos da sua própria unidade.',
        );
      }
      where.unidadeId = ator.unidadeId ?? '__sem_unidade__';
    } else if (query.unidadeId) {
      where.unidadeId = query.unidadeId;
    }

    if (query.canalPedido) {
      where.canalPedido = query.canalPedido;
    }
    if (query.status) {
      where.status = query.status;
    }

    const skip = calcularOffset(query);

    const [total, registros] = await Promise.all([
      this.prisma.pedido.count({ where }),
      this.prisma.pedido.findMany({
        where,
        include: { itens: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    return montarResultadoPaginado(registros.map(formatarPedido), total, query);
  }

  async buscarPorId(id: string, ator: UsuarioAutenticado): Promise<PedidoResultado> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { itens: true },
    });

    if (!pedido) {
      throw new NotFoundDomainError('Pedido não encontrado.', [], 'PEDIDO_NAO_ENCONTRADO');
    }

    validarAcessoPedido(pedido, ator, {
      cliente: 'Você só pode visualizar seus próprios pedidos.',
      unidade: 'Você só pode visualizar pedidos da sua própria unidade.',
    });

    return formatarPedido(pedido);
  }

  async atualizarStatus(
    id: string,
    novoStatus: StatusPedido,
    ator: UsuarioAutenticado,
  ): Promise<PedidoResultado> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { itens: true },
    });

    if (!pedido) {
      throw new NotFoundDomainError('Pedido não encontrado.', [], 'PEDIDO_NAO_ENCONTRADO');
    }

    validarEscopoUnidade(
      ator,
      pedido.unidadeId,
      'Você só pode atualizar pedidos da sua própria unidade.',
    );

    validarTransicaoStatusPedido({
      statusAtual: pedido.status,
      novoStatus,
      perfil: ator.perfil,
    });

    const atualizado = await this.prisma.pedido.update({
      where: { id },
      data: { status: novoStatus },
      include: { itens: true },
    });

    return formatarPedido(atualizado);
  }

  async cancelar(id: string, ator: UsuarioAutenticado): Promise<PedidoResultado> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { itens: true },
    });

    if (!pedido) {
      throw new NotFoundDomainError('Pedido não encontrado.', [], 'PEDIDO_NAO_ENCONTRADO');
    }

    validarAcessoPedido(pedido, ator, {
      cliente: 'Você só pode cancelar seus próprios pedidos.',
      unidade: 'Você só pode cancelar pedidos da sua própria unidade.',
    });

    validarCancelamentoPedido({
      statusAtual: pedido.status,
      perfil: ator.perfil,
    });

    const pedidoCancelado = await this.prisma.$transaction(async (tx) => {
      const cancelado = await tx.pedido.update({
        where: { id },
        data: { status: StatusPedido.CANCELADO },
        include: { itens: true },
      });

      await estornarReservasDoPedido(tx, this.idGenerator, {
        pedido,
        atorUsuarioId: ator.id,
        motivo: 'Estorno automático por cancelamento do pedido',
      });

      return cancelado;
    });

    return formatarPedido(pedidoCancelado);
  }
}
