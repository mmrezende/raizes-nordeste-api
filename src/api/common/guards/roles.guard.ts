import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PerfilUsuario } from '../../../domain/enums/perfil-usuario.enum';
import { ForbiddenDomainError, UnauthorizedDomainError } from '../../../domain/errors/domain.error';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PerfilUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedDomainError(
        'Token de autenticação ausente ou inválido.',
        [],
        'NAO_AUTENTICADO',
      );
    }

    if (!requiredRoles.includes(user.perfil)) {
      throw new ForbiddenDomainError(
        'Você não tem permissão para acessar este recurso.',
        [],
        'ACESSO_NEGADO',
      );
    }

    return true;
  }
}
