import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@api/common/dtos/pagination-query.dto';

export class ProdutoResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  id: string;

  @ApiProperty({ example: 'Tapioca Carne de Sol' })
  nome: string;

  @ApiProperty({ type: String, nullable: true, example: 'Com queijo coalho na brasa' })
  descricao: string | null;

  @ApiProperty({ example: 'TAPIOCAS' })
  categoria: string;

  @ApiProperty({ example: 2490 })
  precoCentavos: number;

  @ApiProperty({ example: 24.9 })
  preco: number;

  @ApiProperty({ example: true })
  ativo: boolean;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  updatedAt: Date;
}

export class ProdutosPaginadosResponseDto {
  @ApiProperty({ type: () => [ProdutoResponseDto] })
  data: ProdutoResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
