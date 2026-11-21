import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestAppContext } from './helpers/test-app.helper';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Pagamentos Mock e Ciclo de Vida de Pedidos (e2e)', () => {
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

  describe('Pagamentos Mock (/pagamentos)', () => {
    it('deve aprovar pagamento, avançar pedido para EM_PREPARO, acumular pontos e garantir idempotência', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Carne de Sol com Macaxeira',
          categoria: 'PRATOS',
          precoCentavos: 3500,
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

      const cliente = await criarUsuarioELogar({
        nome: 'Cliente Fiel',
        email: 'fiel@exemplo.com',
        perfil: 'CLIENTE',
      });

      await ctx.prisma.contaFidelidade.create({
        data: {
          usuarioId: cliente.id,
          saldoPontos: 0,
          consentimentoAtivo: true,
          consentimentoEm: new Date(),
        },
      });

      const pedidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);
      const pedidoId = pedidoRes.body.id as string;

      const payRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          pedidoId,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-key-001',
        })
        .expect(201);

      const pagamentoId = payRes.body.id as string;
      expect(pagamentoId).toMatch(UUID_V7_REGEX);
      expect(payRes.body).toMatchObject({
        id: pagamentoId,
        pedidoId,
        formaPagamento: 'PIX',
        status: 'APROVADO',
        valorCentavos: 3500,
        valor: 35,
      });
      expect(typeof payRes.body.referenciaExterna).toBe('string');
      expect((payRes.body.referenciaExterna as string).length).toBeGreaterThan(0);
      expect(payRes.body.processadoEm).toBeTruthy();

      const pedidoAtualizado = await ctx.prisma.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
      });
      expect(pedidoAtualizado.status).toBe('EM_PREPARO');

      const contaAtualizada = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaAtualizada.saldoPontos).toBe(3);

      const movFidelidade = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId, tipo: 'ACUMULO' },
      });
      expect(movFidelidade).not.toBeNull();
      expect(movFidelidade?.pontos).toBe(3);

      const logs = await ctx.prisma.logAuditoria.findMany({
        where: {
          acao: 'PAGAMENTO_PROCESSADO',
          entidade: 'pagamentos',
          entidadeId: pagamentoId,
        },
      });
      expect(logs.length).toBe(1);

      // Retentativa idempotente com a mesma idempotencyKey -> 200 sem duplicar pontos nem pagamento
      const retryRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          pedidoId,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-key-001',
        })
        .expect(200);

      expect(retryRes.body.id).toBe(pagamentoId);
      expect(retryRes.body.status).toBe('APROVADO');

      const contaAposRetry = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaAposRetry.saldoPontos).toBe(3);

      const totalPagamentos = await ctx.prisma.pagamento.count({ where: { pedidoId } });
      expect(totalPagamentos).toBe(1);
    });

    it('deve recusar pagamento simulado, marcar PAGAMENTO_RECUSADO e estornar estoque e pontos', async () => {
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

      const cliente = await criarUsuarioELogar({
        nome: 'Cliente Pontos',
        email: 'pontos@exemplo.com',
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

      const pedidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'TOTEM',
          pontosResgate: 10,
          itens: [{ produtoId: produto.id, quantidade: 2 }],
        })
        .expect(201);
      const pedidoId = pedidoRes.body.id as string;

      const payRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          pedidoId,
          formaPagamento: 'CARTAO_CREDITO',
          idempotencyKey: 'pay-recusa-001',
          simularRecusa: true,
        })
        .expect(201);

      expect(payRes.body.status).toBe('RECUSADO');

      const pedidoAtualizado = await ctx.prisma.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
      });
      expect(pedidoAtualizado.status).toBe('PAGAMENTO_RECUSADO');

      const estoqueEstornado = await ctx.prisma.estoqueUnidade.findUniqueOrThrow({
        where: { id: estoque.id },
      });
      expect(estoqueEstornado.quantidadeDisponivel).toBe(10);

      const movEstoqueEstorno = await ctx.prisma.movimentacaoEstoque.findFirst({
        where: { pedidoId, tipo: 'ESTORNO' },
      });
      expect(movEstoqueEstorno).not.toBeNull();
      expect(movEstoqueEstorno?.quantidade).toBe(2);

      const contaEstornada = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaEstornada.saldoPontos).toBe(20);

      const movFidelidadeEstorno = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId, tipo: 'ESTORNO' },
      });
      expect(movFidelidadeEstorno).not.toBeNull();
      expect(movFidelidadeEstorno?.pontos).toBe(10);
    });

    it('não deve acumular pontos sem consentimento e deve retornar 403/404/409 nos conflitos de pagamento', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Baião de Dois',
          categoria: 'PRATOS',
          precoCentavos: 3000,
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

      const clienteSemConsent = await criarUsuarioELogar({
        nome: 'Cliente Sem Consentimento',
        email: 'semconsent@exemplo.com',
        perfil: 'CLIENTE',
      });
      await ctx.prisma.contaFidelidade.create({
        data: {
          usuarioId: clienteSemConsent.id,
          saldoPontos: 0,
          consentimentoAtivo: false,
        },
      });

      const outroCliente = await criarUsuarioELogar({
        nome: 'Outro Cliente',
        email: 'outro@exemplo.com',
        perfil: 'CLIENTE',
      });

      const pedidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'WEB',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);
      const pedidoId = pedidoRes.body.id as string;

      // Outro cliente tentando pagar pedido alheio -> 403
      const forbiddenRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${outroCliente.token}`)
        .send({
          pedidoId,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-outro-001',
        })
        .expect(403);
      expect(forbiddenRes.body.error).toBe('ACESSO_NEGADO');

      // Pagamento aprovado sem consentimento -> não acumula pontos
      await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          pedidoId,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-sem-consent-001',
        })
        .expect(201);

      const contaSemConsent = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: clienteSemConsent.id },
      });
      expect(contaSemConsent.saldoPontos).toBe(0);

      const movAcumulo = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId, tipo: 'ACUMULO' },
      });
      expect(movAcumulo).toBeNull();

      // Tentar pagar pedido já EM_PREPARO com outra chave -> 409
      const conflictRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          pedidoId,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-sem-consent-002',
        })
        .expect(409);
      expect(conflictRes.body.error).toBe('PEDIDO_NAO_PAGAVEL');

      // Pedido inexistente -> 404
      const notFoundRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          pedidoId: '0193514c-8d12-7a00-8f41-9c2a1b3e4f99',
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-inexistente-001',
        })
        .expect(404);
      expect(notFoundRes.body.error).toBe('PEDIDO_NAO_ENCONTRADO');
    });
  });

  describe('Ciclo de Status e Cancelamento (/pedidos/:id/status e /cancelar)', () => {
    it('deve avançar EM_PREPARO -> PRONTO (COZINHA) -> ENTREGUE (ATENDENTE) respeitando RBAC e transições', async () => {
      const unidadeA = await ctx.prisma.unidade.create({
        data: { codigo: 'REC-01', nome: 'Boa Viagem', endereco: 'Av. Boa Viagem, 1000' },
      });
      const unidadeB = await ctx.prisma.unidade.create({
        data: { codigo: 'FOR-01', nome: 'Meireles', endereco: 'Av. Beira Mar, 500' },
      });

      const produto = await ctx.prisma.produto.create({
        data: {
          nome: 'Moqueca Nordestina',
          categoria: 'PRATOS',
          precoCentavos: 4500,
        },
      });

      await ctx.prisma.estoqueUnidade.create({
        data: {
          unidadeId: unidadeA.id,
          produtoId: produto.id,
          quantidadeDisponivel: 10,
          disponivelVenda: true,
        },
      });

      const cliente = await criarUsuarioELogar({
        nome: 'Cliente',
        email: 'cliente@exemplo.com',
        perfil: 'CLIENTE',
      });
      const cozinhaA = await criarUsuarioELogar({
        nome: 'Cozinha A',
        email: 'cozinha.a@raizes.com',
        perfil: 'COZINHA',
        unidadeId: unidadeA.id,
      });
      const atendenteA = await criarUsuarioELogar({
        nome: 'Atendente A',
        email: 'atendente.a@raizes.com',
        perfil: 'ATENDENTE',
        unidadeId: unidadeA.id,
      });
      const cozinhaB = await criarUsuarioELogar({
        nome: 'Cozinha B',
        email: 'cozinha.b@raizes.com',
        perfil: 'COZINHA',
        unidadeId: unidadeB.id,
      });

      const pedidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidadeA.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);
      const pedidoId = pedidoRes.body.id as string;

      await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          pedidoId,
          formaPagamento: 'MOCK',
          idempotencyKey: 'pay-ciclo-001',
        })
        .expect(201);

      // Atendente não pode marcar PRONTO -> 403
      const atendenteProntoRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .send({ status: 'PRONTO' })
        .expect(403);
      expect(atendenteProntoRes.body.error).toBe('ACESSO_NEGADO');

      // Cozinha de outra unidade não pode alterar -> 403
      const cozinhaBRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${cozinhaB.token}`)
        .send({ status: 'PRONTO' })
        .expect(403);
      expect(cozinhaBRes.body.error).toBe('ACESSO_NEGADO');

      // Cozinha não pode marcar ENTREGUE -> 403
      const cozinhaEntregueRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${cozinhaA.token}`)
        .send({ status: 'ENTREGUE' })
        .expect(403);
      expect(cozinhaEntregueRes.body.error).toBe('ACESSO_NEGADO');

      // Cozinha A marca PRONTO -> 200
      const prontoRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${cozinhaA.token}`)
        .send({ status: 'PRONTO' })
        .expect(200);
      expect(prontoRes.body.status).toBe('PRONTO');

      // Atendente A marca ENTREGUE -> 200
      const entregueRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .send({ status: 'ENTREGUE' })
        .expect(200);
      expect(entregueRes.body.status).toBe('ENTREGUE');

      // Tentar alterar pedido já ENTREGUE -> 409
      const aposEntregaRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .send({ status: 'ENTREGUE' })
        .expect(409);
      expect(aposEntregaRes.body.error).toBe('TRANSICAO_STATUS_INVALIDA');

      const logsStatus = await ctx.prisma.logAuditoria.findMany({
        where: {
          acao: 'PEDIDO_STATUS_ATUALIZADO',
          entidade: 'pedidos',
          entidadeId: pedidoId,
        },
      });
      expect(logsStatus.length).toBe(2);
    });

    it('deve cancelar pedido antes da entrega estornando estoque e pontos e bloquear recancelamento', async () => {
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

      const cliente = await criarUsuarioELogar({
        nome: 'Cliente Cancelamento',
        email: 'cancel@exemplo.com',
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

      const cozinha = await criarUsuarioELogar({
        nome: 'Cozinha',
        email: 'cozinha@raizes.com',
        perfil: 'COZINHA',
        unidadeId: unidade.id,
      });

      const pedidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          pontosResgate: 10,
          itens: [{ produtoId: produto.id, quantidade: 2 }],
        })
        .expect(201);
      const pedidoId = pedidoRes.body.id as string;

      // Cozinha não tem permissão para cancelar -> 403
      const cozinhaCancelRes = await request(ctx.app.getHttpServer())
        .post(`/pedidos/${pedidoId}/cancelar`)
        .set('Authorization', `Bearer ${cozinha.token}`)
        .expect(403);
      expect(cozinhaCancelRes.body.error).toBe('ACESSO_NEGADO');

      // Dono cancela -> 200 e estorna tudo
      const cancelRes = await request(ctx.app.getHttpServer())
        .post(`/pedidos/${pedidoId}/cancelar`)
        .set('Authorization', `Bearer ${cliente.token}`)
        .expect(200);
      expect(cancelRes.body.status).toBe('CANCELADO');

      const estoqueEstornado = await ctx.prisma.estoqueUnidade.findUniqueOrThrow({
        where: { id: estoque.id },
      });
      expect(estoqueEstornado.quantidadeDisponivel).toBe(10);

      const movEstoque = await ctx.prisma.movimentacaoEstoque.findFirst({
        where: { pedidoId, tipo: 'ESTORNO' },
      });
      expect(movEstoque).not.toBeNull();
      expect(movEstoque?.quantidade).toBe(2);

      const contaEstornada = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaEstornada.saldoPontos).toBe(20);

      const movFidelidade = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId, tipo: 'ESTORNO' },
      });
      expect(movFidelidade).not.toBeNull();
      expect(movFidelidade?.pontos).toBe(10);

      const logsCancel = await ctx.prisma.logAuditoria.findMany({
        where: {
          acao: 'PEDIDO_CANCELADO',
          entidade: 'pedidos',
          entidadeId: pedidoId,
        },
      });
      expect(logsCancel.length).toBe(1);

      // Tentar cancelar pedido já CANCELADO -> 409
      const recancelarRes = await request(ctx.app.getHttpServer())
        .post(`/pedidos/${pedidoId}/cancelar`)
        .set('Authorization', `Bearer ${cliente.token}`)
        .expect(409);
      expect(recancelarRes.body.error).toBe('PEDIDO_NAO_CANCELAVEL');
    });
  });
});
