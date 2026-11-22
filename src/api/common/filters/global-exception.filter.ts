import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { RequestWithId } from '@api/common/middlewares/request-id.middleware';
import {
  ConflictDomainError,
  DomainError,
  type ErrorDetail,
  ForbiddenDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '@domain/errors/domain.error';
import { gerarUuidV7 } from '@infrastructure/security/uuid-v7.generator';

interface ParsedError {
  status: number;
  error: string;
  message: string;
  details: ErrorDetail[];
}

function mapDomainErrorToStatus(error: DomainError): number {
  if (error instanceof ValidationDomainError) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  if (error instanceof UnauthorizedDomainError) {
    return HttpStatus.UNAUTHORIZED;
  }
  if (error instanceof ForbiddenDomainError) {
    return HttpStatus.FORBIDDEN;
  }
  if (error instanceof NotFoundDomainError) {
    return HttpStatus.NOT_FOUND;
  }
  if (error instanceof ConflictDomainError) {
    return HttpStatus.CONFLICT;
  }
  return HttpStatus.BAD_REQUEST;
}

function mapStatusToErrorCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'REQUISICAO_INVALIDA';
    case HttpStatus.UNAUTHORIZED:
      return 'NAO_AUTENTICADO';
    case HttpStatus.FORBIDDEN:
      return 'ACESSO_NEGADO';
    case HttpStatus.NOT_FOUND:
      return 'RECURSO_NAO_ENCONTRADO';
    case HttpStatus.CONFLICT:
      return 'CONFLITO_NEGOCIO';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'ERRO_VALIDACAO';
    default:
      return 'ERRO_HTTP';
  }
}

function extractHttpExceptionMessage(rawResponse: string | object): string {
  if (typeof rawResponse === 'string') {
    return rawResponse;
  }

  if ('message' in rawResponse) {
    const rawMessage = (rawResponse as { message?: unknown }).message;
    if (typeof rawMessage === 'string') {
      return rawMessage;
    }
    if (Array.isArray(rawMessage)) {
      const messages = rawMessage.filter((item): item is string => typeof item === 'string');
      if (messages.length > 0) {
        return messages.join('; ');
      }
    }
  }

  return 'Erro ao processar requisição.';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();

    const parsed = this.parseException(exception);

    response.status(parsed.status).json({
      error: parsed.error,
      message: parsed.message,
      details: parsed.details,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      requestId: request.requestId ?? gerarUuidV7(),
    });
  }

  private parseException(exception: unknown): ParsedError {
    if (exception instanceof DomainError) {
      return {
        status: mapDomainErrorToStatus(exception),
        error: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        error: mapStatusToErrorCode(status),
        message: extractHttpExceptionMessage(exception.getResponse()),
        details: [],
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      return {
        status: HttpStatus.CONFLICT,
        error: 'CONFLITO_UNICIDADE',
        message: 'Registro duplicado para campo único.',
        details: [],
      };
    }

    const trace =
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
    this.logger.error(`Erro inesperado não tratado: ${trace}`);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'ERRO_INTERNO',
      message: 'Erro interno inesperado no servidor.',
      details: [],
    };
  }
}
