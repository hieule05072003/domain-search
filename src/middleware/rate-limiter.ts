import rateLimit from 'express-rate-limit';

/** Rate limiter for /api/* routes — 30 requests per minute per IP (~10 searches) */
export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
  },
});
