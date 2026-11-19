export interface ErrorDetail {
  field: string;
  issue: string;
}

export class DomainError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details: ErrorDetail[];

  constructor(code: string, message: string, httpStatus: number, details: ErrorDetail[] = []) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class ValidationDomainError extends DomainError {
  constructor(
    message = 'Dados de entrada inválidos.',
    details: ErrorDetail[] = [],
    code = 'ERRO_VALIDACAO',
  ) {
    super(code, message, 422, details);
  }
}

export class UnauthorizedDomainError extends DomainError {
  constructor(
    message = 'Autenticação necessária.',
    details: ErrorDetail[] = [],
    code = 'NAO_AUTENTICADO',
  ) {
    super(code, message, 401, details);
  }
}

export class ForbiddenDomainError extends DomainError {
  constructor(
    message = 'Você não tem permissão para executar esta ação.',
    details: ErrorDetail[] = [],
    code = 'ACESSO_NEGADO',
  ) {
    super(code, message, 403, details);
  }
}

export class NotFoundDomainError extends DomainError {
  constructor(
    message = 'Recurso não encontrado.',
    details: ErrorDetail[] = [],
    code = 'RECURSO_NAO_ENCONTRADO',
  ) {
    super(code, message, 404, details);
  }
}

export class ConflictDomainError extends DomainError {
  constructor(
    message = 'Conflito com regra de negócio.',
    details: ErrorDetail[] = [],
    code = 'CONFLITO_NEGOCIO',
  ) {
    super(code, message, 409, details);
  }
}
