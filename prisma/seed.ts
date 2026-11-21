import 'dotenv/config';
import { CanalPedido, PerfilUsuario, PrismaClient, TipoDesconto } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const IDS = {
  unidadeRecife: '0193514c-8d12-7000-8000-000000000101',
  unidadeFortaleza: '0193514c-8d12-7000-8000-000000000102',
  produtoTapioca: '0193514c-8d12-7000-8000-000000000201',
  produtoCuscuz: '0193514c-8d12-7000-8000-000000000202',
  produtoBaiao: '0193514c-8d12-7000-8000-000000000203',
  produtoBoloRolo: '0193514c-8d12-7000-8000-000000000204',
  produtoSucoCaja: '0193514c-8d12-7000-8000-000000000205',
  usuarioAdmin: '0193514c-8d12-7000-8000-000000000301',
  usuarioGerente: '0193514c-8d12-7000-8000-000000000302',
  usuarioAtendente: '0193514c-8d12-7000-8000-000000000303',
  usuarioCozinha: '0193514c-8d12-7000-8000-000000000304',
  usuarioCliente: '0193514c-8d12-7000-8000-000000000305',
  contaFidelidadeCliente: '0193514c-8d12-7000-8000-000000000401',
  promoTotem10: '0193514c-8d12-7000-8000-000000000501',
  promoRaizes5: '0193514c-8d12-7000-8000-000000000502',
} as const;

