import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/AppError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const isProd = process.env.NODE_ENV === 'production';
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: isProd && err.statusCode >= 500 ? 'Internal server error' : err.message,
      details: isProd ? null : (err.details ?? null)
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const code = err.code === 'LIMIT_FILE_SIZE' ? 'UPLOAD_FILE_TOO_LARGE' : 'UPLOAD_INVALID';
    const message = err.code === 'LIMIT_FILE_SIZE' ? '上传文件过大' : err.message;
    res.status(400).json({
      success: false,
      code,
      message,
      details: null
    });
    return;
  }

  if (err instanceof Error && err.message === 'Only image files are allowed') {
    res.status(400).json({
      success: false,
      code: 'UPLOAD_INVALID_TYPE',
      message: '仅支持图片文件上传',
      details: null
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: isProd ? 'Internal server error' : message,
    details: null
  });
}

