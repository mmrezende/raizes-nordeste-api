import { Inject, Injectable } from '@nestjs/common';
import {
  calcularOffset,
  montarResultadoPaginado,
  type PaginacaoInput,
  type ResultadoPaginado,
} from '@application/common/paginacao.util';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import type { TipoMovimentacaoFidelidade } from '@domain/enums/fidelidade.enum';
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
    const skip = calcularOffset(paginacao);
    const where = { contaFidelidadeId: conta.id };

    const [total, data] = await Promise.all([
      this.prisma.movimentacaoFidelidade.count({ where }),
      this.prisma.movimentacaoFidelidade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: paginacao.limit,
      }),
    ]);

    return montarResultadoPaginado(data, total, paginacao);
  }
}
