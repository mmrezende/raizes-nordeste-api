import { Module } from '@nestjs/common';
import { PagamentosController } from '@api/controllers/pagamentos/pagamentos.controller';
import { PAYMENT_GATEWAY } from '@application/ports/payment-gateway.interface';
import { PagamentosService } from '@application/use-cases/pagamentos/pagamentos.service';
import { MockPaymentGateway } from '@infrastructure/payment/mock-payment.gateway';

@Module({
  controllers: [PagamentosController],
  providers: [
    PagamentosService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway,
    },
  ],
})
export class PagamentosModule {}
