import { Inject, Injectable } from '@nestjs/common';
import { validarEscopoUnidade } from '@application/common/acesso-escopo.util';
import { type EstoqueItemBase, mapearItemEstoque } from '@application/common/estoque-item.mapper';
import {
  calcularOffset,
  montarResultadoPaginado,
  type PaginacaoInput,
  type ResultadoPaginado,
} from '@application/common/paginacao.util';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import { TipoMovimentacaoManualEstoque } from '@domain/enums/tipo-movimentacao-estoque.enum';
import { ConflictDomainError, NotFoundDomainError } from '@domain/errors/domain.error';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

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

export type EstoqueUnidadeItem = EstoqueItemBase;

@Injectable()
export class EstoqueService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async movimentar(
    input: MovimentarEstoqueInput,
    ator: UsuarioAutenticado,
  ): Promise<MovimentacaoEstoqueResultado> {
    validarEscopoUnidade(
      ator,
      input.unidadeId,
      'Você só pode operar no estoque da sua própria unidade.',
    );

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
    ator: UsuarioAutenticado,
    paginacao: PaginacaoInput,
  ): Promise<ResultadoPaginado<EstoqueUnidadeItem>> {
    validarEscopoUnidade(
      ator,
      unidadeId,
      'Você só pode consultar o estoque da sua própria unidade.',
    );

    const unidade = await this.prisma.unidade.findUnique({
      where: { id: unidadeId },
      select: { id: true },
    });

    if (!unidade) {
      throw new NotFoundDomainError('Unidade não encontrada.', [], 'UNIDADE_NAO_ENCONTRADA');
    }

    const skip = calcularOffset(paginacao);
    const where = { unidadeId };

    const [total, registros] = await Promise.all([
      this.prisma.estoqueUnidade.count({ where }),
      this.prisma.estoqueUnidade.findMany({
        where,
        include: { produto: true },
        orderBy: { produto: { nome: 'asc' } },
        skip,
        take: paginacao.limit,
      }),
    ]);

    return montarResultadoPaginado(registros.map(mapearItemEstoque), total, paginacao);
  }
}
