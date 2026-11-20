import { HealthController } from '@src/api/controllers/health/health.controller';
import type { PrismaService } from '@src/infrastructure/database/prisma/prisma.service';

describe('HealthController', () => {
  it('deve retornar status ok e database up quando SELECT 1 tiver sucesso', async () => {
    const prisma = { checkHealth: jest.fn().mockResolvedValue(true) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    const result = await controller.check();

    expect(result).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
      version: '0.1.0',
    });
  });

  it('deve retornar status degraded e database down quando o banco falhar', async () => {
    const prisma = { checkHealth: jest.fn().mockResolvedValue(false) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    const result = await controller.check();

    expect(result).toEqual({
      status: 'degraded',
      database: 'down',
      timestamp: expect.any(String),
      version: '0.1.0',
    });
  });
});
