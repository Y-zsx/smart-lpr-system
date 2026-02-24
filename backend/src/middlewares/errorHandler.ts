import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      details: err.details ?? null
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message,
    details: null
  });
}

