import { StatusPedido } from '@prisma/client';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import {
  ConflictDomainError,
  ForbiddenDomainError,
  ValidationDomainError,
} from '@domain/errors/domain.error';
import {
  podeCancelarPedido,
  validarTransicaoStatusPedido,
} from '@domain/rules/pedido-status.rule';

function capturarErro(fn: () => void): unknown {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}

describe('pedido-status.rule', () => {
  describe('validarTransicaoStatusPedido', () => {
    it('deve permitir COZINHA, GERENTE e ADMIN avançarem EM_PREPARO para PRONTO', () => {
      for (const perfil of [PerfilUsuario.COZINHA, PerfilUsuario.GERENTE, PerfilUsuario.ADMIN]) {
        expect(() =>
          validarTransicaoStatusPedido({
            statusAtual: StatusPedido.EM_PREPARO,
            novoStatus: StatusPedido.PRONTO,
            perfil,
          }),
        ).not.toThrow();
      }
    });

    it('deve permitir ATENDENTE, GERENTE e ADMIN avançarem PRONTO para ENTREGUE', () => {
      for (const perfil of [PerfilUsuario.ATENDENTE, PerfilUsuario.GERENTE, PerfilUsuario.ADMIN]) {
        expect(() =>
          validarTransicaoStatusPedido({
            statusAtual: StatusPedido.PRONTO,
            novoStatus: StatusPedido.ENTREGUE,
            perfil,
          }),
        ).not.toThrow();
      }
    });

    it('deve bloquear perfis sem permissão com ForbiddenDomainError (403)', () => {
      const erroAtendentePronto = capturarErro(() =>
        validarTransicaoStatusPedido({
          statusAtual: StatusPedido.EM_PREPARO,
          novoStatus: StatusPedido.PRONTO,
          perfil: PerfilUsuario.ATENDENTE,
        }),
      );
      expect(erroAtendentePronto).toBeInstanceOf(ForbiddenDomainError);

      const erroCozinhaEntregue = capturarErro(() =>
        validarTransicaoStatusPedido({
          statusAtual: StatusPedido.PRONTO,
          novoStatus: StatusPedido.ENTREGUE,
          perfil: PerfilUsuario.COZINHA,
        }),
      );
      expect(erroCozinhaEntregue).toBeInstanceOf(ForbiddenDomainError);
    });

    it('deve rejeitar status de destino inválido com ValidationDomainError (422)', () => {
      const erro = capturarErro(() =>
        validarTransicaoStatusPedido({
          statusAtual: StatusPedido.EM_PREPARO,
          novoStatus: StatusPedido.CANCELADO,
          perfil: PerfilUsuario.ADMIN,
        }),
      );
      expect(erro).toBeInstanceOf(ValidationDomainError);
    });

    it('deve bloquear transições fora de ordem com ConflictDomainError (TRANSICAO_STATUS_INVALIDA)', () => {
      const casos = [
        { atual: StatusPedido.AGUARDANDO_PAGAMENTO, novo: StatusPedido.PRONTO },
        { atual: StatusPedido.EM_PREPARO, novo: StatusPedido.ENTREGUE },
        { atual: StatusPedido.ENTREGUE, novo: StatusPedido.ENTREGUE },
      ];

      for (const caso of casos) {
        const erro = capturarErro(() =>
          validarTransicaoStatusPedido({
            statusAtual: caso.atual,
            novoStatus: caso.novo,
            perfil: PerfilUsuario.ADMIN,
          }),
        );
        expect(erro).toBeInstanceOf(ConflictDomainError);
        expect((erro as ConflictDomainError).code).toBe('TRANSICAO_STATUS_INVALIDA');
      }
    });
  });

  describe('podeCancelarPedido', () => {
    it('deve permitir cancelamento apenas antes da entrega ou recusa/cancelamento prévio', () => {
      expect(podeCancelarPedido(StatusPedido.AGUARDANDO_PAGAMENTO)).toBe(true);
      expect(podeCancelarPedido(StatusPedido.EM_PREPARO)).toBe(true);
      expect(podeCancelarPedido(StatusPedido.PRONTO)).toBe(true);
      expect(podeCancelarPedido(StatusPedido.ENTREGUE)).toBe(false);
      expect(podeCancelarPedido(StatusPedido.PAGAMENTO_RECUSADO)).toBe(false);
      expect(podeCancelarPedido(StatusPedido.CANCELADO)).toBe(false);
    });
  });
});
