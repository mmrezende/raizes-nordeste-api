import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './api/common/interceptors/audit.interceptor';
import { AuthModule } from './api/modules/auth.module';
import { HealthModule } from './api/modules/health.module';
import { UsuariosModule } from './api/modules/usuarios.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
