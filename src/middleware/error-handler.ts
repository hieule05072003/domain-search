import { Request, Response, NextFunction } from 'express';

/** Global error handling middleware — must be last in middleware chain */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);

  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { details: err.message, stack: err.stack }),
  });
}
