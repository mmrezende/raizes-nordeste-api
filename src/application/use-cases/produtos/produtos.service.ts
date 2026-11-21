import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import type { PaginacaoInput, ResultadoPaginado } from '@application/use-cases/unidades/unidades.service';
import { centavosParaReais } from '@domain/utils/money.util';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface CriarProdutoInput {
  nome: string;
  descricao?: string | null;
  categoria: string;
  precoCentavos: number;
}

export interface ListarProdutosInput extends PaginacaoInput {
  categoria?: string;
}

export interface ProdutoItem {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  precoCentavos: number;
  preco: number;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async criar(input: CriarProdutoInput): Promise<ProdutoItem> {
    const criado = await this.prisma.produto.create({
      data: {
        id: this.idGenerator.generate(),
        nome: input.nome.trim(),
        descricao: input.descricao?.trim() || null,
        categoria: input.categoria.trim().toUpperCase(),
        precoCentavos: input.precoCentavos,
      },
    });

    return {
      ...criado,
      preco: centavosParaReais(criado.precoCentavos),
    };
  }

  async listar(input: ListarProdutosInput): Promise<ResultadoPaginado<ProdutoItem>> {
    const { page, limit, categoria } = input;
    const skip = (page - 1) * limit;
    const where = {
      ativo: true,
      ...(categoria ? { categoria: categoria.trim().toUpperCase() } : {}),
    };

    const [total, produtos] = await Promise.all([
      this.prisma.produto.count({ where }),
      this.prisma.produto.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: produtos.map((produto) => ({
        ...produto,
        preco: centavosParaReais(produto.precoCentavos),
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
