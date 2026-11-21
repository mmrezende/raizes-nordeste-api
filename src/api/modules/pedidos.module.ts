import { Module } from '@nestjs/common';
import { PedidosController } from '@api/controllers/pedidos/pedidos.controller';
import { PedidosService } from '@application/use-cases/pedidos/pedidos.service';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
