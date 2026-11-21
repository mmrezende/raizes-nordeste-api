import { Module } from '@nestjs/common';
import { UnidadesController } from '@api/controllers/unidades/unidades.controller';
import { UnidadesService } from '@application/use-cases/unidades/unidades.service';
import { EstoqueModule } from './estoque.module';

@Module({
  imports: [EstoqueModule],
  controllers: [UnidadesController],
  providers: [UnidadesService],
})
export class UnidadesModule {}
