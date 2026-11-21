import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@api/common/dtos/pagination-query.dto';
import { CanalPedido, StatusPedido } from '@domain/enums/pedido.enum';

export class ListarPedidosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CanalPedido, example: CanalPedido.TOTEM })
  @IsOptional()
  @IsEnum(CanalPedido)
  canalPedido?: CanalPedido;

  @ApiPropertyOptional({ enum: StatusPedido, example: StatusPedido.AGUARDANDO_PAGAMENTO })
  @IsOptional()
  @IsEnum(StatusPedido)
  status?: StatusPedido;

  @ApiPropertyOptional({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  @IsOptional()
  @IsUUID('all')
  unidadeId?: string;
}
