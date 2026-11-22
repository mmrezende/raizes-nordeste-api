import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { AuditInterceptor } from '@api/common/interceptors/audit.interceptor';

function createMockContext(options: {
  userId?: string;
  userUnidadeId?: string | null;
  requestId?: string;
  paramsId?: string;
  statusCode?: number;
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
        user: options.userId
          ? { id: options.userId, unidadeId: options.userUnidadeId ?? null }
          : undefined,
      }),
      getResponse: () => ({
        statusCode: options.statusCode ?? 201,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  it('não deve registrar auditoria quando a rota não possui @Auditable', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const registrar = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, { registrar });

    const next: CallHandler = { handle: () => of({ ok: true }) };
    const result = await firstValueFrom(interceptor.intercept(createMockContext({}), next));

    expect(result).toEqual({ ok: true });
    expect(registrar).not.toHaveBeenCalled();
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

  it('não deve registrar auditoria quando statusCode coincidir com ignorarQuandoStatus', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        acao: 'PAGAMENTO_PROCESSADO',
        entidade: 'pagamentos',
        ignorarQuandoStatus: 200,
      }),
    };
    const registrar = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, { registrar });

    const next: CallHandler = { handle: () => of({ id: 'pag-1', status: 'APROVADO' }) };
    const result = await firstValueFrom(
      interceptor.intercept(createMockContext({ userId: 'cli-1', statusCode: 200 }), next),
    );

    expect(result).toEqual({ id: 'pag-1', status: 'APROVADO' });
    expect(registrar).not.toHaveBeenCalled();
  });

  it('deve extrair unidadeId de responseData.saldo quando não estiver na raiz', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        acao: 'ESTOQUE_MOVIMENTADO',
        entidade: 'estoque_unidades',
      }),
    };
    const registrar = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor(reflector as unknown as Reflector, { registrar });

    const next: CallHandler = {
      handle: () =>
        of({
          movimentacao: { id: 'mov-1' },
          saldo: { id: 'est-1', unidadeId: 'uni-saldo' },
        }),
    };

    await firstValueFrom(
      interceptor.intercept(createMockContext({ userId: 'admin-1', requestId: 'req-est' }), next),
    );

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidadeId: 'est-1',
        metadados: expect.objectContaining({
          unidadeId: 'uni-saldo',
        }),
      }),
    );
  });
});
