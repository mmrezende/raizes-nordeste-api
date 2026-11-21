import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ID_GENERATOR, type IdGenerator } from '@application/ports/id-generator.interface';
import { PASSWORD_HASHER, type PasswordHasher } from '@application/ports/password-hasher.interface';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import {
  ConflictDomainError,
  UnauthorizedDomainError,
} from '@domain/errors/domain.error';
import { getEnvConfig } from '@infrastructure/config/env.config';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import type { JwtPayload } from '@infrastructure/security/jwt.strategy';

export interface RegistrarClienteInput {
  nome: string;
  email: string;
  senha: string;
  consentimentoFidelidade?: boolean;
}

export interface LoginInput {
  email: string;
  senha: string;
}

export interface UsuarioSeguro {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  unidadeId: string | null;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginOutput {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    nome: string;
    email: string;
    perfil: PerfilUsuario;
    unidadeId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async registrarCliente(input: RegistrarClienteInput): Promise<UsuarioSeguro> {
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
    const contaFidelidadeId = this.idGenerator.generate();
    const consentimentoAtivo = input.consentimentoFidelidade ?? false;
    const agora = new Date();

    const usuario = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.usuario.create({
        data: {
          id: usuarioId,
          nome: input.nome.trim(),
          email: emailNormalizado,
          senhaHash,
          perfil: PerfilUsuario.CLIENTE,
          unidadeId: null,
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

      await tx.contaFidelidade.create({
        data: {
          id: contaFidelidadeId,
          usuarioId: criado.id,
          saldoPontos: 0,
          consentimentoAtivo,
          consentimentoEm: consentimentoAtivo ? agora : null,
        },
      });

      return criado;
    });

    return usuario;
  }

  async login(input: LoginInput): Promise<LoginOutput> {
    const emailNormalizado = input.email.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { email: emailNormalizado },
    });

    if (!usuario || !usuario.ativo || usuario.anonimizadoEm !== null) {
      throw new UnauthorizedDomainError(
        'E-mail ou senha inválidos.',
        [],
        'CREDENCIAIS_INVALIDAS',
      );
    }

    const senhaValida = await this.passwordHasher.compare(input.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedDomainError(
        'E-mail ou senha inválidos.',
        [],
        'CREDENCIAIS_INVALIDAS',
      );
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      unidadeId: usuario.unidadeId,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: getEnvConfig().jwtExpiresInMs,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        unidadeId: usuario.unidadeId,
      },
    };
  }
}
