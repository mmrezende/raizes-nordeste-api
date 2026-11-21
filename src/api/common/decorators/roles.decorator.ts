import { Reflector } from '@nestjs/core';
import type { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';

export const Roles = Reflector.createDecorator<PerfilUsuario[]>();
