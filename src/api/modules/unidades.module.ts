import { Module } from '@nestjs/common';
import { UnidadesService } from '../../application/use-cases/unidades/unidades.service';
import { UnidadesController } from '../controllers/unidades/unidades.controller';
import { EstoqueModule } from './estoque.module';

@Module({
  imports: [EstoqueModule],
  controllers: [UnidadesController],
  providers: [UnidadesService],
})
export class UnidadesModule {}
