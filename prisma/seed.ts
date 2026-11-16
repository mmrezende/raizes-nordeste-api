/**
 * Seed inicial do banco de dados (SQLite via Prisma).
 * Será preenchido com unidades, usuários (perfis RBAC), produtos e estoque
 * após a definição e migração do schema.
 */
async function main(): Promise<void> {
  console.log('Seed inicial vazio: aguardando criação dos modelos no schema.prisma.');
}

main().catch((error: unknown) => {
  console.error('Erro ao executar seed:', error);
  process.exit(1);
});
