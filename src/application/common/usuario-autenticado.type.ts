import type { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  perfil: PerfilUsuario;
  unidadeId: string | null;
}
