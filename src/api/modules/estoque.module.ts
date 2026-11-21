import { Module } from '@nestjs/common';
import { EstoqueController } from '@api/controllers/estoque/estoque.controller';
import { EstoqueService } from '@application/use-cases/estoque/estoque.service';

@Module({
  controllers: [EstoqueController],
  providers: [EstoqueService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
