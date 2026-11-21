import { Module } from '@nestjs/common';
import { PromocoesController } from '@api/controllers/promocoes/promocoes.controller';
import { PromocoesService } from '@application/use-cases/promocoes/promocoes.service';

@Module({
  controllers: [PromocoesController],
  providers: [PromocoesService],
})
export class PromocoesModule {}
