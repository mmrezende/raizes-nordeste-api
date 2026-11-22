import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@api/common/dtos/pagination-query.dto';

export class UnidadeResponseDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  id: string;

  @ApiProperty({ example: 'REC-01' })
  codigo: string;

  @ApiProperty({ example: 'Raízes Boa Viagem' })
  nome: string;

  @ApiProperty({ example: 'Av. Boa Viagem, 1000' })
  endereco: string;

  @ApiProperty({ example: true })
  ativo: boolean;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-15T14:00:00.000Z' })
  updatedAt: Date;
}

export class UnidadesPaginadasResponseDto {
  @ApiProperty({ type: () => [UnidadeResponseDto] })
  data: UnidadeResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
