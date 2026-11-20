import { SetMetadata } from '@nestjs/common';
import type { PerfilUsuario } from '../../../domain/enums/perfil-usuario.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: PerfilUsuario[]) => SetMetadata(ROLES_KEY, roles);
