import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class AtualizarConsentimentoDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  consentimentoAtivo: boolean;
}
