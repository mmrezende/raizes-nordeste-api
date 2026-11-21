import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestAppContext } from './helpers/test-app.helper';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DAY_IN_MS = 86_400_000;

function ontemIso(): string {
  return new Date(Date.now() - DAY_IN_MS).toISOString();
}

function amanhaIso(): string {
  return new Date(Date.now() + DAY_IN_MS).toISOString();
}

describe('Promoções e Pedidos Multicanalidade (e2e)', () => {
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

  describe('Promoções (/promocoes)', () => {
    it('deve permitir ADMIN cadastrar promoção com UUIDv7 e listar paginado', async () => {
      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });

      const createRes = await request(ctx.app.getHttpServer())
        .post('/promocoes')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'TOTEM10',
          descricao: '10% de desconto para pedidos no totem',
          tipoDesconto: 'PERCENTUAL',
          valorDesconto: 10,
          valorMinimoCentavos: 2000,
          canalAplicavel: 'TOTEM',
          inicioEm: ontemIso(),
          fimEm: amanhaIso(),
        })
        .expect(201);

      expect(createRes.body.id).toMatch(UUID_V7_REGEX);
      expect(createRes.body).toMatchObject({
        codigo: 'TOTEM10',
        descricao: '10% de desconto para pedidos no totem',
        tipoDesconto: 'PERCENTUAL',
        valorDesconto: 10,
        valorMinimoCentavos: 2000,
        valorMinimo: 20,
        canalAplicavel: 'TOTEM',
        ativo: true,
      });

      const listRes = await request(ctx.app.getHttpServer())
        .get('/promocoes?page=1&limit=10')
        .expect(200);

      expect(listRes.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect((listRes.body.data as unknown[]).length).toBe(1);
    });

    it('deve retornar 409 para código duplicado, 422 para vigência inválida e 403 para CLIENTE', async () => {
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

      const inicioEm = ontemIso();
      const fimEm = amanhaIso();

      await request(ctx.app.getHttpServer())
        .post('/promocoes')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'PROMO5',
          descricao: 'Desconto fixo de R$ 5,00',
          tipoDesconto: 'VALOR_FIXO',
          valorDesconto: 500,
          valorMinimoCentavos: 1000,
          inicioEm,
          fimEm,
        })
        .expect(201);

      const dupRes = await request(ctx.app.getHttpServer())
        .post('/promocoes')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'PROMO5',
          descricao: 'Outro cupom com mesmo código',
          tipoDesconto: 'VALOR_FIXO',
          valorDesconto: 500,
          valorMinimoCentavos: 1000,
          inicioEm,
          fimEm,
        })
        .expect(409);

      expect(dupRes.body.error).toBe('CODIGO_PROMOCAO_JA_CADASTRADO');

      const invalidDateRes = await request(ctx.app.getHttpServer())
        .post('/promocoes')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          codigo: 'DATAINV',
          descricao: 'Vigência invertida',
          tipoDesconto: 'PERCENTUAL',
          valorDesconto: 15,
          inicioEm: amanhaIso(),
          fimEm: ontemIso(),
        })
        .expect(422);

      expect(invalidDateRes.body.error).toBe('ERRO_VALIDACAO');

      const forbiddenRes = await request(ctx.app.getHttpServer())
        .post('/promocoes')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          codigo: 'CLI10',
          descricao: 'Tentativa não autorizada',
          tipoDesconto: 'PERCENTUAL',
          valorDesconto: 10,
          inicioEm,
          fimEm,
        })
        .expect(403);

      expect(forbiddenRes.body.error).toBe('ACESSO_NEGADO');
    });
  });

  describe('Pedidos e Multicanalidade (/pedidos)', () => {
    it('deve criar pedido com cupom, resgate de pontos, reserva de estoque e trilha de auditoria', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Tapioca Carne de Sol',
          categoria: 'TAPIOCAS',
          precoCentavos: 2500,
        },
      });

      const estoque = await ctx.prisma.estoqueUnidade.create({
        data: {
          unidadeId: unidade.id,
          produtoId: produto.id,
          quantidadeDisponivel: 10,
          disponivelVenda: true,
        },
      });

      const promocao = await ctx.prisma.promocao.create({
        data: {
          codigo: 'TOTEM10',
          descricao: '10% de desconto no totem',
          tipoDesconto: 'PERCENTUAL',
          valorDesconto: 10,
          valorMinimoCentavos: 2000,
          canalAplicavel: 'TOTEM',
          inicioEm: new Date(Date.now() - DAY_IN_MS),
          fimEm: new Date(Date.now() + DAY_IN_MS),
          ativo: true,
        },
      });

      const cliente = await criarUsuarioELogar({
        nome: 'Cliente Fiel',
        email: 'fiel@exemplo.com',
        perfil: 'CLIENTE',
      });

      await ctx.prisma.contaFidelidade.create({
        data: {
          usuarioId: cliente.id,
          saldoPontos: 20,
          consentimentoAtivo: true,
          consentimentoEm: new Date(),
        },
      });

      const createRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'TOTEM',
          codigoPromocao: 'TOTEM10',
          pontosResgate: 10,
          itens: [{ produtoId: produto.id, quantidade: 2 }],
        })
        .expect(201);

      const pedidoId = createRes.body.id as string;
      expect(pedidoId).toMatch(UUID_V7_REGEX);
      expect(createRes.body).toMatchObject({
        id: pedidoId,
        status: 'AGUARDANDO_PAGAMENTO',
        canalPedido: 'TOTEM',
        unidadeId: unidade.id,
        clienteId: cliente.id,
        promocaoId: promocao.id,
        subtotalCentavos: 5000,
        subtotal: 50,
        descontoPromocaoCentavos: 500,
        descontoPromocao: 5,
        pontosUtilizados: 10,
        descontoFidelidadeCentavos: 500,
        descontoFidelidade: 5,
        valorTotalCentavos: 4000,
        valorTotal: 40,
      });

      expect((createRes.body.itens as unknown[]).length).toBe(1);
      expect(createRes.body.itens[0]).toMatchObject({
        produtoId: produto.id,
        quantidade: 2,
        precoUnitarioCentavos: 2500,
        subtotalCentavos: 5000,
      });

      const estoqueAtualizado = await ctx.prisma.estoqueUnidade.findUniqueOrThrow({
        where: { id: estoque.id },
      });
      expect(estoqueAtualizado.quantidadeDisponivel).toBe(8);

      const movEstoque = await ctx.prisma.movimentacaoEstoque.findFirst({
        where: { pedidoId, tipo: 'RESERVA' },
      });
      expect(movEstoque).not.toBeNull();
      expect(movEstoque?.quantidade).toBe(2);

      const contaAtualizada = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaAtualizada.saldoPontos).toBe(10);

      const movFidelidade = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId, tipo: 'RESGATE' },
      });
      expect(movFidelidade).not.toBeNull();
      expect(movFidelidade?.pontos).toBe(10);

      const logs = await ctx.prisma.logAuditoria.findMany({
        where: {
          acao: 'PEDIDO_CRIADO',
          entidade: 'pedidos',
          entidadeId: pedidoId,
        },
      });
      expect(logs.length).toBe(1);
    });

    it('deve retornar 422 para dados ou cupom inelegível e 404 para unidade/produto inexistente', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Cuscuz Recheado',
          categoria: 'CUSCUZ',
          precoCentavos: 2200,
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

      await ctx.prisma.promocao.create({
        data: {
          codigo: 'TOTEM10',
          descricao: 'Válido apenas para TOTEM',
          tipoDesconto: 'PERCENTUAL',
          valorDesconto: 10,
          valorMinimoCentavos: 1000,
          canalAplicavel: 'TOTEM',
          inicioEm: new Date(Date.now() - DAY_IN_MS),
          fimEm: new Date(Date.now() + DAY_IN_MS),
          ativo: true,
        },
      });

      const cliente = await criarUsuarioELogar({
        nome: 'Cliente',
        email: 'cliente@exemplo.com',
        perfil: 'CLIENTE',
      });

      // Sem canalPedido -> 422
      const semCanalRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(422);
      expect(semCanalRes.body.error).toBe('ERRO_VALIDACAO');

      // canalPedido inválido -> 422
      const canalInvalidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'INVALIDO',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(422);
      expect(canalInvalidoRes.body.error).toBe('ERRO_VALIDACAO');

      // itens vazio -> 422
      const itensVazioRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          itens: [],
        })
        .expect(422);
      expect(itensVazioRes.body.error).toBe('ERRO_VALIDACAO');

      // unidadeId inexistente -> 404
      const unidadeNotFoundRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: '0193514c-8d12-7a00-8f41-9c2a1b3e4f99',
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(404);
      expect(unidadeNotFoundRes.body.error).toBe('UNIDADE_NAO_ENCONTRADA');

      // produtoId inexistente -> 404
      const produtoNotFoundRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          itens: [{ produtoId: '0193514c-8d12-7a00-8f41-9c2a1b3e4f98', quantidade: 1 }],
        })
        .expect(404);
      expect(produtoNotFoundRes.body.error).toBe('PRODUTO_NAO_ENCONTRADO');

      // Cupom restrito a TOTEM usado no canal APP -> 422
      const promoInelegivelRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          codigoPromocao: 'TOTEM10',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(422);
      expect(promoInelegivelRes.body.error).toBe('PROMOCAO_INVALIDA');
    });

    it('deve bloquear com 409 por estoque insuficiente, falta de consentimento LGPD ou saldo insuficiente de pontos', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Bolo de Rolo',
          categoria: 'SOBREMESAS',
          precoCentavos: 1500,
        },
      });

      const estoque = await ctx.prisma.estoqueUnidade.create({
        data: {
          unidadeId: unidade.id,
          produtoId: produto.id,
          quantidadeDisponivel: 2,
          disponivelVenda: true,
        },
      });

      const clienteSemConsent = await criarUsuarioELogar({
        nome: 'Cliente Sem Consentimento',
        email: 'semconsent@exemplo.com',
        perfil: 'CLIENTE',
      });
      await ctx.prisma.contaFidelidade.create({
        data: {
          usuarioId: clienteSemConsent.id,
          saldoPontos: 50,
          consentimentoAtivo: false,
        },
      });

      const clientePoucosPontos = await criarUsuarioELogar({
        nome: 'Cliente Poucos Pontos',
        email: 'poucoponto@exemplo.com',
        perfil: 'CLIENTE',
      });
      await ctx.prisma.contaFidelidade.create({
        data: {
          usuarioId: clientePoucosPontos.id,
          saldoPontos: 5,
          consentimentoAtivo: true,
          consentimentoEm: new Date(),
        },
      });

      // Estoque insuficiente -> 409 e saldo mantido em 2
      const estoqueInsufRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${clientePoucosPontos.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'WEB',
          itens: [{ produtoId: produto.id, quantidade: 5 }],
        })
        .expect(409);

      expect(estoqueInsufRes.body.error).toBe('ESTOQUE_INSUFICIENTE');
      expect(Array.isArray(estoqueInsufRes.body.details)).toBe(true);
      expect((estoqueInsufRes.body.details as unknown[]).length).toBeGreaterThan(0);

      const estoqueConferido = await ctx.prisma.estoqueUnidade.findUniqueOrThrow({
        where: { id: estoque.id },
      });
      expect(estoqueConferido.quantidadeDisponivel).toBe(2);

      // Resgate sem consentimento ativo -> 409
      const semConsentRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          pontosResgate: 10,
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(409);

      expect(semConsentRes.body.error).toBe('FIDELIDADE_SEM_CONSENTIMENTO');

      // Resgate maior que saldo -> 409
      const saldoInsufRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${clientePoucosPontos.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          pontosResgate: 10,
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(409);

      expect(saldoInsufRes.body.error).toBe('SALDO_PONTOS_INSUFICIENTE');
    });

    it('deve aplicar RBAC por perfil/unidade na criação e filtrar/restringir consulta em GET /pedidos e GET /pedidos/:id', async () => {
      const unidadeA = await ctx.prisma.unidade.create({
        data: { codigo: 'REC-01', nome: 'Boa Viagem', endereco: 'Av. Boa Viagem, 1000' },
      });
      const unidadeB = await ctx.prisma.unidade.create({
        data: { codigo: 'FOR-01', nome: 'Meireles', endereco: 'Av. Beira Mar, 500' },
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Baião de Dois',
          categoria: 'PRATOS',
          precoCentavos: 3200,
        },
      });

      await ctx.prisma.estoqueUnidade.createMany({
        data: [
          {
            unidadeId: unidadeA.id,
            produtoId: produto.id,
            quantidadeDisponivel: 20,
            disponivelVenda: true,
          },
          {
            unidadeId: unidadeB.id,
            produtoId: produto.id,
            quantidadeDisponivel: 20,
            disponivelVenda: true,
          },
        ],
      });

      const cliente1 = await criarUsuarioELogar({
        nome: 'Cliente 1',
        email: 'cliente1@exemplo.com',
        perfil: 'CLIENTE',
      });
      const cliente2 = await criarUsuarioELogar({
        nome: 'Cliente 2',
        email: 'cliente2@exemplo.com',
        perfil: 'CLIENTE',
      });
      const atendenteA = await criarUsuarioELogar({
        nome: 'Atendente A',
        email: 'atendente.a@raizes.com',
        perfil: 'ATENDENTE',
        unidadeId: unidadeA.id,
      });
      const cozinhaA = await criarUsuarioELogar({
        nome: 'Cozinha A',
        email: 'cozinha.a@raizes.com',
        perfil: 'COZINHA',
        unidadeId: unidadeA.id,
      });
      const admin = await criarUsuarioELogar({
        nome: 'Admin',
        email: 'admin@raizes.com',
        perfil: 'ADMIN',
      });

      // COZINHA tentando criar pedido -> 403
      const cozinhaForbidden = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cozinhaA.token}`)
        .send({
          unidadeId: unidadeA.id,
          canalPedido: 'BALCAO',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(403);
      expect(cozinhaForbidden.body.error).toBe('ACESSO_NEGADO');

      // ATENDENTE da unidade A tentando criar pedido para unidade B -> 403
      const atendenteOutroUnitForbidden = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .send({
          unidadeId: unidadeB.id,
          canalPedido: 'BALCAO',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(403);
      expect(atendenteOutroUnitForbidden.body.error).toBe('ACESSO_NEGADO');

      // cliente1 cria pedido na unidadeA via TOTEM
      const pedido1Res = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente1.token}`)
        .send({
          unidadeId: unidadeA.id,
          canalPedido: 'TOTEM',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);
      const pedido1Id = pedido1Res.body.id as string;

      // cliente2 cria pedido na unidadeB via APP
      const pedido2Res = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente2.token}`)
        .send({
          unidadeId: unidadeB.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);
      const pedido2Id = pedido2Res.body.id as string;

      // ADMIN filtra por canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO
      const adminFiltroRes = await request(ctx.app.getHttpServer())
        .get('/pedidos?canalPedido=TOTEM&status=AGUARDANDO_PAGAMENTO')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(adminFiltroRes.body.meta.total).toBe(1);
      expect(adminFiltroRes.body.data[0].id).toBe(pedido1Id);

      // cliente1 vê apenas próprio pedido
      const cliente1ListRes = await request(ctx.app.getHttpServer())
        .get('/pedidos')
        .set('Authorization', `Bearer ${cliente1.token}`)
        .expect(200);
      expect(cliente1ListRes.body.meta.total).toBe(1);
      expect(cliente1ListRes.body.data[0].id).toBe(pedido1Id);

      // atendenteA vê apenas pedidos da unidadeA
      const atendenteAListRes = await request(ctx.app.getHttpServer())
        .get('/pedidos')
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .expect(200);
      expect(atendenteAListRes.body.meta.total).toBe(1);
      expect(atendenteAListRes.body.data[0].id).toBe(pedido1Id);

      // cliente1 tentando ver pedido do cliente2 -> 403
      const clienteOutroRes = await request(ctx.app.getHttpServer())
        .get(`/pedidos/${pedido2Id}`)
        .set('Authorization', `Bearer ${cliente1.token}`)
        .expect(403);
      expect(clienteOutroRes.body.error).toBe('ACESSO_NEGADO');

      // atendenteA tentando ver pedido da unidadeB -> 403
      const atendenteOutroRes = await request(ctx.app.getHttpServer())
        .get(`/pedidos/${pedido2Id}`)
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .expect(403);
      expect(atendenteOutroRes.body.error).toBe('ACESSO_NEGADO');

      // pedido inexistente -> 404
      const notFoundRes = await request(ctx.app.getHttpServer())
        .get('/pedidos/0193514c-8d12-7a00-8f41-9c2a1b3e4f97')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(404);
      expect(notFoundRes.body.error).toBe('PEDIDO_NAO_ENCONTRADO');
    });
  });
});
