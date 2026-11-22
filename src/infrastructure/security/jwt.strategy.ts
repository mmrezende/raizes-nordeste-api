import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UsuarioAutenticado } from '@application/common/usuario-autenticado.type';
import type { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { UnauthorizedDomainError } from '@domain/errors/domain.error';
import { getEnvConfig } from '@infrastructure/config/env.config';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  perfil: PerfilUsuario;
  unidadeId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getEnvConfig().jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        perfil: true,
        unidadeId: true,
        ativo: true,
        anonimizadoEm: true,
      },
    });

    if (!usuario || !usuario.ativo || usuario.anonimizadoEm !== null) {
      throw new UnauthorizedDomainError(
        'Token de autenticação inválido ou usuário inativo.',
        [],
        'NAO_AUTENTICADO',
      );
    }

    return {
      id: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      unidadeId: usuario.unidadeId,
    };
  }
}
