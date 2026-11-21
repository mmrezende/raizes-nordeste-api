import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@api/common/dtos/pagination-query.dto';
import { CanalPedido } from '@domain/enums/pedido.enum';

function parseOptionalBoolean(raw: unknown): unknown {
  if (raw === 'true' || raw === true) {
    return true;
  }
  if (raw === 'false' || raw === false) {
    return false;
  }
  return raw;
}

export class ListarPromocoesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    parseOptionalBoolean(obj[key]),
  )
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ enum: CanalPedido, example: CanalPedido.TOTEM })
  @IsOptional()
  @IsEnum(CanalPedido)
  canalAplicavel?: CanalPedido;

  @ApiPropertyOptional({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  @IsOptional()
  @IsUUID('all')
  unidadeId?: string;
}
