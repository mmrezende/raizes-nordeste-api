import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictDomainError,
  NotFoundDomainError,
} from '../../../domain/errors/domain.error';
import { centavosParaReais } from '../../../domain/utils/money.util';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { ID_GENERATOR, type IdGenerator } from '../../ports/id-generator.interface';

export interface CriarUnidadeInput {
  codigo: string;
  nome: string;
  endereco: string;
}

export interface PaginacaoInput {
  page: number;
  limit: number;
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

export interface CardapioItem {
  produtoId: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  precoCentavos: number;
  preco: number;
  quantidadeDisponivel: number;
  disponivelVenda: boolean;
}

export interface ResultadoPaginado<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
    const { page, limit } = paginacao;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.unidade.count({ where: { ativo: true } }),
      this.prisma.unidade.findMany({
        where: { ativo: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
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

    const { page, limit } = paginacao;
    const skip = (page - 1) * limit;

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
        take: limit,
      }),
    ]);

    return {
      data: registros.map((item) => ({
        produtoId: item.produto.id,
        nome: item.produto.nome,
        descricao: item.produto.descricao,
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
}
