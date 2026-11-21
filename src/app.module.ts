import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from '@api/common/interceptors/audit.interceptor';
import { AuditoriaModule } from '@api/modules/auditoria.module';
import { AuthModule } from '@api/modules/auth.module';
import { EstoqueModule } from '@api/modules/estoque.module';
import { FidelidadeModule } from '@api/modules/fidelidade.module';
import { HealthModule } from '@api/modules/health.module';
import { PagamentosModule } from '@api/modules/pagamentos.module';
import { PedidosModule } from '@api/modules/pedidos.module';
import { ProdutosModule } from '@api/modules/produtos.module';
import { PromocoesModule } from '@api/modules/promocoes.module';
import { UnidadesModule } from '@api/modules/unidades.module';
import { UsuariosModule } from '@api/modules/usuarios.module';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    UnidadesModule,
    ProdutosModule,
    EstoqueModule,
    PromocoesModule,
    PedidosModule,
    PagamentosModule,
    FidelidadeModule,
    AuditoriaModule,
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
