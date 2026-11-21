import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StatusPedido } from '@domain/enums/pedido.enum';

export class AtualizarStatusPedidoDto {
  @ApiProperty({ enum: [StatusPedido.PRONTO, StatusPedido.ENTREGUE], example: StatusPedido.PRONTO })
  @IsEnum(StatusPedido)
  status: StatusPedido;
}
