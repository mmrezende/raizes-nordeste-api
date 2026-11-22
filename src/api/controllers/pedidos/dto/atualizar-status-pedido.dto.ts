import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StatusOperacionalPedido } from '@domain/enums/pedido.enum';

export class AtualizarStatusPedidoDto {
  @ApiProperty({ enum: StatusOperacionalPedido, example: StatusOperacionalPedido.PRONTO })
  @IsEnum(StatusOperacionalPedido)
  status: StatusOperacionalPedido;
}
