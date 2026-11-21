import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@api/common/dtos/pagination-query.dto';

export class ListarProdutosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'TAPIOCAS' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;
}
