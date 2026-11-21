import { Module } from '@nestjs/common';
import { FidelidadeController } from '@api/controllers/fidelidade/fidelidade.controller';
import { FidelidadeService } from '@application/use-cases/fidelidade/fidelidade.service';

@Module({
  controllers: [FidelidadeController],
  providers: [FidelidadeService],
})
export class FidelidadeModule {}
