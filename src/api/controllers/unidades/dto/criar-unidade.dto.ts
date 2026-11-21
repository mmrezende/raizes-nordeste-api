import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarUnidadeDto {
  @ApiProperty({ example: 'REC-01', minLength: 2, maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(30)
  codigo: string;

  @ApiProperty({ example: 'Raízes Boa Viagem', minLength: 2, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @ApiProperty({ example: 'Av. Boa Viagem, 1000', minLength: 5, maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  endereco: string;
}
