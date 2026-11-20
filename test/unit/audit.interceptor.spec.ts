import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { AuditInterceptor } from '@src/api/common/interceptors/audit.interceptor';
import type { AuditLogger } from '@src/application/ports/audit-logger.interface';

function createMockContext(options: {
  userId?: string;
  requestId?: string;
  paramsId?: string;
}): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/usuarios',
        url: '/usuarios',
        params: options.paramsId ? { id: options.paramsId } : {},
        requestId: options.requestId,
        user: options.userId ? { id: options.userId } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  it('não deve registrar auditoria quando a rota não possui @Auditable', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const auditLogger: AuditLogger = { registrar: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, auditLogger);

    const next: CallHandler = { handle: () => of({ ok: true }) };
    const result = await firstValueFrom(interceptor.intercept(createMockContext({}), next));

    expect(result).toEqual({ ok: true });
    expect(auditLogger.registrar).not.toHaveBeenCalled();
  });

  it('deve registrar auditoria apenas com metadados seguros, omitindo campos sensíveis', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        acao: 'USUARIO_CRIADO',
        entidade: 'usuarios',
      }),
    };
    const registrar = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, { registrar });

    const payload = {
      id: 'usr-novo',
      perfil: 'ATENDENTE',
      unidadeId: 'uni-1',
      senhaHash: 'segredo-interno',
      accessToken: 'jwt-secreto',
    };

    const next: CallHandler = { handle: () => of(payload) };
    const result = await firstValueFrom(
      interceptor.intercept(createMockContext({ userId: 'admin-1', requestId: 'req-99' }), next),
    );

    expect(result).toEqual(payload);
    expect(registrar).toHaveBeenCalledWith({
      usuarioId: 'admin-1',
      acao: 'USUARIO_CRIADO',
      entidade: 'usuarios',
      entidadeId: 'usr-novo',
      requestId: 'req-99',
      metadados: {
        method: 'POST',
        path: '/usuarios',
        perfil: 'ATENDENTE',
        unidadeId: 'uni-1',
      },
    });
  });

  it('deve usar o id retornado como usuarioId no auto-cadastro público', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        acao: 'USUARIO_CADASTRADO',
        entidade: 'usuarios',
      }),
    };
    const registrar = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, { registrar });

    const next: CallHandler = {
      handle: () => of({ id: 'cliente-1', perfil: 'CLIENTE', unidadeId: null }),
    };

    await firstValueFrom(
      interceptor.intercept(createMockContext({ requestId: 'req-pub' }), next),
    );

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'cliente-1',
        entidadeId: 'cliente-1',
        acao: 'USUARIO_CADASTRADO',
      }),
    );
  });
});
