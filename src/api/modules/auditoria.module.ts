import { Module } from '@nestjs/common';
import { AuditoriaController } from '@api/controllers/auditoria/auditoria.controller';
import { AuditoriaService } from '@application/use-cases/auditoria/auditoria.service';

@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
})
export class AuditoriaModule {}
