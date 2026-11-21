import { Module } from '@nestjs/common';
import { ProdutosController } from '@api/controllers/produtos/produtos.controller';
import { ProdutosService } from '@application/use-cases/produtos/produtos.service';

@Module({
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class ProdutosModule {}
