import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './api/app.setup';
import { AppModule } from './app.module';
import { getEnvConfig } from './infrastructure/config/env.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const { port, swaggerPath } = getEnvConfig();
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API rodando em http://localhost:${port}`);
  logger.log(`Swagger disponível em http://localhost:${port}/${swaggerPath}`);
}

void bootstrap();
