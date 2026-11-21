import { Injectable } from '@nestjs/common';
import { getAppVersion } from '@infrastructure/config/env.config';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  timestamp: string;
  version: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async verificar(): Promise<HealthStatus> {
    const isDatabaseUp = await this.prisma.checkHealth();

    return {
      status: isDatabaseUp ? 'ok' : 'degraded',
      database: isDatabaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      version: getAppVersion(),
    };
  }
}
