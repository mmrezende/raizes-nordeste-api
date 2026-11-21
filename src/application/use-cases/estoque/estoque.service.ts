import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../api/common/decorators/current-user.decorator';
import { PerfilUsuario } from '../../../domain/enums/perfil-usuario.enum';
import { TipoMovimentacaoManualEstoque } from '../../../domain/enums/tipo-movimentacao-estoque.enum';
import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
} from '../../../domain/errors/domain.error';
import { centavosParaReais } from '../../../domain/utils/money.util';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { ID_GENERATOR, type IdGenerator } from '../../ports/id-generator.interface';
import type { PaginacaoInput, ResultadoPaginado } from '../unidades/unidades.service';

export interface MovimentarEstoqueInput {
  unidadeId: string;
  produtoId: string;
  tipo: TipoMovimentacaoManualEstoque;
  quantidade: number;
  motivo?: string;
}

export interface MovimentacaoEstoqueResultado {
  movimentacao: {
    id: string;
    estoqueUnidadeId: string;
    usuarioId: string;
    tipo: string;
    quantidade: number;
    motivo: string | null;
    createdAt: Date;
  };
  saldo: {
    id: string;
    unidadeId: string;
    produtoId: string;
    quantidadeDisponivel: number;
    disponivelVenda: boolean;
  };
}

export interface EstoqueUnidadeItem {
  produtoId: string;
  nome: string;
  categoria: string;
  precoCentavos: number;
  preco: number;
  quantidadeDisponivel: number;
  disponivelVenda: boolean;
}

@Injectable()
export class EstoqueService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async movimentar(
    input: MovimentarEstoqueInput,
    ator: AuthenticatedUser,
  ): Promise<MovimentacaoEstoqueResultado> {
    this.validarEscopoUnidade(ator, input.unidadeId);

    const [unidade, produto] = await Promise.all([
      this.prisma.unidade.findUnique({ where: { id: input.unidadeId }, select: { id: true } }),
      this.prisma.produto.findUnique({ where: { id: input.produtoId }, select: { id: true } }),
    ]);

    if (!unidade) {
      throw new NotFoundDomainError('Unidade não encontrada.', [], 'UNIDADE_NAO_ENCONTRADA');
    }
    if (!produto) {
      throw new NotFoundDomainError('Produto não encontrado.', [], 'PRODUTO_NAO_ENCONTRADO');
    }

    return this.prisma.$transaction(async (tx) => {
      const estoqueAtual = await tx.estoqueUnidade.findUnique({
        where: {
          unidadeId_produtoId: {
            unidadeId: input.unidadeId,
            produtoId: input.produtoId,
          },
        },
      });

      const saldoAtual = estoqueAtual?.quantidadeDisponivel ?? 0;

      if (input.tipo === TipoMovimentacaoManualEstoque.SAIDA && saldoAtual < input.quantidade) {
        throw new ConflictDomainError(
          'Não há saldo suficiente em estoque.',
          [{ field: 'quantidade', issue: `Disponível: ${saldoAtual}` }],
          'ESTOQUE_INSUFICIENTE',
        );
      }

      const novoSaldo =
        input.tipo === TipoMovimentacaoManualEstoque.ENTRADA
          ? saldoAtual + input.quantidade
          : saldoAtual - input.quantidade;

      const saldo = estoqueAtual
        ? await tx.estoqueUnidade.update({
            where: { id: estoqueAtual.id },
            data: { quantidadeDisponivel: novoSaldo },
          })
        : await tx.estoqueUnidade.create({
            data: {
              id: this.idGenerator.generate(),
              unidadeId: input.unidadeId,
              produtoId: input.produtoId,
              quantidadeDisponivel: novoSaldo,
              disponivelVenda: true,
            },
          });

      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          id: this.idGenerator.generate(),
          estoqueUnidadeId: saldo.id,
          usuarioId: ator.id,
          pedidoId: null,
          tipo: input.tipo,
          quantidade: input.quantidade,
          motivo: input.motivo?.trim() || null,
        },
      });

      return {
        movimentacao: {
          id: movimentacao.id,
          estoqueUnidadeId: movimentacao.estoqueUnidadeId,
          usuarioId: movimentacao.usuarioId,
          tipo: movimentacao.tipo,
          quantidade: movimentacao.quantidade,
          motivo: movimentacao.motivo,
          createdAt: movimentacao.createdAt,
        },
        saldo: {
          id: saldo.id,
          unidadeId: saldo.unidadeId,
          produtoId: saldo.produtoId,
          quantidadeDisponivel: saldo.quantidadeDisponivel,
          disponivelVenda: saldo.disponivelVenda,
        },
      };
    });
  }

  async listarPorUnidade(
    unidadeId: string,
    ator: AuthenticatedUser,
    paginacao: PaginacaoInput,
  ): Promise<ResultadoPaginado<EstoqueUnidadeItem>> {
    this.validarEscopoUnidade(ator, unidadeId);

    const unidade = await this.prisma.unidade.findUnique({
      where: { id: unidadeId },
      select: { id: true },
    });

    if (!unidade) {
      throw new NotFoundDomainError('Unidade não encontrada.', [], 'UNIDADE_NAO_ENCONTRADA');
    }

    const { page, limit } = paginacao;
    const skip = (page - 1) * limit;
    const where = { unidadeId };

    const [total, registros] = await Promise.all([
      this.prisma.estoqueUnidade.count({ where }),
      this.prisma.estoqueUnidade.findMany({
        where,
        include: { produto: true },
        orderBy: { produto: { nome: 'asc' } },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: registros.map((item) => ({
        produtoId: item.produto.id,
        nome: item.produto.nome,
        categoria: item.produto.categoria,
        precoCentavos: item.produto.precoCentavos,
        preco: centavosParaReais(item.produto.precoCentavos),
        quantidadeDisponivel: item.quantidadeDisponivel,
        disponivelVenda: item.disponivelVenda,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private validarEscopoUnidade(ator: AuthenticatedUser, unidadeId: string): void {
    if (ator.perfil !== PerfilUsuario.ADMIN && ator.unidadeId !== unidadeId) {
      throw new ForbiddenDomainError(
        'Você só pode operar no estoque da sua própria unidade.',
        [],
        'ACESSO_NEGADO',
      );
    }
  }
}
