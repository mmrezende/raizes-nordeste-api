import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication, swaggerPath: string): void {
  const config = new DocumentBuilder()
    .setTitle('Raízes do Nordeste API')
    .setDescription(
      'API REST multicanal para gestão de unidades, cardápio, estoque por loja, pedidos, promoções, pagamento simulado, fidelidade (LGPD) e auditoria.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(swaggerPath, app, document);
}
