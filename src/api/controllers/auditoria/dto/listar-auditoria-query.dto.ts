import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@api/common/dtos/pagination-query.dto';

export class ListarAuditoriaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'pedidos', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entidade?: string;

  @ApiPropertyOptional({ example: 'PEDIDO_CRIADO', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  acao?: string;
}
