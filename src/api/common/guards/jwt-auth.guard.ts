import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { Public } from '@api/common/decorators/public.decorator';
import { UnauthorizedDomainError } from '@domain/errors/domain.error';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride(Public, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = UsuarioAutenticado>(
    err: unknown,
    user: TUser | false | null,
  ): TUser {
    if (err instanceof Error) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedDomainError(
        'Token de autenticação ausente ou inválido.',
        [],
        'NAO_AUTENTICADO',
      );
    }

    return user;
  }
}
