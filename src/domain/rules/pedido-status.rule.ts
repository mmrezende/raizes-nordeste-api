import { StatusPedido } from '@domain/enums/pedido.enum';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import {
  ConflictDomainError,
  ForbiddenDomainError,
  ValidationDomainError,
} from '@domain/errors/domain.error';

const PERFIS_COZINHA_OPERACAO: ReadonlySet<PerfilUsuario> = new Set([
  PerfilUsuario.COZINHA,
  PerfilUsuario.GERENTE,
  PerfilUsuario.ADMIN,
]);

const PERFIS_ENTREGA_OPERACAO: ReadonlySet<PerfilUsuario> = new Set([
  PerfilUsuario.ATENDENTE,
  PerfilUsuario.GERENTE,
  PerfilUsuario.ADMIN,
]);

const STATUS_CANCELAVEIS: ReadonlySet<StatusPedido> = new Set([
  StatusPedido.AGUARDANDO_PAGAMENTO,
  StatusPedido.EM_PREPARO,
  StatusPedido.PRONTO,
]);

export interface ValidarTransicaoStatusInput {
  statusAtual: StatusPedido;
  novoStatus: StatusPedido;
  perfil: PerfilUsuario;
}

export function validarTransicaoStatusPedido(input: ValidarTransicaoStatusInput): void {
  if (input.novoStatus === StatusPedido.PRONTO) {
    if (!PERFIS_COZINHA_OPERACAO.has(input.perfil)) {
      throw new ForbiddenDomainError(
        'Apenas cozinha ou gerência pode marcar o pedido como PRONTO.',
        [],
        'ACESSO_NEGADO',
      );
    }

    if (input.statusAtual !== StatusPedido.EM_PREPARO) {
      throw new ConflictDomainError(
        'Apenas pedidos em preparo podem avançar para PRONTO.',
        [{ field: 'status', issue: `Status atual: ${input.statusAtual}` }],
        'TRANSICAO_STATUS_INVALIDA',
      );
    }

    return;
  }

  if (input.novoStatus === StatusPedido.ENTREGUE) {
    if (!PERFIS_ENTREGA_OPERACAO.has(input.perfil)) {
      throw new ForbiddenDomainError(
        'Apenas atendente ou gerência pode marcar o pedido como ENTREGUE.',
        [],
        'ACESSO_NEGADO',
      );
    }

    if (input.statusAtual !== StatusPedido.PRONTO) {
      throw new ConflictDomainError(
        'Apenas pedidos prontos podem avançar para ENTREGUE.',
        [{ field: 'status', issue: `Status atual: ${input.statusAtual}` }],
        'TRANSICAO_STATUS_INVALIDA',
      );
    }

    return;
  }

  throw new ValidationDomainError(
    'Status de destino inválido para atualização operacional.',
    [{ field: 'status', issue: 'Use PRONTO ou ENTREGUE.' }],
  );
}

export function podeCancelarPedido(statusAtual: StatusPedido): boolean {
  return STATUS_CANCELAVEIS.has(statusAtual);
}

export function validarCancelamentoPedido(input: {
  statusAtual: StatusPedido;
  perfil: PerfilUsuario;
}): void {
  if (!podeCancelarPedido(input.statusAtual)) {
    throw new ConflictDomainError(
      'O pedido não pode ser cancelado no status atual.',
      [{ field: 'status', issue: `Status atual: ${input.statusAtual}` }],
      'PEDIDO_NAO_CANCELAVEL',
    );
  }

  if (input.statusAtual === StatusPedido.PRONTO && input.perfil === PerfilUsuario.CLIENTE) {
    throw new ForbiddenDomainError(
      'Pedidos prontos só podem ser cancelados pela equipe da unidade.',
      [],
      'ACESSO_NEGADO',
    );
  }
}
