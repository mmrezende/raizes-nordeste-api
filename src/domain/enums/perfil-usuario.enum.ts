export const PerfilUsuario = {
  CLIENTE: 'CLIENTE',
  ATENDENTE: 'ATENDENTE',
  COZINHA: 'COZINHA',
  GERENTE: 'GERENTE',
  ADMIN: 'ADMIN',
} as const;

export type PerfilUsuario = (typeof PerfilUsuario)[keyof typeof PerfilUsuario];

export const PERFIS_VINCULADOS_UNIDADE: ReadonlySet<PerfilUsuario> = new Set([
  PerfilUsuario.ATENDENTE,
  PerfilUsuario.COZINHA,
  PerfilUsuario.GERENTE,
]);
