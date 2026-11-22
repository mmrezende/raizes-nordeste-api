import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@api/app.setup';
import type { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { AppModule } from '@src/app.module';

export const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TestAppContext {
  app: INestApplication<App>;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestAppContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
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
}

export async function criarUsuarioELogar(
  ctx: TestAppContext,
  params: {
    nome: string;
    email: string;
    perfil: PerfilUsuario;
    unidadeId?: string | null;
    senha?: string;
  },
): Promise<{ id: string; token: string }> {
  const senha = params.senha ?? 'Senha@123';
  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await ctx.prisma.usuario.create({
    data: {
      nome: params.nome,
      email: params.email,
      senhaHash,
      perfil: params.perfil,
      unidadeId: params.unidadeId ?? null,
    },
  });

  const loginRes = await request(ctx.app.getHttpServer())
    .post('/auth/login')
    .send({ email: params.email, senha })
    .expect(200);

  return {
    id: usuario.id,
    token: loginRes.body.accessToken as string,
  };
}

export async function criarUnidade(
  prisma: PrismaService,
  overrides: Partial<{ codigo: string; nome: string; endereco: string; ativo: boolean }> = {},
) {
  return prisma.unidade.create({
    data: {
      codigo: overrides.codigo ?? 'REC-01',
      nome: overrides.nome ?? 'Raízes Boa Viagem',
      endereco: overrides.endereco ?? 'Av. Boa Viagem, 1000',
      ativo: overrides.ativo ?? true,
    },
  });
}

export async function criarProdutoComEstoque(
  prisma: PrismaService,
  unidadeId: string,
  overrides: Partial<{
    nome: string;
    categoria: string;
    precoCentavos: number;
    ativo: boolean;
    quantidadeDisponivel: number;
    disponivelVenda: boolean;
  }> = {},
) {
  const produto = await prisma.produto.create({
    data: {
      nome: overrides.nome ?? 'Tapioca Carne de Sol',
      categoria: overrides.categoria ?? 'TAPIOCAS',
      precoCentavos: overrides.precoCentavos ?? 2500,
      ativo: overrides.ativo ?? true,
    },
  });

  const estoque = await prisma.estoqueUnidade.create({
    data: {
      unidadeId,
      produtoId: produto.id,
      quantidadeDisponivel: overrides.quantidadeDisponivel ?? 10,
      disponivelVenda: overrides.disponivelVenda ?? true,
    },
  });

  return { produto, estoque };
}

export async function criarContaFidelidade(
  prisma: PrismaService,
  usuarioId: string,
  overrides: Partial<{ saldoPontos: number; consentimentoAtivo: boolean }> = {},
) {
  const consentimentoAtivo = overrides.consentimentoAtivo ?? false;

  return prisma.contaFidelidade.create({
    data: {
      usuarioId,
      saldoPontos: overrides.saldoPontos ?? 0,
      consentimentoAtivo,
      consentimentoEm: consentimentoAtivo ? new Date() : null,
    },
  });
}
