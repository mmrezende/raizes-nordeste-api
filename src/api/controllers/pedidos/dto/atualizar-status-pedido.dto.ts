import { ApiProperty } from '@nestjs/swagger';
import { StatusPedido } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class AtualizarStatusPedidoDto {
  @ApiProperty({ enum: [StatusPedido.PRONTO, StatusPedido.ENTREGUE], example: StatusPedido.PRONTO })
  @IsEnum(StatusPedido)
  status: StatusPedido;
}
