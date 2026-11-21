import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '@api/common/decorators/current-user.decorator';
import type { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { getEnvConfig } from '@infrastructure/config/env.config';

export interface JwtPayload {
  sub: string;
  email: string;
  perfil: PerfilUsuario;
  unidadeId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getEnvConfig().jwtSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      perfil: payload.perfil,
      unidadeId: payload.unidadeId,
    };
  }
}
