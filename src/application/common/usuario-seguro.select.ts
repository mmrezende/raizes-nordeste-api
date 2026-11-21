import type { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';

export interface UsuarioSeguro {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  unidadeId: string | null;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const USUARIO_SEGURO_SELECT = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  unidadeId: true,
  ativo: true,
  createdAt: true,
  updatedAt: true,
} as const;
