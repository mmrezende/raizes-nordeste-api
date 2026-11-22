import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { FormaPagamento } from '@domain/enums/pagamento.enum';

export class CriarPagamentoDto {
  @ApiProperty({ example: '0193514c-8d12-7a00-8f41-9c2a1b3e4f77' })
  @IsUUID('all')
  pedidoId: string;

  @ApiProperty({ enum: FormaPagamento, example: FormaPagamento.PIX })
  @IsEnum(FormaPagamento)
  formaPagamento: FormaPagamento;

  @ApiProperty({
    description: 'Chave única para garantir idempotência em retentativas',
    example: 'pay-key-001',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  idempotencyKey: string;

  @ApiPropertyOptional({
    description: 'Permite simular recusa determinística no gateway mock para testes',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simularRecusa?: boolean;
}
