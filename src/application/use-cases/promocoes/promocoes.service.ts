import { Inject, Injectable } from '@nestjs/common';
import { type CanalPedido, type Prisma, type Promocao, TipoDesconto } from '@prisma/client';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import type { PaginacaoInput, ResultadoPaginado } from '@application/use-cases/unidades/unidades.service';
import {
  ConflictDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '@domain/errors/domain.error';
import { centavosParaReais } from '@domain/utils/money.util';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface CriarPromocaoInput {
  codigo: string;
  descricao: string;
  tipoDesconto: TipoDesconto;
  valorDesconto: number;
  valorMinimoCentavos?: number;
  unidadeId?: string | null;
  canalAplicavel?: CanalPedido | null;
  inicioEm: string;
  fimEm: string;
  ativo?: boolean;
}

export interface ListarPromocoesInput extends PaginacaoInput {
  ativo?: boolean;
  canalAplicavel?: CanalPedido;
  unidadeId?: string;
}

export interface PromocaoItem {
  id: string;
  unidadeId: string | null;
  codigo: string;
  descricao: string;
  tipoDesconto: TipoDesconto;
  valorDesconto: number;
  valorMinimoCentavos: number;
  valorMinimo: number;
  canalAplicavel: CanalPedido | null;
  inicioEm: Date;
  fimEm: Date;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function mapearPromocao(promocao: Promocao): PromocaoItem {
  return {
    id: promocao.id,
    unidadeId: promocao.unidadeId,
    codigo: promocao.codigo,
    descricao: promocao.descricao,
    tipoDesconto: promocao.tipoDesconto,
    valorDesconto: promocao.valorDesconto,
    valorMinimoCentavos: promocao.valorMinimoCentavos,
    valorMinimo: centavosParaReais(promocao.valorMinimoCentavos),
    canalAplicavel: promocao.canalAplicavel,
    inicioEm: promocao.inicioEm,
    fimEm: promocao.fimEm,
    ativo: promocao.ativo,
    createdAt: promocao.createdAt,
    updatedAt: promocao.updatedAt,
  };
}

@Injectable()
export class PromocoesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async criar(input: CriarPromocaoInput): Promise<PromocaoItem> {
    const codigoNormalizado = input.codigo.trim().toUpperCase();
    const inicioEm = new Date(input.inicioEm);
    const fimEm = new Date(input.fimEm);

    if (Number.isNaN(inicioEm.getTime()) || Number.isNaN(fimEm.getTime()) || fimEm <= inicioEm) {
      throw new ValidationDomainError(
        'A data final deve ser posterior à data inicial.',
        [{ field: 'fimEm', issue: 'Deve ser posterior a inicioEm' }],
      );
    }

    if (input.tipoDesconto === TipoDesconto.PERCENTUAL && input.valorDesconto > 100) {
      throw new ValidationDomainError(
        'Desconto percentual deve estar entre 1 e 100.',
        [{ field: 'valorDesconto', issue: 'Máximo 100%' }],
      );
    }

    const existente = await this.prisma.promocao.findUnique({
      where: { codigo: codigoNormalizado },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictDomainError(
        'Já existe uma promoção cadastrada com este código.',
        [{ field: 'codigo', issue: 'Código de promoção já cadastrado.' }],
        'CODIGO_PROMOCAO_JA_CADASTRADO',
      );
    }

    if (input.unidadeId) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: input.unidadeId },
        select: { id: true },
      });

      if (!unidade) {
        throw new NotFoundDomainError('Unidade não encontrada.', [], 'UNIDADE_NAO_ENCONTRADA');
      }
    }

    const criada = await this.prisma.promocao.create({
      data: {
        id: this.idGenerator.generate(),
        unidadeId: input.unidadeId ?? null,
        codigo: codigoNormalizado,
        descricao: input.descricao.trim(),
        tipoDesconto: input.tipoDesconto,
        valorDesconto: input.valorDesconto,
        valorMinimoCentavos: input.valorMinimoCentavos ?? 0,
        canalAplicavel: input.canalAplicavel ?? null,
        inicioEm,
        fimEm,
        ativo: input.ativo ?? true,
      },
    });

    return mapearPromocao(criada);
  }

  async listar(query: ListarPromocoesInput): Promise<ResultadoPaginado<PromocaoItem>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PromocaoWhereInput = {};
    if (query.ativo !== undefined) {
      where.ativo = query.ativo;
    }
    if (query.canalAplicavel !== undefined) {
      where.canalAplicavel = query.canalAplicavel;
    }
    if (query.unidadeId !== undefined) {
      where.unidadeId = query.unidadeId;
    }

    const [total, registros] = await Promise.all([
      this.prisma.promocao.count({ where }),
      this.prisma.promocao.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: registros.map(mapearPromocao),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
