import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  calcularOffset,
  montarResultadoPaginado,
  type PaginacaoInput,
  type ResultadoPaginado,
} from '@application/common/paginacao.util';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
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

  async listar(
    query: ListarAuditoriaInput,
    ator: UsuarioAutenticado,
  ): Promise<ResultadoPaginado<LogAuditoriaItem>> {
    if (ator.perfil !== PerfilUsuario.ADMIN && !ator.unidadeId) {
      return montarResultadoPaginado([], 0, query);
    }

    const skip = calcularOffset(query);

    const where: Prisma.LogAuditoriaWhereInput = {};
    if (query.entidade?.trim()) {
      where.entidade = query.entidade.trim();
    }
    if (query.acao?.trim()) {
      where.acao = query.acao.trim();
    }

    if (ator.perfil !== PerfilUsuario.ADMIN && ator.unidadeId) {
      where.OR = [
        { usuario: { unidadeId: ator.unidadeId } },
        { metadados: { contains: `"unidadeId":"${ator.unidadeId}"` } },
      ];
    }

    const [total, registros] = await Promise.all([
      this.prisma.logAuditoria.count({ where }),
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    return montarResultadoPaginado(
      registros.map((item) => ({
        id: item.id,
        usuarioId: item.usuarioId,
        acao: item.acao,
        entidade: item.entidade,
        entidadeId: item.entidadeId,
        metadados: parseMetadados(item.metadados),
        requestId: item.requestId,
        createdAt: item.createdAt,
      })),
      total,
      query,
    );
  }
}
