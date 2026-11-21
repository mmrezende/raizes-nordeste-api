import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PaginacaoInput, ResultadoPaginado } from '@application/use-cases/unidades/unidades.service';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface ListarAuditoriaInput extends PaginacaoInput {
  entidade?: string;
  acao?: string;
}

export interface LogAuditoriaItem {
  id: string;
  usuarioId: string | null;
  acao: string;
  entidade: string;
  entidadeId: string;
  metadados: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: Date;
}

function parseMetadados(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarAuditoriaInput): Promise<ResultadoPaginado<LogAuditoriaItem>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LogAuditoriaWhereInput = {};
    if (query.entidade?.trim()) {
      where.entidade = query.entidade.trim();
    }
    if (query.acao?.trim()) {
      where.acao = query.acao.trim();
    }

    const [total, registros] = await Promise.all([
      this.prisma.logAuditoria.count({ where }),
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: registros.map((item) => ({
        id: item.id,
        usuarioId: item.usuarioId,
        acao: item.acao,
        entidade: item.entidade,
        entidadeId: item.entidadeId,
        metadados: parseMetadados(item.metadados),
        requestId: item.requestId,
        createdAt: item.createdAt,
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
