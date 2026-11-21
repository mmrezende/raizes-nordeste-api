import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@api/common/decorators/current-user.decorator';
import { RolesGuard } from '@api/common/guards/roles.guard';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { ForbiddenDomainError, UnauthorizedDomainError } from '@domain/errors/domain.error';

function createMockContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('deve liberar acesso quando a rota não define @Roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('deve liberar acesso quando o usuário possui um dos perfis exigidos', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PerfilUsuario.ADMIN, PerfilUsuario.GERENTE]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    const permitido = guard.canActivate(
      createMockContext({
        id: 'usr-1',
        email: 'gerente@raizes.com',
        perfil: PerfilUsuario.GERENTE,
        unidadeId: 'uni-1',
      }),
    );

    expect(permitido).toBe(true);
  });

  it('deve lançar UnauthorizedDomainError quando req.user não estiver presente', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PerfilUsuario.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(createMockContext(undefined))).toThrow(UnauthorizedDomainError);
  });

  it('deve lançar ForbiddenDomainError quando o perfil do usuário não tiver permissão', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PerfilUsuario.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(
        createMockContext({
          id: 'usr-2',
          email: 'cliente@exemplo.com',
          perfil: PerfilUsuario.CLIENTE,
          unidadeId: null,
        }),
      ),
    ).toThrow(ForbiddenDomainError);
  });
});
