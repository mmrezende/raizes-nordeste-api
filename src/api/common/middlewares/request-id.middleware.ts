import type { NextFunction, Request, Response } from 'express';
import { gerarUuidV7 } from '@infrastructure/security/uuid-v7.generator';

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const headerValue = req.header('x-request-id');
  const requestId =
    typeof headerValue === 'string' && headerValue.trim().length > 0
      ? headerValue.trim()
      : gerarUuidV7();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
