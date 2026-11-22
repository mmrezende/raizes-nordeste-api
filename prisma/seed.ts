import 'dotenv/config';
import { fakerPT_BR as faker } from '@faker-js/faker';
import { CanalPedido, PerfilUsuario, PrismaClient, TipoDesconto } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { uuidv7 } from 'uuidv7';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.logAuditoria.deleteMany();
  await prisma.movimentacaoFidelidade.deleteMany();
  await prisma.contaFidelidade.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.movimentacaoEstoque.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.promocao.deleteMany();
  await prisma.estoqueUnidade.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.unidade.deleteMany();

  const recife = await prisma.unidade.create({
    data: {
      id: uuidv7(),
      codigo: 'REC-01',
      nome: `Raízes ${faker.location.street()}`,
      endereco: `${faker.location.streetAddress({ useFullAddress: true })} - Recife/PE`,
      ativo: true,
    },
  });

  const fortaleza = await prisma.unidade.create({
    data: {
      id: uuidv7(),
      codigo: 'FOR-01',
      nome: `Raízes ${faker.location.street()}`,
      endereco: `${faker.location.streetAddress({ useFullAddress: true })} - Fortaleza/CE`,
      ativo: true,
    },
  });

  const catalogoBase = [
    {
      nome: 'Tapioca Carne de Sol',
      descricao: faker.commerce.productDescription(),
      categoria: 'TAPIOCAS',
      precoCentavos: 2490,
      estoqueRecife: faker.number.int({ min: 15, max: 40 }),
      estoqueFortaleza: faker.number.int({ min: 10, max: 25 }),
    },
    {
      nome: 'Cuscuz Recheado',
      descricao: faker.commerce.productDescription(),
      categoria: 'CUSCUZ',
      precoCentavos: 1890,
      estoqueRecife: faker.number.int({ min: 15, max: 35 }),
      estoqueFortaleza: faker.number.int({ min: 8, max: 20 }),
    },
    {
      nome: 'Baião de Dois',
      descricao: faker.commerce.productDescription(),
      categoria: 'PRATOS',
      precoCentavos: 3200,
      estoqueRecife: faker.number.int({ min: 10, max: 25 }),
      estoqueFortaleza: faker.number.int({ min: 5, max: 15 }),
    },
    {
      nome: 'Bolo de Rolo Tradicional',
      descricao: faker.commerce.productDescription(),
      categoria: 'SOBREMESAS',
      precoCentavos: 1500,
      estoqueRecife: 2,
      estoqueFortaleza: faker.number.int({ min: 6, max: 18 }),
    },
    {
      nome: 'Suco de Cajá 400ml',
      descricao: faker.commerce.productDescription(),
      categoria: 'BEBIDAS',
      precoCentavos: 1100,
      estoqueRecife: faker.number.int({ min: 20, max: 50 }),
      estoqueFortaleza: faker.number.int({ min: 12, max: 30 }),
    },
  ];

  for (const item of catalogoBase) {
    const produto = await prisma.produto.create({
      data: {
        id: uuidv7(),
        nome: item.nome,
        descricao: item.descricao,
        categoria: item.categoria,
        precoCentavos: item.precoCentavos,
        ativo: true,
      },
    });

    await prisma.estoqueUnidade.createMany({
      data: [
        {
          id: uuidv7(),
          unidadeId: recife.id,
          produtoId: produto.id,
          quantidadeDisponivel: item.estoqueRecife,
          disponivelVenda: true,
        },
        {
          id: uuidv7(),
          unidadeId: fortaleza.id,
          produtoId: produto.id,
          quantidadeDisponivel: item.estoqueFortaleza,
          disponivelVenda: true,
        },
      ],
    });
  }

  const senhaHash = await bcrypt.hash('Senha@123', 10);

  const usuarios = [
    {
      email: 'admin@raizes.com',
      perfil: PerfilUsuario.ADMIN,
      unidadeId: null,
    },
    {
      email: 'gerente.rec@raizes.com',
      perfil: PerfilUsuario.GERENTE,
      unidadeId: recife.id,
    },
    {
      email: 'atendente.rec@raizes.com',
      perfil: PerfilUsuario.ATENDENTE,
      unidadeId: recife.id,
    },
    {
      email: 'cozinha.rec@raizes.com',
      perfil: PerfilUsuario.COZINHA,
      unidadeId: recife.id,
    },
    {
      email: 'cliente@exemplo.com',
      perfil: PerfilUsuario.CLIENTE,
      unidadeId: null,
    },
  ];

  for (const u of usuarios) {
    const criado = await prisma.usuario.create({
      data: {
        id: uuidv7(),
        nome: faker.person.fullName(),
        email: u.email,
        senhaHash,
        perfil: u.perfil,
        unidadeId: u.unidadeId,
        ativo: true,
      },
    });

    if (u.perfil === PerfilUsuario.CLIENTE) {
      await prisma.contaFidelidade.create({
        data: {
          id: uuidv7(),
          usuarioId: criado.id,
          saldoPontos: 20,
          consentimentoAtivo: true,
          consentimentoEm: new Date(),
        },
      });
    }
  }

  const agora = Date.now();
  const inicioEm = new Date(agora - 86_400_000);
  const fimEm = new Date(agora + 180 * 86_400_000);

  await prisma.promocao.createMany({
    data: [
      {
        id: uuidv7(),
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
      {
        id: uuidv7(),
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
    ],
  });

  console.log('Seed executado em runtime com @faker-js/faker e UUIDv7.');
}

main()
  .catch((error: unknown) => {
    console.error('Erro ao executar seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
