import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestAppContext } from './helpers/test-app.helper';

describe('Fidelidade, LGPD e Auditoria (e2e)', () => {
  let ctx: TestAppContext;

  async function criarUsuarioELogar(params: {
    nome: string;
    email: string;
    perfil: 'ADMIN' | 'GERENTE' | 'ATENDENTE' | 'COZINHA' | 'CLIENTE';
    unidadeId?: string | null;
  }): Promise<{ id: string; token: string }> {
    const senhaHash = await bcrypt.hash('Senha@123', 10);
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
      .send({ email: params.email, senha: 'Senha@123' })
      .expect(200);

    return {
      id: usuario.id,
      token: loginRes.body.accessToken as string,
    };
  }

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
    it('deve consultar conta, ativar/revogar consentimento LGPD com timestamp e listar movimentações paginadas', async () => {
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

      const logsConsent = await ctx.prisma.logAuditoria.findMany({
        where: {
          acao: 'FIDELIDADE_CONSENTIMENTO_ATUALIZADO',
          entidade: 'contas_fidelidade',
        },
      });
      expect(logsConsent.length).toBe(2);

      const conta = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: clienteId },
      });

      await ctx.prisma.movimentacaoFidelidade.createMany({
        data: [
          {
            id: '0193514c-8d12-7a00-8f41-9c2a1b3e4f01',
            contaFidelidadeId: conta.id,
            tipo: 'ACUMULO',
            pontos: 5,
            descricao: 'Acúmulo em pedido teste',
          },
          {
            id: '0193514c-8d12-7a00-8f41-9c2a1b3e4f02',
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

    it('deve anonimizar usuário via DELETE /usuarios/me preservando pedidos históricos e bloqueando login', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });
      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Cuscuz Tradicional',
          categoria: 'CUSCUZ',
          precoCentavos: 1800,
        },
      });
      await ctx.prisma.estoqueUnidade.create({
        data: {
          unidadeId: unidade.id,
          produtoId: produto.id,
          quantidadeDisponivel: 10,
          disponivelVenda: true,
        },
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
      expect(pedidoPreservado).not.toBeNull();
      expect(pedidoPreservado?.clienteId).toBe(clienteId);

      const logsAnon = await ctx.prisma.logAuditoria.findMany({
        where: {
          acao: 'USUARIO_ANONIMIZADO',
          entidade: 'usuarios',
          entidadeId: clienteId,
        },
      });
      expect(logsAnon.length).toBe(1);

      const loginPosAnonRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailOriginal, senha: 'Senha@123' })
        .expect(401);
      expect(loginPosAnonRes.body.error).toBe('CREDENCIAIS_INVALIDAS');
    });
  });

  describe('Auditoria (/auditoria)', () => {
    it('deve permitir consulta paginada/filtrada para ADMIN e GERENTE e bloquear CLIENTE e ATENDENTE (403)', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });

      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });
      const gerente = await criarUsuarioELogar({
        nome: 'Gerente',
        email: 'gerente@raizes.com',
        perfil: 'GERENTE',
        unidadeId: unidade.id,
      });
      const atendente = await criarUsuarioELogar({
        nome: 'Atendente',
        email: 'atendente@raizes.com',
        perfil: 'ATENDENTE',
        unidadeId: unidade.id,
      });
      const cliente = await criarUsuarioELogar({
        nome: 'Cliente',
        email: 'cliente@exemplo.com',
        perfil: 'CLIENTE',
      });
      await ctx.prisma.contaFidelidade.create({
        data: {
          usuarioId: cliente.id,
          saldoPontos: 0,
          consentimentoAtivo: false,
        },
      });

      // Gera eventos auditáveis reais
      await request(ctx.app.getHttpServer())
        .post('/unidades')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'SSA-01',
          nome: 'Raízes Salvador',
          endereco: 'Av. Oceânica, 100',
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .patch('/fidelidade/consentimento')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({ consentimentoAtivo: true })
        .expect(200);

      // Bloqueio para CLIENTE e ATENDENTE -> 403
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

      // ADMIN consulta com filtro por entidade
      const adminRes = await request(ctx.app.getHttpServer())
        .get('/auditoria?page=1&limit=10&entidade=unidades')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(adminRes.body.meta.total).toBeGreaterThanOrEqual(1);
      expect(adminRes.body.data[0].entidade).toBe('unidades');
      expect(JSON.stringify(adminRes.body)).not.toContain('senhaHash');

      // GERENTE consulta auditoria -> 200
      const gerenteRes = await request(ctx.app.getHttpServer())
        .get('/auditoria?page=1&limit=10')
        .set('Authorization', `Bearer ${gerente.token}`)
        .expect(200);

      expect(Array.isArray(gerenteRes.body.data)).toBe(true);
      expect(gerenteRes.body.meta).toBeDefined();
    });
  });
});
