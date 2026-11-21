import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { ForbiddenDomainError } from '@domain/errors/domain.error';

export function validarEscopoUnidade(
  ator: UsuarioAutenticado,
  unidadeId: string,
  mensagem: string,
): void {
  if (ator.perfil !== PerfilUsuario.ADMIN && ator.unidadeId !== unidadeId) {
    throw new ForbiddenDomainError(mensagem, [], 'ACESSO_NEGADO');
  }
}

export function validarAcessoPedido(
  pedido: { clienteId: string; unidadeId: string },
  ator: UsuarioAutenticado,
  mensagens: { cliente: string; unidade: string },
): void {
  if (ator.perfil === PerfilUsuario.CLIENTE) {
    if (pedido.clienteId !== ator.id) {
      throw new ForbiddenDomainError(mensagens.cliente, [], 'ACESSO_NEGADO');
    }
    return;
  }

  validarEscopoUnidade(ator, pedido.unidadeId, mensagens.unidade);
}
