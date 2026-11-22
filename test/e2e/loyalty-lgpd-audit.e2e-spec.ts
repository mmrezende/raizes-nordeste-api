import request from 'supertest';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import {
  createTestApp,
  criarContaFidelidade,
  criarProdutoComEstoque,
  criarUnidade,
  criarUsuarioELogar,
  resetDatabase,
  type TestAppContext,
} from './helpers/test-app.helper';

describe('Fidelidade, LGPD e Auditoria (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('Fidelidade e LGPD (/fidelidade e DELETE /usuarios/me)', () => {
    it('deve consultar conta, ativar/revogar consentimento com timestamp e listar movimentações paginadas', async () => {
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Maria Silva',
          email: 'maria@exemplo.com',
          senha: 'Senha@123',
        })
        .expect(201);
      const clienteId = registerRes.body.id as string;

      const loginRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'maria@exemplo.com', senha: 'Senha@123' })
        .expect(200);
      const token = loginRes.body.accessToken as string;

      const contaInicial = await request(ctx.app.getHttpServer())
        .get('/fidelidade/conta')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(contaInicial.body).toMatchObject({
        usuarioId: clienteId,
        saldoPontos: 0,
        consentimentoAtivo: false,
        consentimentoEm: null,
        revogadoEm: null,
      });

      const ativarRes = await request(ctx.app.getHttpServer())
        .patch('/fidelidade/consentimento')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentimentoAtivo: true })
        .expect(200);

      expect(ativarRes.body.consentimentoAtivo).toBe(true);
      expect(typeof ativarRes.body.consentimentoEm).toBe('string');
      expect(ativarRes.body.revogadoEm).toBeNull();

      const revogarRes = await request(ctx.app.getHttpServer())
        .patch('/fidelidade/consentimento')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentimentoAtivo: false })
        .expect(200);

      expect(revogarRes.body.consentimentoAtivo).toBe(false);
      expect(typeof revogarRes.body.revogadoEm).toBe('string');

      const logsConsent = await ctx.prisma.logAuditoria.count({
        where: {
          acao: 'FIDELIDADE_CONSENTIMENTO_ATUALIZADO',
          entidade: 'contas_fidelidade',
        },
      });
      expect(logsConsent).toBe(2);

      const conta = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: clienteId },
      });

      await ctx.prisma.movimentacaoFidelidade.createMany({
        data: [
          {
            id: '019c6199-df00-7a00-8f41-9c2a1b3e4f01',
            contaFidelidadeId: conta.id,
            tipo: 'ACUMULO',
            pontos: 5,
            descricao: 'Acúmulo em pedido teste',
          },
          {
            id: '019c6199-df00-7a00-8f41-9c2a1b3e4f02',
            contaFidelidadeId: conta.id,
            tipo: 'RESGATE',
            pontos: 2,
            descricao: 'Resgate em pedido teste',
          },
        ],
      });

      const extratoRes = await request(ctx.app.getHttpServer())
        .get('/fidelidade/movimentacoes?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(extratoRes.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
      expect((extratoRes.body.data as unknown[]).length).toBe(2);
    });

    it('deve anonimizar usuário preservando pedidos, bloquear novo pedido com token antigo e bloquear login', async () => {
      const unidade = await criarUnidade(ctx.prisma);
      const { produto } = await criarProdutoComEstoque(ctx.prisma, unidade.id, {
        nome: 'Cuscuz Tradicional',
        categoria: 'CUSCUZ',
        precoCentavos: 1800,
      });

      const emailOriginal = 'titular@exemplo.com';
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'João Titular',
          email: emailOriginal,
          senha: 'Senha@123',
          consentimentoFidelidade: true,
        })
        .expect(201);

      const loginRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailOriginal, senha: 'Senha@123' })
        .expect(200);
      const token = loginRes.body.accessToken as string;
      const clienteId = loginRes.body.user.id as string;

      const pedidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);
      const pedidoId = pedidoRes.body.id as string;

      const anonRes = await request(ctx.app.getHttpServer())
        .delete('/usuarios/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(anonRes.body).toMatchObject({
        id: clienteId,
        nome: 'Usuário Anonimizado',
        ativo: false,
      });
      expect(typeof anonRes.body.anonimizadoEm).toBe('string');

      const usuarioBanco = await ctx.prisma.usuario.findUniqueOrThrow({
        where: { id: clienteId },
      });
      expect(usuarioBanco.ativo).toBe(false);
      expect(usuarioBanco.anonimizadoEm).not.toBeNull();
      expect(usuarioBanco.email).not.toBe(emailOriginal);

      const contaBanco = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: clienteId },
      });
      expect(contaBanco.consentimentoAtivo).toBe(false);

      const pedidoPreservado = await ctx.prisma.pedido.findUnique({
        where: { id: pedidoId },
      });
      expect(pedidoPreservado?.clienteId).toBe(clienteId);

      const pedidoPosAnonRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(404);
      expect(pedidoPosAnonRes.body.error).toBe('USUARIO_NAO_ENCONTRADO');

      const logsAnon = await ctx.prisma.logAuditoria.count({
        where: {
          acao: 'USUARIO_ANONIMIZADO',
          entidade: 'usuarios',
          entidadeId: clienteId,
        },
      });
      expect(logsAnon).toBe(1);

      const loginPosAnonRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailOriginal, senha: 'Senha@123' })
        .expect(401);
      expect(loginPosAnonRes.body.error).toBe('CREDENCIAIS_INVALIDAS');
    });
  });

  describe('Auditoria (/auditoria)', () => {
    it('deve restringir GERENTE à própria unidade, liberar visão global ao ADMIN e bloquear outros perfis', async () => {
      const unidadeA = await criarUnidade(ctx.prisma, { codigo: 'REC-01', nome: 'Boa Viagem' });
      const unidadeB = await criarUnidade(ctx.prisma, {
        codigo: 'FOR-01',
        nome: 'Meireles',
        endereco: 'Av. Beira Mar, 500',
      });

      const { produto } = await criarProdutoComEstoque(ctx.prisma, unidadeA.id);
      await ctx.prisma.estoqueUnidade.create({
        data: {
          unidadeId: unidadeB.id,
          produtoId: produto.id,
          quantidadeDisponivel: 10,
          disponivelVenda: true,
        },
      });

      const admin = await criarUsuarioELogar(ctx, {
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: PerfilUsuario.ADMIN,
      });
      const gerenteA = await criarUsuarioELogar(ctx, {
        nome: 'Gerente A',
        email: 'gerente.a@raizes.com',
        perfil: PerfilUsuario.GERENTE,
        unidadeId: unidadeA.id,
      });
      const atendente = await criarUsuarioELogar(ctx, {
        nome: 'Atendente',
        email: 'atendente@raizes.com',
        perfil: PerfilUsuario.ATENDENTE,
        unidadeId: unidadeA.id,
      });
      const cliente = await criarUsuarioELogar(ctx, {
        nome: 'Cliente',
        email: 'cliente@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
      });
      await criarContaFidelidade(ctx.prisma, cliente.id);

      const pedidoARes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidadeA.id,
          canalPedido: 'TOTEM',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);

      const pedidoBRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidadeB.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/estoque/movimentacoes')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          unidadeId: unidadeB.id,
          produtoId: produto.id,
          tipo: 'ENTRADA',
          quantidade: 5,
        })
        .expect(201);

      const clienteForbidden = await request(ctx.app.getHttpServer())
        .get('/auditoria')
        .set('Authorization', `Bearer ${cliente.token}`)
        .expect(403);
      expect(clienteForbidden.body.error).toBe('ACESSO_NEGADO');

      const atendenteForbidden = await request(ctx.app.getHttpServer())
        .get('/auditoria')
        .set('Authorization', `Bearer ${atendente.token}`)
        .expect(403);
      expect(atendenteForbidden.body.error).toBe('ACESSO_NEGADO');

      const gerenteRes = await request(ctx.app.getHttpServer())
        .get('/auditoria?page=1&limit=20')
        .set('Authorization', `Bearer ${gerenteA.token}`)
        .expect(200);

      const gerenteLogs = gerenteRes.body.data as Array<{
        entidadeId: string;
        metadados: { unidadeId?: string } | null;
      }>;
      expect(gerenteLogs.some((item) => item.entidadeId === pedidoARes.body.id)).toBe(true);
      expect(gerenteLogs.some((item) => item.entidadeId === pedidoBRes.body.id)).toBe(false);
      expect(
        gerenteLogs.every((item) => item.metadados?.unidadeId === unidadeA.id),
      ).toBe(true);

      const adminRes = await request(ctx.app.getHttpServer())
        .get('/auditoria?page=1&limit=20&entidade=pedidos')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(adminRes.body.meta.total).toBe(2);
      expect(JSON.stringify(adminRes.body)).not.toContain('senhaHash');
    });
  });
});
