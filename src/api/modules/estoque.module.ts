import { Module } from '@nestjs/common';
import { EstoqueService } from '../../application/use-cases/estoque/estoque.service';
import { EstoqueController } from '../controllers/estoque/estoque.controller';

@Module({
  controllers: [EstoqueController],
  providers: [EstoqueService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