async function main(): Promise<void> {
  const recife = await prisma.unidade.upsert({
    where: { codigo: 'REC-01' },
    update: {
      nome: 'Raízes Boa Viagem',
      endereco: 'Av. Boa Viagem, 1000 - Recife/PE',
      ativo: true,
    },
    create: {
      id: IDS.unidadeRecife,
      codigo: 'REC-01',
      nome: 'Raízes Boa Viagem',
      endereco: 'Av. Boa Viagem, 1000 - Recife/PE',
      ativo: true,
    },
  });

  const fortaleza = await prisma.unidade.upsert({
    where: { codigo: 'FOR-01' },
    update: {
      nome: 'Raízes Meireles',
      endereco: 'Av. Beira Mar, 500 - Fortaleza/CE',
      ativo: true,
    },
    create: {
      id: IDS.unidadeFortaleza,
      codigo: 'FOR-01',
      nome: 'Raízes Meireles',
      endereco: 'Av. Beira Mar, 500 - Fortaleza/CE',
      ativo: true,
    },
  });

  const produtosData = [
    {
      id: IDS.produtoTapioca,
      nome: 'Tapioca Carne de Sol',
      descricao: 'Tapioca artesanal com carne de sol desfiada e queijo coalho',
      categoria: 'TAPIOCAS',
      precoCentavos: 2490,
    },
    {
      id: IDS.produtoCuscuz,
      nome: 'Cuscuz Recheado',
      descricao: 'Cuscuz nordestino com manteiga de garrafa e queijo coalho',
      categoria: 'CUSCUZ',
      precoCentavos: 1890,
    },
    {
      id: IDS.produtoBaiao,
      nome: 'Baião de Dois',
      descricao: 'Arroz, feijão verde, queijo coalho e carne seca na chapa',
      categoria: 'PRATOS',
      precoCentavos: 3200,
    },
    {
      id: IDS.produtoBoloRolo,
      nome: 'Bolo de Rolo Tradicional',
      descricao: 'Fatia generosa de bolo de rolo pernambucano com goiabada',
      categoria: 'SOBREMESAS',
      precoCentavos: 1500,
    },
    {
      id: IDS.produtoSucoCaja,
      nome: 'Suco de Cajá 400ml',
      descricao: 'Suco natural da fruta sem conservantes',
      categoria: 'BEBIDAS',
      precoCentavos: 1100,
    },
  ];

  for (const produto of produtosData) {
    await prisma.produto.upsert({
      where: { id: produto.id },
      update: {
        nome: produto.nome,
        descricao: produto.descricao,
        categoria: produto.categoria,
        precoCentavos: produto.precoCentavos,
        ativo: true,
      },
      create: {
        ...produto,
        ativo: true,
      },
    });
  }

  const estoquesData = [
    { id: '0193514c-8d12-7000-8000-000000000601', unidadeId: recife.id, produtoId: IDS.produtoTapioca, quantidade: 25 },
    { id: '0193514c-8d12-7000-8000-000000000602', unidadeId: recife.id, produtoId: IDS.produtoCuscuz, quantidade: 20 },
    { id: '0193514c-8d12-7000-8000-000000000603', unidadeId: recife.id, produtoId: IDS.produtoBaiao, quantidade: 15 },
    { id: '0193514c-8d12-7000-8000-000000000604', unidadeId: recife.id, produtoId: IDS.produtoBoloRolo, quantidade: 2 },
    { id: '0193514c-8d12-7000-8000-000000000605', unidadeId: recife.id, produtoId: IDS.produtoSucoCaja, quantidade: 30 },
    { id: '0193514c-8d12-7000-8000-000000000606', unidadeId: fortaleza.id, produtoId: IDS.produtoTapioca, quantidade: 12 },
    { id: '0193514c-8d12-7000-8000-000000000607', unidadeId: fortaleza.id, produtoId: IDS.produtoSucoCaja, quantidade: 18 },
  ];

  for (const estoque of estoquesData) {
    await prisma.estoqueUnidade.upsert({
      where: {
        unidadeId_produtoId: {
          unidadeId: estoque.unidadeId,
          produtoId: estoque.produtoId,
        },
      },
      update: {
        quantidadeDisponivel: estoque.quantidade,
        disponivelVenda: true,
      },
      create: {
        id: estoque.id,
        unidadeId: estoque.unidadeId,
        produtoId: estoque.produtoId,
        quantidadeDisponivel: estoque.quantidade,
        disponivelVenda: true,
      },
    });
  }

  const senhaHash = await bcrypt.hash('Senha@123', 10);

  const usuariosData = [
    {
      id: IDS.usuarioAdmin,
      nome: 'Administrador Matriz',
      email: 'admin@raizes.com',
      perfil: PerfilUsuario.ADMIN,
      unidadeId: null,
    },
    {
      id: IDS.usuarioGerente,
      nome: 'Gerente Boa Viagem',
      email: 'gerente.rec@raizes.com',
      perfil: PerfilUsuario.GERENTE,
      unidadeId: recife.id,
    },
    {
      id: IDS.usuarioAtendente,
      nome: 'Atendente Boa Viagem',
      email: 'atendente.rec@raizes.com',
      perfil: PerfilUsuario.ATENDENTE,
      unidadeId: recife.id,
    },
    {
      id: IDS.usuarioCozinha,
      nome: 'Cozinha Boa Viagem',
      email: 'cozinha.rec@raizes.com',
      perfil: PerfilUsuario.COZINHA,
      unidadeId: recife.id,
    },
    {
      id: IDS.usuarioCliente,
      nome: 'Maria Cliente',
      email: 'cliente@exemplo.com',
      perfil: PerfilUsuario.CLIENTE,
      unidadeId: null,
    },
  ];

  for (const usuario of usuariosData) {
    await prisma.usuario.upsert({
      where: { email: usuario.email },
      update: {
        nome: usuario.nome,
        senhaHash,
        perfil: usuario.perfil,
        unidadeId: usuario.unidadeId,
        ativo: true,
        anonimizadoEm: null,
      },
      create: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        senhaHash,
        perfil: usuario.perfil,
        unidadeId: usuario.unidadeId,
        ativo: true,
      },
    });
  }

  const cliente = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'cliente@exemplo.com' },
    select: { id: true },
  });

  await prisma.contaFidelidade.upsert({
    where: { usuarioId: cliente.id },
    update: {
      saldoPontos: 20,
      consentimentoAtivo: true,
      consentimentoEm: new Date(),
      revogadoEm: null,
    },
    create: {
      id: IDS.contaFidelidadeCliente,
      usuarioId: cliente.id,
      saldoPontos: 20,
      consentimentoAtivo: true,
      consentimentoEm: new Date(),
    },
  });

  const agora = Date.now();
  const inicioEm = new Date(agora - 86_400_000);
  const fimEm = new Date(agora + 180 * 86_400_000);

  await prisma.promocao.upsert({
    where: { codigo: 'TOTEM10' },
    update: {
      descricao: '10% de desconto em pedidos realizados pelo Totem',
      tipoDesconto: TipoDesconto.PERCENTUAL,
      valorDesconto: 10,
      valorMinimoCentavos: 2000,
      canalAplicavel: CanalPedido.TOTEM,
      unidadeId: null,
      inicioEm,
      fimEm,
      ativo: true,
    },
    create: {
      id: IDS.promoTotem10,
      codigo: 'TOTEM10',
      descricao: '10% de desconto em pedidos realizados pelo Totem',
      tipoDesconto: TipoDesconto.PERCENTUAL,
      valorDesconto: 10,
      valorMinimoCentavos: 2000,
      canalAplicavel: CanalPedido.TOTEM,
      unidadeId: null,
      inicioEm,
      fimEm,
      ativo: true,
    },
  });

  await prisma.promocao.upsert({
    where: { codigo: 'RAIZES5' },
    update: {
      descricao: 'R$ 5,00 de desconto em qualquer canal a partir de R$ 15,00',
      tipoDesconto: TipoDesconto.VALOR_FIXO,
      valorDesconto: 500,
      valorMinimoCentavos: 1500,
      canalAplicavel: null,
      unidadeId: null,
      inicioEm,
      fimEm,
      ativo: true,
    },
    create: {
      id: IDS.promoRaizes5,
      codigo: 'RAIZES5',
      descricao: 'R$ 5,00 de desconto em qualquer canal a partir de R$ 15,00',
      tipoDesconto: TipoDesconto.VALOR_FIXO,
      valorDesconto: 500,
      valorMinimoCentavos: 1500,
      canalAplicavel: null,
      unidadeId: null,
      inicioEm,
      fimEm,
      ativo: true,
    },
  });

  console.log('Seed executado com sucesso (unidades, produtos, estoques, usuários e promoções).');
}

main()
  .catch((error: unknown) => {
    console.error('Erro ao executar seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
