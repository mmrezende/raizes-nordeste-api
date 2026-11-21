import { PerfilUsuario } from '@prisma/client';

export { PerfilUsuario };

export const PERFIS_VINCULADOS_UNIDADE: ReadonlySet<PerfilUsuario> = new Set([
  PerfilUsuario.ATENDENTE,
  PerfilUsuario.COZINHA,
  PerfilUsuario.GERENTE,
]);
