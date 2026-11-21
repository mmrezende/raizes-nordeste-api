import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestAppContext } from './helpers/test-app.helper';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Unidades, Produtos, Cardápio e Estoque (e2e)', () => {
  let ctx: TestAppContext;

  async function criarUsuarioELogar(params: {
    nome: string;
    email: string;
    perfil: 'ADMIN' | 'GERENTE' | 'CLIENTE';
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

  describe('Unidades (/unidades)', () => {
    it('deve permitir ADMIN cadastrar unidade com UUIDv7 e listar paginado', async () => {
      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });

      const createRes = await request(ctx.app.getHttpServer())
        .post('/unidades')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        })
        .expect(201);

      expect(createRes.body.id).toMatch(UUID_V7_REGEX);
      expect(createRes.body).toMatchObject({
        codigo: 'REC-01',
        nome: 'Raízes Boa Viagem',
        endereco: 'Av. Boa Viagem, 1000',
        ativo: true,
      });

      const listRes = await request(ctx.app.getHttpServer())
        .get('/unidades?page=1&limit=10')
        .expect(200);

      expect(listRes.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect((listRes.body.data as unknown[]).length).toBe(1);
    });

    it('deve retornar 409 ao tentar cadastrar código de unidade duplicado e 403 para CLIENTE', async () => {
      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });
      const cliente = await criarUsuarioELogar({
        nome: 'Cliente',
        email: 'cliente@exemplo.com',
        perfil: 'CLIENTE',
      });

      await request(ctx.app.getHttpServer())
        .post('/unidades')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        })
        .expect(201);

      const dupRes = await request(ctx.app.getHttpServer())
        .post('/unidades')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'REC-01',
          nome: 'Outra Loja',
          endereco: 'Rua Nova, 200',
        })
        .expect(409);

      expect(dupRes.body.error).toBe('CODIGO_UNIDADE_JA_CADASTRADO');

      const forbiddenRes = await request(ctx.app.getHttpServer())
        .post('/unidades')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          codigo: 'SSA-01',
          nome: 'Raízes Salvador',
          endereco: 'Av. Oceânica, 50',
        })
        .expect(403);

      expect(forbiddenRes.body.error).toBe('ACESSO_NEGADO');
    });
  });

  describe('Produtos (/produtos)', () => {
    it('deve cadastrar produto na matriz e filtrar listagem por categoria', async () => {
      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });

      const createRes = await request(ctx.app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          nome: 'Tapioca Carne de Sol',
          descricao: 'Com queijo coalho na brasa',
          categoria: 'TAPIOCAS',
          precoCentavos: 2490,
        })
        .expect(201);

      expect(createRes.body.id).toMatch(UUID_V7_REGEX);
      expect(createRes.body).toMatchObject({
        nome: 'Tapioca Carne de Sol',
        categoria: 'TAPIOCAS',
        precoCentavos: 2490,
        preco: 24.9,
        ativo: true,
      });

      await request(ctx.app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          nome: 'Suco de Cajá 400ml',
          categoria: 'BEBIDAS',
          precoCentavos: 1100,
        })
        .expect(201);

      const listRes = await request(ctx.app.getHttpServer())
        .get('/produtos?page=1&limit=10&categoria=TAPIOCAS')
        .expect(200);

      expect(listRes.body.meta.total).toBe(1);
      expect(listRes.body.data[0].nome).toBe('Tapioca Carne de Sol');
    });

    it('deve retornar 422 para preço inválido e 403 quando CLIENTE tentar criar produto', async () => {
      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });
      const cliente = await criarUsuarioELogar({
        nome: 'Cliente',
        email: 'cliente@exemplo.com',
        perfil: 'CLIENTE',
      });

      const invalidRes = await request(ctx.app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          nome: 'Produto Inválido',
          categoria: 'TAPIOCAS',
          precoCentavos: 0,
        })
        .expect(422);

      expect(invalidRes.body.error).toBe('ERRO_VALIDACAO');

      await request(ctx.app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          nome: 'Cuscuz Recheado',
          categoria: 'CUSCUZ',
          precoCentavos: 1890,
        })
        .expect(403);
    });
  });

  describe('Estoque por Unidade e Cardápio (/estoque e /unidades/:id/cardapio)', () => {
    it('deve registrar ENTRADA/SAIDA, bloquear saída sem saldo (409) e refletir no cardápio da unidade', async () => {
      const unidadeA = await ctx.prisma.unidade.create({
        data: { codigo: 'REC-01', nome: 'Boa Viagem', endereco: 'Av. Boa Viagem, 1000' },
      });
      const unidadeB = await ctx.prisma.unidade.create({
        data: { codigo: 'FOR-01', nome: 'Meireles', endereco: 'Av. Beira Mar, 500' },
      });

      const gerenteA = await criarUsuarioELogar({
        nome: 'Gerente A',
        email: 'gerente.a@raizes.com',
        perfil: 'GERENTE',
        unidadeId: unidadeA.id,
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Bolo de Rolo Tradicional',
          categoria: 'SOBREMESAS',
          precoCentavos: 1500,
        },
      });

      // Entrada de 10 unidades na Loja A
      const entradaRes = await request(ctx.app.getHttpServer())
        .post('/estoque/movimentacoes')
        .set('Authorization', `Bearer ${gerenteA.token}`)
        .send({
          unidadeId: unidadeA.id,
          produtoId: produto.id,
          tipo: 'ENTRADA',
          quantidade: 10,
          motivo: 'Reposição inicial',
        })
        .expect(201);

      expect(entradaRes.body.movimentacao.id).toMatch(UUID_V7_REGEX);
      expect(entradaRes.body.saldo).toMatchObject({
        unidadeId: unidadeA.id,
        produtoId: produto.id,
        quantidadeDisponivel: 10,
        disponivelVenda: true,
      });

      // Saída de 3 unidades -> saldo 7
      const saidaRes = await request(ctx.app.getHttpServer())
        .post('/estoque/movimentacoes')
        .set('Authorization', `Bearer ${gerenteA.token}`)
        .send({
          unidadeId: unidadeA.id,
          produtoId: produto.id,
          tipo: 'SAIDA',
          quantidade: 3,
          motivo: 'Ajuste de perda',
        })
        .expect(201);

      expect(saidaRes.body.saldo.quantidadeDisponivel).toBe(7);

      // Tentativa de saída maior que saldo -> 409
      const insufRes = await request(ctx.app.getHttpServer())
        .post('/estoque/movimentacoes')
        .set('Authorization', `Bearer ${gerenteA.token}`)
        .send({
          unidadeId: unidadeA.id,
          produtoId: produto.id,
          tipo: 'SAIDA',
          quantidade: 20,
        })
        .expect(409);

      expect(insufRes.body.error).toBe('ESTOQUE_INSUFICIENTE');

      // Cardápio da Loja A deve exibir saldo 7; Loja B deve vir vazia
      const cardapioA = await request(ctx.app.getHttpServer())
        .get(`/unidades/${unidadeA.id}/cardapio?page=1&limit=10`)
        .expect(200);

      expect(cardapioA.body.meta.total).toBe(1);
      expect(cardapioA.body.data[0]).toMatchObject({
        produtoId: produto.id,
        nome: 'Bolo de Rolo Tradicional',
        precoCentavos: 1500,
        preco: 15,
        quantidadeDisponivel: 7,
      });

      const cardapioB = await request(ctx.app.getHttpServer())
        .get(`/unidades/${unidadeB.id}/cardapio?page=1&limit=10`)
        .expect(200);

      expect(cardapioB.body.meta.total).toBe(0);

      // Gerente A consultando estoque da própria loja -> 200
      const estoqueA = await request(ctx.app.getHttpServer())
        .get(`/unidades/${unidadeA.id}/estoque`)
        .set('Authorization', `Bearer ${gerenteA.token}`)
        .expect(200);

      expect(estoqueA.body.data[0].quantidadeDisponivel).toBe(7);

      // Auditoria registrada
      const logs = await ctx.prisma.logAuditoria.findMany({
        where: { entidade: 'estoque_unidades' },
      });
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    it('deve impedir GERENTE de movimentar ou consultar estoque de outra unidade (403) e retornar 404 para unidade inexistente', async () => {
      const unidadeA = await ctx.prisma.unidade.create({
        data: { codigo: 'REC-01', nome: 'Boa Viagem', endereco: 'Av. Boa Viagem, 1000' },
      });
      const unidadeB = await ctx.prisma.unidade.create({
        data: { codigo: 'FOR-01', nome: 'Meireles', endereco: 'Av. Beira Mar, 500' },
      });

      const gerenteA = await criarUsuarioELogar({
        nome: 'Gerente A',
        email: 'gerente.a@raizes.com',
        perfil: 'GERENTE',
        unidadeId: unidadeA.id,
      });
      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });

      const produto = await ctx.prisma.produto.create({
        data: { nome: 'Cuscuz Nordestino', categoria: 'CUSCUZ', precoCentavos: 1800 },
      });

      const forbiddenMove = await request(ctx.app.getHttpServer())
        .post('/estoque/movimentacoes')
        .set('Authorization', `Bearer ${gerenteA.token}`)
        .send({
          unidadeId: unidadeB.id,
          produtoId: produto.id,
          tipo: 'ENTRADA',
          quantidade: 5,
        })
        .expect(403);

      expect(forbiddenMove.body.error).toBe('ACESSO_NEGADO');

      await request(ctx.app.getHttpServer())
        .get(`/unidades/${unidadeB.id}/estoque`)
        .set('Authorization', `Bearer ${gerenteA.token}`)
        .expect(403);

      const notFoundRes = await request(ctx.app.getHttpServer())
        .post('/estoque/movimentacoes')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          unidadeId: '0193514c-8d12-7a00-8f41-9c2a1b3e4f99',
          produtoId: produto.id,
          tipo: 'ENTRADA',
          quantidade: 5,
        })
        .expect(404);

      expect(notFoundRes.body.error).toBe('UNIDADE_NAO_ENCONTRADA');
    });
  });
});
