import { Module } from '@nestjs/common';
import { ProdutosService } from '../../application/use-cases/produtos/produtos.service';
import { ProdutosController } from '../controllers/produtos/produtos.controller';

@Module({
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class ProdutosModule {}
