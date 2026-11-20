export const AUDIT_LOGGER = Symbol('AUDIT_LOGGER');

export interface AuditLogInput {
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId: string;
  metadados?: Record<string, unknown>;
  requestId?: string | null;
}

export interface AuditLogger {
  registrar(input: AuditLogInput): Promise<void>;
}
