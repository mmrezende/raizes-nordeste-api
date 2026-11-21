import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@api/common/decorators/current-user.decorator';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import { PASSWORD_HASHER, type PasswordHasher } from '@application/ports/password-hasher.interface';
import type { UsuarioSeguro } from '@application/use-cases/auth/auth.service';
import {
  PERFIS_VINCULADOS_UNIDADE,
  PerfilUsuario,
} from '@domain/enums/perfil-usuario.enum';
import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '@domain/errors/domain.error';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface CriarUsuarioInternoInput {
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
  unidadeId?: string | null;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async buscarPerfil(usuarioId: string): Promise<UsuarioSeguro> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        unidadeId: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      throw new NotFoundDomainError('Usuário não encontrado.', [], 'USUARIO_NAO_ENCONTRADO');
    }

    return usuario;
  }

  async criarUsuarioInterno(
    input: CriarUsuarioInternoInput,
    ator: AuthenticatedUser,
  ): Promise<UsuarioSeguro> {
    const exigeUnidade = PERFIS_VINCULADOS_UNIDADE.has(input.perfil);

    if (exigeUnidade && !input.unidadeId) {
      throw new ValidationDomainError(
        'Funcionários de loja devem estar vinculados a uma unidade.',
        [
          {
            field: 'unidadeId',
            issue: 'Obrigatório para perfis ATENDENTE, COZINHA e GERENTE.',
          },
        ],
      );
    }

    if (ator.perfil === PerfilUsuario.GERENTE) {
      const perfilPermitidoParaGerente =
        input.perfil === PerfilUsuario.ATENDENTE || input.perfil === PerfilUsuario.COZINHA;

      if (!perfilPermitidoParaGerente || input.unidadeId !== ator.unidadeId) {
        throw new ForbiddenDomainError(
          'Gerente só pode cadastrar atendentes ou cozinha na própria unidade.',
          [],
          'ACESSO_NEGADO',
        );
      }
    }

    const unidadeIdFinal = exigeUnidade ? (input.unidadeId ?? null) : null;

    if (unidadeIdFinal) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: unidadeIdFinal },
        select: { id: true },
      });

      if (!unidade) {
        throw new NotFoundDomainError('Unidade não encontrada.', [], 'UNIDADE_NAO_ENCONTRADA');
      }
    }

    const emailNormalizado = input.email.trim().toLowerCase();
    const existente = await this.prisma.usuario.findUnique({
      where: { email: emailNormalizado },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictDomainError(
        'Já existe um usuário cadastrado com este e-mail.',
        [{ field: 'email', issue: 'E-mail já cadastrado.' }],
        'EMAIL_JA_CADASTRADO',
      );
    }

    const senhaHash = await this.passwordHasher.hash(input.senha);
    const usuarioId = this.idGenerator.generate();

    const usuario = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.usuario.create({
        data: {
          id: usuarioId,
          nome: input.nome.trim(),
          email: emailNormalizado,
          senhaHash,
          perfil: input.perfil,
          unidadeId: unidadeIdFinal,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          unidadeId: true,
          ativo: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (input.perfil === PerfilUsuario.CLIENTE) {
        await tx.contaFidelidade.create({
          data: {
            id: this.idGenerator.generate(),
            usuarioId: criado.id,
            saldoPontos: 0,
            consentimentoAtivo: false,
          },
        });
      }

      return criado;
    });

    return usuario;
  }
}
