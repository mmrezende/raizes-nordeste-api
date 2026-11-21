import { Inject, Injectable } from '@nestjs/common';
import type { TipoMovimentacaoFidelidade } from '@prisma/client';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import type { PaginacaoInput, ResultadoPaginado } from '@application/use-cases/unidades/unidades.service';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface ContaFidelidadeItem {
  id: string;
  usuarioId: string;
  saldoPontos: number;
  consentimentoAtivo: boolean;
  consentimentoEm: Date | null;
  revogadoEm: Date | null;
  updatedAt: Date;
}

export interface MovimentacaoFidelidadeItem {
  id: string;
  contaFidelidadeId: string;
  pedidoId: string | null;
  tipo: TipoMovimentacaoFidelidade;
  pontos: number;
  descricao: string | null;
  createdAt: Date;
}

@Injectable()
export class FidelidadeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async buscarConta(usuarioId: string): Promise<ContaFidelidadeItem> {
    const existente = await this.prisma.contaFidelidade.findUnique({
      where: { usuarioId },
    });

    if (existente) {
      return existente;
    }

    return this.prisma.contaFidelidade.create({
      data: {
        id: this.idGenerator.generate(),
        usuarioId,
        saldoPontos: 0,
        consentimentoAtivo: false,
      },
    });
  }

  async atualizarConsentimento(
    usuarioId: string,
    consentimentoAtivo: boolean,
  ): Promise<ContaFidelidadeItem> {
    const conta = await this.buscarConta(usuarioId);
    const agora = new Date();

    return this.prisma.contaFidelidade.update({
      where: { id: conta.id },
      data: consentimentoAtivo
        ? {
            consentimentoAtivo: true,
            consentimentoEm: agora,
            revogadoEm: null,
          }
        : {
            consentimentoAtivo: false,
            revogadoEm: agora,
          },
    });
  }

  async listarMovimentacoes(
    usuarioId: string,
    paginacao: PaginacaoInput,
  ): Promise<ResultadoPaginado<MovimentacaoFidelidadeItem>> {
    const conta = await this.buscarConta(usuarioId);
    const { page, limit } = paginacao;
    const skip = (page - 1) * limit;
    const where = { contaFidelidadeId: conta.id };

    const [total, data] = await Promise.all([
      this.prisma.movimentacaoFidelidade.count({ where }),
      this.prisma.movimentacaoFidelidade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
}
