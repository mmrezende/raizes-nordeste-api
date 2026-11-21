import { Module } from '@nestjs/common';
import { HealthController } from '@api/controllers/health/health.controller';
import { HealthService } from '@application/use-cases/health/health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
