import { Reflector } from '@nestjs/core';

export interface AuditableMetadata {
  acao: string;
  entidade: string;
}

export const Auditable = Reflector.createDecorator<AuditableMetadata>();
