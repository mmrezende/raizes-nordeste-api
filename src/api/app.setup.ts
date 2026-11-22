import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ValidationDomainError, type ErrorDetail } from '@domain/errors/domain.error';
import { getEnvConfig } from '@infrastructure/config/env.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { requestIdMiddleware } from './common/middlewares/request-id.middleware';
import { setupSwagger } from './swagger/swagger.setup';

function flattenValidationErrors(errors: ValidationError[], parentPath = ''): ErrorDetail[] {
  const details: ErrorDetail[] = [];

  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      for (const issue of Object.values(error.constraints)) {
        details.push({ field, issue });
      }
    }

    if (error.children && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}

export function configureApp(app: INestApplication): void {
  const { swaggerPath } = getEnvConfig();

  app.use(requestIdMiddleware);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      exceptionFactory: (errors: ValidationError[]) =>
        new ValidationDomainError('Dados de entrada inválidos.', flattenValidationErrors(errors)),
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  setupSwagger(app, swaggerPath);
}
