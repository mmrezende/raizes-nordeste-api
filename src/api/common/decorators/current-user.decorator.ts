import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PerfilUsuario } from '../../../domain/enums/perfil-usuario.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  perfil: PerfilUsuario;
  unidadeId: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
