import { Inject, Injectable } from '@nestjs/common';
import { type EstoqueItemBase, mapearItemEstoque } from '@application/common/estoque-item.mapper';
import {
  calcularOffset,
  montarResultadoPaginado,
  type PaginacaoInput,
  type ResultadoPaginado,
} from '@application/common/paginacao.util';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import { ConflictDomainError, NotFoundDomainError } from '@domain/errors/domain.error';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface CriarUnidadeInput {
  codigo: string;
  nome: string;
  endereco: string;
}

export interface UnidadeItem {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardapioItem extends EstoqueItemBase {
  descricao: string | null;
}

@Injectable()
export class UnidadesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async criar(input: CriarUnidadeInput): Promise<UnidadeItem> {
    const codigoNormalizado = input.codigo.trim().toUpperCase();

    const existente = await this.prisma.unidade.findUnique({
      where: { codigo: codigoNormalizado },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictDomainError(
        'Já existe uma unidade cadastrada com este código.',
        [{ field: 'codigo', issue: 'Código de unidade já cadastrado.' }],
        'CODIGO_UNIDADE_JA_CADASTRADO',
      );
    }

    return this.prisma.unidade.create({
      data: {
        id: this.idGenerator.generate(),
        codigo: codigoNormalizado,
        nome: input.nome.trim(),
        endereco: input.endereco.trim(),
      },
    });
  }

  async listar(paginacao: PaginacaoInput): Promise<ResultadoPaginado<UnidadeItem>> {
    const skip = calcularOffset(paginacao);

    const [total, data] = await Promise.all([
      this.prisma.unidade.count({ where: { ativo: true } }),
      this.prisma.unidade.findMany({
        where: { ativo: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: paginacao.limit,
      }),
    ]);

    return montarResultadoPaginado(data, total, paginacao);
  }

  async buscarCardapio(
    unidadeId: string,
    paginacao: PaginacaoInput,
  ): Promise<ResultadoPaginado<CardapioItem>> {
    const unidade = await this.prisma.unidade.findUnique({
      where: { id: unidadeId },
      select: { id: true },
    });

    if (!unidade) {
      throw new NotFoundDomainError('Unidade não encontrada.', [], 'UNIDADE_NAO_ENCONTRADA');
    }

    const skip = calcularOffset(paginacao);
    const where = {
      unidadeId,
      disponivelVenda: true,
      quantidadeDisponivel: { gt: 0 },
      produto: { ativo: true },
    };

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

    return montarResultadoPaginado(
      registros.map((item) => ({
        ...mapearItemEstoque(item),
        descricao: item.produto.descricao,
      })),
      total,
      paginacao,
    );
  }
}
