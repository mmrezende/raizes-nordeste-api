import { Reflector } from '@nestjs/core';

export interface AuditableMetadata {
  acao: string;
  entidade: string;
  ignorarQuandoStatus?: number;
}

export const Auditable = Reflector.createDecorator<AuditableMetadata>();
