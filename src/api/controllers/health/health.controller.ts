import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '@api/common/decorators/public.decorator';
import { HealthService } from '@application/use-cases/health/health.service';

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status: 'ok' | 'degraded';

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  database: 'up' | 'down';

  @ApiProperty({ example: '2026-11-21T22:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '1.0.0' })
  version: string;
}

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica disponibilidade da API e conexão com o banco de dados' })
  @ApiOkResponse({ type: HealthResponseDto })
  async check(): Promise<HealthResponseDto> {
    return this.healthService.verificar();
  }
}
