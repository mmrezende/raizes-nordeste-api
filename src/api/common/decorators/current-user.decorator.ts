import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx.switchToHttp().getRequest<{ user: UsuarioAutenticado }>();
    return request.user;
  },
);
