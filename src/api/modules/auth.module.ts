import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '@api/common/guards/jwt-auth.guard';
import { RolesGuard } from '@api/common/guards/roles.guard';
import { AuthController } from '@api/controllers/auth/auth.controller';
import { AuthService } from '@application/use-cases/auth/auth.service';
import { getEnvConfig } from '@infrastructure/config/env.config';
import { JwtStrategy } from '@infrastructure/security/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const env = getEnvConfig();
        return {
          secret: env.jwtSecret,
          signOptions: {
            expiresIn: env.jwtExpiresInSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}
