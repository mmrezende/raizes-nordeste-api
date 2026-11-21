import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dtos/pagination-query.dto';

export class CardapioItemResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  produtoId: string;

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

  @ApiProperty({ example: 15 })
  quantidadeDisponivel: number;

  @ApiProperty({ example: true })
  disponivelVenda: boolean;
}

export class CardapioPaginadoResponseDto {
  @ApiProperty({ type: () => [CardapioItemResponseDto] })
  data: CardapioItemResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
