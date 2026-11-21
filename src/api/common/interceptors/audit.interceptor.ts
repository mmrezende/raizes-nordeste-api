import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mergeMap, type Observable } from 'rxjs';
import { AUDIT_LOGGER, type AuditLogger } from '../../../application/ports/audit-logger.interface';
import { Auditable } from '../decorators/auditable.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import type { RequestWithId } from '../middlewares/request-id.middleware';

interface AuditableRequest extends RequestWithId {
  user?: AuthenticatedUser;
}

const SAFE_RESPONSE_FIELDS = ['status', 'canalPedido', 'perfil', 'unidadeId', 'tipo'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractResponseEntityId(data: unknown): string | null {
  if (!isRecord(data)) {
    return null;
  }
  if (typeof data.id === 'string') {
    return data.id;
  }
  if (isRecord(data.saldo) && typeof data.saldo.id === 'string') {
    return data.saldo.id;
  }
  if (isRecord(data.movimentacao) && typeof data.movimentacao.id === 'string') {
    return data.movimentacao.id;
  }
  return null;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride(Auditable, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();

    return next.handle().pipe(
      mergeMap(async (responseData: unknown) => {
        const responseId = extractResponseEntityId(responseData);
        const paramId = typeof request.params?.id === 'string' ? request.params.id : null;
        const entidadeId = responseId ?? paramId ?? 'N/A';
        const usuarioId = request.user?.id ?? (meta.entidade === 'usuarios' ? responseId : null);

        const metadados: Record<string, unknown> = {
          method: request.method,
          path: request.originalUrl || request.url,
        };

        if (isRecord(responseData)) {
          for (const field of SAFE_RESPONSE_FIELDS) {
            if (responseData[field] !== undefined) {
              metadados[field] = responseData[field];
            }
          }
        }

        await this.auditLogger.registrar({
          usuarioId,
          acao: meta.acao,
          entidade: meta.entidade,
          entidadeId,
          metadados,
          requestId: request.requestId ?? null,
        });

        return responseData;
      }),
    );
  }
}
