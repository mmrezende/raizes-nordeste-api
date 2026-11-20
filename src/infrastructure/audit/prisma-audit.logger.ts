import { Inject, Injectable } from '@nestjs/common';
import type { AuditLogger, AuditLogInput } from '../../application/ports/audit-logger.interface';
import { ID_GENERATOR, type IdGenerator } from '../../application/ports/id-generator.interface';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class PrismaAuditLogger implements AuditLogger {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async registrar(input: AuditLogInput): Promise<void> {
    await this.prisma.logAuditoria.create({
      data: {
        id: this.idGenerator.generate(),
        usuarioId: input.usuarioId ?? null,
        acao: input.acao,
        entidade: input.entidade,
        entidadeId: input.entidadeId,
        metadados: input.metadados ? JSON.stringify(input.metadados) : null,
        requestId: input.requestId ?? null,
      },
    });
  }
}
