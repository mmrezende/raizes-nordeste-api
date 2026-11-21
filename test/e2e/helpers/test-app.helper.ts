import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { configureApp } from '@api/app.setup';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { AppModule } from '@src/app.module';

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
