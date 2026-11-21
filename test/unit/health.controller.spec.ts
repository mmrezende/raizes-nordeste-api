import { HealthController } from '@api/controllers/health/health.controller';
import { HealthService } from '@application/use-cases/health/health.service';
import { getAppVersion } from '@infrastructure/config/env.config';
import type { PrismaService } from '@infrastructure/database/prisma/prisma.service';

describe('HealthController', () => {
  it('deve retornar status ok e database up quando SELECT 1 tiver sucesso', async () => {
    const prisma = { checkHealth: jest.fn().mockResolvedValue(true) };
    const service = new HealthService(prisma as unknown as PrismaService);
    const controller = new HealthController(service);

    const result = await controller.check();

    expect(result).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
      version: getAppVersion(),
    });
  });

  it('deve retornar status degraded e database down quando o banco falhar', async () => {
    const prisma = { checkHealth: jest.fn().mockResolvedValue(false) };
    const service = new HealthService(prisma as unknown as PrismaService);
    const controller = new HealthController(service);

    const result = await controller.check();

    expect(result).toEqual({
      status: 'degraded',
      database: 'down',
      timestamp: expect.any(String),
      version: getAppVersion(),
    });
  });
});
