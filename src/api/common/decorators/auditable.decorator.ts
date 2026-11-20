import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableMetadata {
  acao: string;
  entidade: string;
}

export const Auditable = (acao: string, entidade: string) =>
  SetMetadata(AUDITABLE_KEY, { acao, entidade } satisfies AuditableMetadata);
