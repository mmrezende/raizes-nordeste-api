import { type CanalPedido, TipoDesconto } from '@domain/enums/pedido.enum';
import { ConflictDomainError, ValidationDomainError } from '@domain/errors/domain.error';

export const CENTAVOS_POR_PONTO_FIDELIDADE = 50;
export const CENTAVOS_POR_PONTO_ACUMULO = 1000;

export interface PromocaoAplicavel {
  id: string;
  codigo: string;
  tipoDesconto: TipoDesconto;
  valorDesconto: number;
  valorMinimoCentavos: number;
  unidadeId: string | null;
  canalAplicavel: CanalPedido | null;
  inicioEm: Date;
  fimEm: Date;
  ativo: boolean;
}

export interface ContextoPromocaoPedido {
  subtotalCentavos: number;
  unidadeId: string;
  canalPedido: CanalPedido;
  agora?: Date;
}

export interface CalculoFidelidadeInput {
  pontosSolicitados: number;
  saldoDisponivel: number;
  consentimentoAtivo: boolean;
  valorRestanteCentavos: number;
}

export interface CalculoFidelidadeResultado {
  pontosUtilizados: number;
  descontoCentavos: number;
}

export function validarECalcularDescontoPromocao(
  promocao: PromocaoAplicavel,
  contexto: ContextoPromocaoPedido,
): number {
  const agora = contexto.agora ?? new Date();

  if (!promocao.ativo) {
    throw new ValidationDomainError(
      'Promoção inativa.',
      [{ field: 'codigoPromocao', issue: 'A promoção informada não está ativa.' }],
      'PROMOCAO_INVALIDA',
    );
  }

  if (agora < promocao.inicioEm || agora > promocao.fimEm) {
    throw new ValidationDomainError(
      'Promoção fora do período de vigência.',
      [{ field: 'codigoPromocao', issue: 'O cupom não está vigente no momento.' }],
      'PROMOCAO_INVALIDA',
    );
  }

  if (promocao.unidadeId !== null && promocao.unidadeId !== contexto.unidadeId) {
    throw new ValidationDomainError(
      'Promoção não aplicável à unidade selecionada.',
      [{ field: 'codigoPromocao', issue: 'Cupom restrito a outra unidade.' }],
      'PROMOCAO_INVALIDA',
    );
  }

  if (promocao.canalAplicavel !== null && promocao.canalAplicavel !== contexto.canalPedido) {
    throw new ValidationDomainError(
      'Promoção não aplicável ao canal selecionado.',
      [{ field: 'codigoPromocao', issue: `Cupom válido apenas para o canal ${promocao.canalAplicavel}.` }],
      'PROMOCAO_INVALIDA',
    );
  }

  if (contexto.subtotalCentavos < promocao.valorMinimoCentavos) {
    throw new ValidationDomainError(
      'Subtotal inferior ao valor mínimo exigido pela promoção.',
      [
        {
          field: 'codigoPromocao',
          issue: `Valor mínimo exigido em centavos: ${promocao.valorMinimoCentavos}.`,
        },
      ],
      'PROMOCAO_INVALIDA',
    );
  }

  const descontoBruto =
    promocao.tipoDesconto === TipoDesconto.PERCENTUAL
      ? Math.floor((contexto.subtotalCentavos * promocao.valorDesconto) / 100)
      : promocao.valorDesconto;

  return Math.min(Math.max(0, descontoBruto), contexto.subtotalCentavos);
}

export function calcularDescontoFidelidade(
  params: CalculoFidelidadeInput,
): CalculoFidelidadeResultado {
  if (params.pontosSolicitados <= 0) {
    return { pontosUtilizados: 0, descontoCentavos: 0 };
  }

  if (!params.consentimentoAtivo) {
    throw new ConflictDomainError(
      'Adesão ativa ao programa de fidelidade é obrigatória para resgatar pontos.',
      [],
      'FIDELIDADE_SEM_CONSENTIMENTO',
    );
  }

  if (params.pontosSolicitados > params.saldoDisponivel) {
    throw new ConflictDomainError(
      'Saldo de pontos insuficiente para o resgate solicitado.',
      [{ field: 'pontosResgate', issue: `Disponível: ${params.saldoDisponivel}` }],
      'SALDO_PONTOS_INSUFICIENTE',
    );
  }

  const maxPontosUteis = Math.floor(
    Math.max(0, params.valorRestanteCentavos) / CENTAVOS_POR_PONTO_FIDELIDADE,
  );
  const pontosUtilizados = Math.min(params.pontosSolicitados, maxPontosUteis);

  return {
    pontosUtilizados,
    descontoCentavos: pontosUtilizados * CENTAVOS_POR_PONTO_FIDELIDADE,
  };
}

export function calcularPontosAcumulo(valorTotalCentavos: number): number {
  return Math.floor(Math.max(0, valorTotalCentavos) / CENTAVOS_POR_PONTO_ACUMULO);
}
