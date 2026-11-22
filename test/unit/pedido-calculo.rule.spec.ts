import { CanalPedido, TipoDesconto } from '@domain/enums/pedido.enum';
import { ConflictDomainError, ValidationDomainError } from '@domain/errors/domain.error';
import {
  calcularDescontoFidelidade,
  calcularPontosAcumulo,
  validarECalcularDescontoPromocao,
  type PromocaoAplicavel,
} from '@domain/rules/pedido-calculo.rule';

function capturarErro(fn: () => void): unknown {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}

describe('pedido-calculo.rule', () => {
  const agora = new Date('2026-02-15T12:00:00.000Z');
  const promocaoBase: PromocaoAplicavel = {
    id: '0193514c-8d12-7a00-8f41-9c2a1b3e4f01',
    codigo: 'TOTEM10',
    tipoDesconto: TipoDesconto.PERCENTUAL,
    valorDesconto: 10,
    valorMinimoCentavos: 2000,
    unidadeId: null,
    canalAplicavel: CanalPedido.TOTEM,
    inicioEm: new Date('2026-02-01T00:00:00.000Z'),
    fimEm: new Date('2026-02-28T23:59:59.000Z'),
    ativo: true,
  };

  describe('validarECalcularDescontoPromocao', () => {
    it('deve calcular desconto percentual com arredondamento para baixo em centavos', () => {
      const desconto = validarECalcularDescontoPromocao(
        { ...promocaoBase, valorDesconto: 15 },
        {
          subtotalCentavos: 3333,
          unidadeId: 'unidade-1',
          canalPedido: CanalPedido.TOTEM,
          agora,
        },
      );

      expect(desconto).toBe(499);
    });

    it('deve calcular desconto VALOR_FIXO limitado ao subtotal do pedido', () => {
      const promocaoFixa: PromocaoAplicavel = {
        ...promocaoBase,
        tipoDesconto: TipoDesconto.VALOR_FIXO,
        valorDesconto: 5000,
        valorMinimoCentavos: 0,
        canalAplicavel: null,
      };

      const descontoNormal = validarECalcularDescontoPromocao(promocaoFixa, {
        subtotalCentavos: 8000,
        unidadeId: 'unidade-1',
        canalPedido: CanalPedido.APP,
        agora,
      });
      const descontoLimitado = validarECalcularDescontoPromocao(promocaoFixa, {
        subtotalCentavos: 3200,
        unidadeId: 'unidade-1',
        canalPedido: CanalPedido.APP,
        agora,
      });

      expect(descontoNormal).toBe(5000);
      expect(descontoLimitado).toBe(3200);
    });

    it('deve rejeitar promoção inativa, fora de vigência, de outra unidade, outro canal ou abaixo do mínimo', () => {
      expect(() =>
        validarECalcularDescontoPromocao(
          { ...promocaoBase, ativo: false },
          { subtotalCentavos: 5000, unidadeId: 'u1', canalPedido: CanalPedido.TOTEM, agora },
        ),
      ).toThrow(ValidationDomainError);

      expect(() =>
        validarECalcularDescontoPromocao(promocaoBase, {
          subtotalCentavos: 5000,
          unidadeId: 'u1',
          canalPedido: CanalPedido.TOTEM,
          agora: new Date('2026-03-10T12:00:00.000Z'),
        }),
      ).toThrow(ValidationDomainError);

      expect(() =>
        validarECalcularDescontoPromocao(
          { ...promocaoBase, unidadeId: 'unidade-a' },
          { subtotalCentavos: 5000, unidadeId: 'unidade-b', canalPedido: CanalPedido.TOTEM, agora },
        ),
      ).toThrow(ValidationDomainError);

      expect(() =>
        validarECalcularDescontoPromocao(promocaoBase, {
          subtotalCentavos: 5000,
          unidadeId: 'u1',
          canalPedido: CanalPedido.APP,
          agora,
        }),
      ).toThrow(ValidationDomainError);

      const erro = capturarErro(() =>
        validarECalcularDescontoPromocao(promocaoBase, {
          subtotalCentavos: 1999,
          unidadeId: 'u1',
          canalPedido: CanalPedido.TOTEM,
          agora,
        }),
      );

      expect(erro).toBeInstanceOf(ValidationDomainError);
      expect((erro as ValidationDomainError).code).toBe('PROMOCAO_INVALIDA');
    });
  });

  describe('calcularDescontoFidelidade', () => {
    it('deve retornar zero sem exigir consentimento quando pontosSolicitados for 0', () => {
      const resultado = calcularDescontoFidelidade({
        pontosSolicitados: 0,
        saldoDisponivel: 0,
        consentimentoAtivo: false,
        valorRestanteCentavos: 4000,
      });

      expect(resultado).toEqual({ pontosUtilizados: 0, descontoCentavos: 0 });
    });

    it('deve lançar FIDELIDADE_SEM_CONSENTIMENTO quando não houver consentimento ativo', () => {
      const erro = capturarErro(() =>
        calcularDescontoFidelidade({
          pontosSolicitados: 10,
          saldoDisponivel: 50,
          consentimentoAtivo: false,
          valorRestanteCentavos: 4000,
        }),
      );

      expect(erro).toBeInstanceOf(ConflictDomainError);
      expect((erro as ConflictDomainError).code).toBe('FIDELIDADE_SEM_CONSENTIMENTO');
    });

    it('deve lançar SALDO_PONTOS_INSUFICIENTE quando saldo for menor que pontos solicitados', () => {
      const erro = capturarErro(() =>
        calcularDescontoFidelidade({
          pontosSolicitados: 10,
          saldoDisponivel: 5,
          consentimentoAtivo: true,
          valorRestanteCentavos: 4000,
        }),
      );

      expect(erro).toBeInstanceOf(ConflictDomainError);
      expect((erro as ConflictDomainError).code).toBe('SALDO_PONTOS_INSUFICIENTE');
    });

    it('deve calcular resgate normal (10 pts = 500 centavos) e limitar pontos ao restante do pedido', () => {
      const normal = calcularDescontoFidelidade({
        pontosSolicitados: 10,
        saldoDisponivel: 20,
        consentimentoAtivo: true,
        valorRestanteCentavos: 4500,
      });
      expect(normal).toEqual({ pontosUtilizados: 10, descontoCentavos: 500 });

      const limitado = calcularDescontoFidelidade({
        pontosSolicitados: 10,
        saldoDisponivel: 20,
        consentimentoAtivo: true,
        valorRestanteCentavos: 130,
      });
      expect(limitado).toEqual({ pontosUtilizados: 2, descontoCentavos: 100 });
    });
  });

  describe('calcularPontosAcumulo', () => {
    it('deve acumular 1 ponto inteiro a cada R$ 10,00 pagos (1000 centavos)', () => {
      expect(calcularPontosAcumulo(3500)).toBe(3);
      expect(calcularPontosAcumulo(999)).toBe(0);
      expect(calcularPontosAcumulo(0)).toBe(0);
      expect(calcularPontosAcumulo(-500)).toBe(0);
    });
  });
});
