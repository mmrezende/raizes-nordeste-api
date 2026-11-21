import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { TipoMovimentacaoManualEstoque } from '../../../../domain/enums/tipo-movimentacao-estoque.enum';

export class MovimentarEstoqueDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f55' })
  @IsUUID('all')
  unidadeId: string;

  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f66' })
  @IsUUID('all')
  produtoId: string;

  @ApiProperty({ enum: TipoMovimentacaoManualEstoque, example: TipoMovimentacaoManualEstoque.ENTRADA })
  @IsEnum(TipoMovimentacaoManualEstoque)
  tipo: TipoMovimentacaoManualEstoque;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  quantidade: number;

  @ApiPropertyOptional({ example: 'Reposição inicial', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}
