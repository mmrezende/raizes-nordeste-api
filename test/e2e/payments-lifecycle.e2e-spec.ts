import request from 'supertest';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import {
  UUID_V7_REGEX,
  createTestApp,
  criarContaFidelidade,
  criarProdutoComEstoque,
  criarUnidade,
  criarUsuarioELogar,
  resetDatabase,
  type TestAppContext,
} from './helpers/test-app.helper';

describe('Pagamentos Simulados e Ciclo de Vida de Pedidos (e2e)', () => {
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

  describe('Pagamentos (/pagamentos)', () => {
    it('deve aprovar pagamento, avançar para EM_PREPARO, acumular pontos e manter idempotência sem duplicar log', async () => {
      const unidade = await criarUnidade(ctx.prisma);
      const { produto } = await criarProdutoComEstoque(ctx.prisma, unidade.id, {
        nome: 'Carne de Sol com Macaxeira',
        categoria: 'PRATOS',
        precoCentavos: 3500,
      });

      const cliente = await criarUsuarioELogar(ctx, {
        nome: 'Cliente Fiel',
        email: 'fiel@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
      });
      await criarContaFidelidade(ctx.prisma, cliente.id, {
        saldoPontos: 0,
        consentimentoAtivo: true,
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
        unidadeId: unidade.id,
        formaPagamento: 'PIX',
        status: 'APROVADO',
        valorCentavos: 3500,
        valor: 35,
        payloadRetorno: {
          provider: 'raizes-mock-gateway',
          aprovado: true,
        },
      });
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
      expect(movFidelidade?.pontos).toBe(3);

      const logsAntesRetry = await ctx.prisma.logAuditoria.count({
        where: {
          acao: 'PAGAMENTO_PROCESSADO',
          entidade: 'pagamentos',
          entidadeId: pagamentoId,
        },
      });
      expect(logsAntesRetry).toBe(1);

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

      const logsAposRetry = await ctx.prisma.logAuditoria.count({
        where: {
          acao: 'PAGAMENTO_PROCESSADO',
          entidade: 'pagamentos',
          entidadeId: pagamentoId,
        },
      });
      expect(logsAposRetry).toBe(1);
    });

    it('deve recusar pagamento simulado, marcar PAGAMENTO_RECUSADO e estornar estoque e pontos', async () => {
      const unidade = await criarUnidade(ctx.prisma);
      const { produto, estoque } = await criarProdutoComEstoque(ctx.prisma, unidade.id);

      const cliente = await criarUsuarioELogar(ctx, {
        nome: 'Cliente Pontos',
        email: 'pontos@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
      });
      await criarContaFidelidade(ctx.prisma, cliente.id, {
        saldoPontos: 20,
        consentimentoAtivo: true,
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
      expect(payRes.body.unidadeId).toBe(unidade.id);
      expect(payRes.body.payloadRetorno).toMatchObject({
        provider: 'raizes-mock-gateway',
        aprovado: false,
        motivo: 'RECUSA_SIMULADA_GATEWAY',
      });

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
      expect(movEstoqueEstorno?.quantidade).toBe(2);

      const contaEstornada = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaEstornada.saldoPontos).toBe(20);

      const movFidelidadeEstorno = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId, tipo: 'ESTORNO' },
      });
      expect(movFidelidadeEstorno?.pontos).toBe(10);
    });

    it('não deve acumular pontos sem consentimento e deve retornar 403/404/409 nos conflitos de pagamento', async () => {
      const unidade = await criarUnidade(ctx.prisma);
      const { produto } = await criarProdutoComEstoque(ctx.prisma, unidade.id, {
        nome: 'Baião de Dois',
        categoria: 'PRATOS',
        precoCentavos: 3000,
      });

      const clienteSemConsent = await criarUsuarioELogar(ctx, {
        nome: 'Cliente Sem Consentimento',
        email: 'semconsent@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
      });
      await criarContaFidelidade(ctx.prisma, clienteSemConsent.id, {
        saldoPontos: 0,
        consentimentoAtivo: false,
      });

      const outroCliente = await criarUsuarioELogar(ctx, {
        nome: 'Outro Cliente',
        email: 'outro@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
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

      const outroPedidoRes = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);

      const idempotencyConflictRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          pedidoId: outroPedidoRes.body.id,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-sem-consent-001',
        })
        .expect(409);
      expect(idempotencyConflictRes.body.error).toBe('IDEMPOTENCY_KEY_CONFLITO');

      const notFoundRes = await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${clienteSemConsent.token}`)
        .send({
          pedidoId: '019c6199-df00-7a00-8f41-9c2a1b3e4f99',
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-inexistente-001',
        })
        .expect(404);
      expect(notFoundRes.body.error).toBe('PEDIDO_NAO_ENCONTRADO');
    });
  });

  describe('Ciclo de Status e Cancelamento (/pedidos/:id/status e /cancelar)', () => {
    it('deve avançar EM_PREPARO -> PRONTO -> ENTREGUE respeitando RBAC por perfil e unidade', async () => {
      const unidadeA = await criarUnidade(ctx.prisma, { codigo: 'REC-01', nome: 'Boa Viagem' });
      const unidadeB = await criarUnidade(ctx.prisma, {
        codigo: 'FOR-01',
        nome: 'Meireles',
        endereco: 'Av. Beira Mar, 500',
      });

      const { produto } = await criarProdutoComEstoque(ctx.prisma, unidadeA.id, {
        nome: 'Moqueca Nordestina',
        categoria: 'PRATOS',
        precoCentavos: 4500,
      });

      const cliente = await criarUsuarioELogar(ctx, {
        nome: 'Cliente',
        email: 'cliente@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
      });
      const cozinhaA = await criarUsuarioELogar(ctx, {
        nome: 'Cozinha A',
        email: 'cozinha.a@raizes.com',
        perfil: PerfilUsuario.COZINHA,
        unidadeId: unidadeA.id,
      });
      const atendenteA = await criarUsuarioELogar(ctx, {
        nome: 'Atendente A',
        email: 'atendente.a@raizes.com',
        perfil: PerfilUsuario.ATENDENTE,
        unidadeId: unidadeA.id,
      });
      const cozinhaB = await criarUsuarioELogar(ctx, {
        nome: 'Cozinha B',
        email: 'cozinha.b@raizes.com',
        perfil: PerfilUsuario.COZINHA,
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

      const atendenteProntoRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .send({ status: 'PRONTO' })
        .expect(403);
      expect(atendenteProntoRes.body.error).toBe('ACESSO_NEGADO');

      const cozinhaBRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${cozinhaB.token}`)
        .send({ status: 'PRONTO' })
        .expect(403);
      expect(cozinhaBRes.body.error).toBe('ACESSO_NEGADO');

      const cozinhaEntregueRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${cozinhaA.token}`)
        .send({ status: 'ENTREGUE' })
        .expect(403);
      expect(cozinhaEntregueRes.body.error).toBe('ACESSO_NEGADO');

      const prontoRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${cozinhaA.token}`)
        .send({ status: 'PRONTO' })
        .expect(200);
      expect(prontoRes.body.status).toBe('PRONTO');

      const entregueRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .send({ status: 'ENTREGUE' })
        .expect(200);
      expect(entregueRes.body.status).toBe('ENTREGUE');

      const aposEntregaRes = await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedidoId}/status`)
        .set('Authorization', `Bearer ${atendenteA.token}`)
        .send({ status: 'ENTREGUE' })
        .expect(409);
      expect(aposEntregaRes.body.error).toBe('TRANSICAO_STATUS_INVALIDA');

      const logsStatus = await ctx.prisma.logAuditoria.count({
        where: {
          acao: 'PEDIDO_STATUS_ATUALIZADO',
          entidade: 'pedidos',
          entidadeId: pedidoId,
        },
      });
      expect(logsStatus).toBe(2);
    });

    it('deve cancelar pedido antes da entrega estornando estoque e pontos e bloquear recancelamento', async () => {
      const unidade = await criarUnidade(ctx.prisma);
      const { produto, estoque } = await criarProdutoComEstoque(ctx.prisma, unidade.id, {
        nome: 'Bolo de Rolo',
        categoria: 'SOBREMESAS',
        precoCentavos: 2500,
      });

      const cliente = await criarUsuarioELogar(ctx, {
        nome: 'Cliente Cancelamento',
        email: 'cancel@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
      });
      await criarContaFidelidade(ctx.prisma, cliente.id, {
        saldoPontos: 20,
        consentimentoAtivo: true,
      });

      const cozinha = await criarUsuarioELogar(ctx, {
        nome: 'Cozinha',
        email: 'cozinha@raizes.com',
        perfil: PerfilUsuario.COZINHA,
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

      const cozinhaCancelRes = await request(ctx.app.getHttpServer())
        .post(`/pedidos/${pedidoId}/cancelar`)
        .set('Authorization', `Bearer ${cozinha.token}`)
        .expect(403);
      expect(cozinhaCancelRes.body.error).toBe('ACESSO_NEGADO');

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
      expect(movEstoque?.quantidade).toBe(2);

      const contaEstornada = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaEstornada.saldoPontos).toBe(20);

      const movFidelidade = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId, tipo: 'ESTORNO' },
      });
      expect(movFidelidade?.pontos).toBe(10);

      const logsCancel = await ctx.prisma.logAuditoria.count({
        where: {
          acao: 'PEDIDO_CANCELADO',
          entidade: 'pedidos',
          entidadeId: pedidoId,
        },
      });
      expect(logsCancel).toBe(1);

      const recancelarRes = await request(ctx.app.getHttpServer())
        .post(`/pedidos/${pedidoId}/cancelar`)
        .set('Authorization', `Bearer ${cliente.token}`)
        .expect(409);
      expect(recancelarRes.body.error).toBe('PEDIDO_NAO_CANCELAVEL');
    });

    it('deve estornar pontos acumulados no cancelamento em EM_PREPARO e bloquear CLIENTE cancelar PRONTO', async () => {
      const unidade = await criarUnidade(ctx.prisma);
      const { produto } = await criarProdutoComEstoque(ctx.prisma, unidade.id, {
        nome: 'Carne de Sol',
        categoria: 'PRATOS',
        precoCentavos: 3500,
      });

      const cliente = await criarUsuarioELogar(ctx, {
        nome: 'Cliente Pontos',
        email: 'clientepontos@exemplo.com',
        perfil: PerfilUsuario.CLIENTE,
      });
      await criarContaFidelidade(ctx.prisma, cliente.id, {
        saldoPontos: 0,
        consentimentoAtivo: true,
      });

      const cozinha = await criarUsuarioELogar(ctx, {
        nome: 'Cozinha',
        email: 'cozinhapronta@raizes.com',
        perfil: PerfilUsuario.COZINHA,
        unidadeId: unidade.id,
      });

      // Pedido 1: pago e cancelado em EM_PREPARO -> reverte os 3 pontos acumulados
      const pedido1Res = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'APP',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          pedidoId: pedido1Res.body.id,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-cancel-pts-001',
        })
        .expect(201);

      const contaAposPagamento = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaAposPagamento.saldoPontos).toBe(3);

      await request(ctx.app.getHttpServer())
        .post(`/pedidos/${pedido1Res.body.id}/cancelar`)
        .set('Authorization', `Bearer ${cliente.token}`)
        .expect(200);

      const contaAposCancelamento = await ctx.prisma.contaFidelidade.findUniqueOrThrow({
        where: { usuarioId: cliente.id },
      });
      expect(contaAposCancelamento.saldoPontos).toBe(0);

      const movEstornoAcumulo = await ctx.prisma.movimentacaoFidelidade.findFirst({
        where: { pedidoId: pedido1Res.body.id, tipo: 'ESTORNO' },
      });
      expect(movEstornoAcumulo?.pontos).toBe(3);

      // Pedido 2: avançado para PRONTO -> cliente não pode cancelar (403)
      const pedido2Res = await request(ctx.app.getHttpServer())
        .post('/pedidos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          unidadeId: unidade.id,
          canalPedido: 'TOTEM',
          itens: [{ produtoId: produto.id, quantidade: 1 }],
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/pagamentos')
        .set('Authorization', `Bearer ${cliente.token}`)
        .send({
          pedidoId: pedido2Res.body.id,
          formaPagamento: 'PIX',
          idempotencyKey: 'pay-cancel-pronto-002',
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .patch(`/pedidos/${pedido2Res.body.id}/status`)
        .set('Authorization', `Bearer ${cozinha.token}`)
        .send({ status: 'PRONTO' })
        .expect(200);

      const clienteProntoCancelRes = await request(ctx.app.getHttpServer())
        .post(`/pedidos/${pedido2Res.body.id}/cancelar`)
        .set('Authorization', `Bearer ${cliente.token}`)
        .expect(403);
      expect(clienteProntoCancelRes.body.error).toBe('ACESSO_NEGADO');
    });
  });
});
