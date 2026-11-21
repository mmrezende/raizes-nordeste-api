export interface ErrorDetail {
  field: string;
  issue: string;
}

export class DomainError extends Error {
  readonly code: string;
  readonly details: ErrorDetail[];

  constructor(code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationDomainError extends DomainError {
  constructor(
    message = 'Dados de entrada inválidos.',
    details: ErrorDetail[] = [],
    code = 'ERRO_VALIDACAO',
  ) {
    super(code, message, details);
  }
}

export class UnauthorizedDomainError extends DomainError {
  constructor(
    message = 'Autenticação necessária.',
    details: ErrorDetail[] = [],
    code = 'NAO_AUTENTICADO',
  ) {
    super(code, message, details);
  }
}

export class ForbiddenDomainError extends DomainError {
  constructor(
    message = 'Você não tem permissão para executar esta ação.',
    details: ErrorDetail[] = [],
    code = 'ACESSO_NEGADO',
  ) {
    super(code, message, details);
  }
}

export class NotFoundDomainError extends DomainError {
  constructor(
    message = 'Recurso não encontrado.',
    details: ErrorDetail[] = [],
    code = 'RECURSO_NAO_ENCONTRADO',
  ) {
    super(code, message, details);
  }
}

export class ConflictDomainError extends DomainError {
  constructor(
    message = 'Conflito com regra de negócio.',
    details: ErrorDetail[] = [],
    code = 'CONFLITO_NEGOCIO',
  ) {
    super(code, message, details);
  }
}
