import rateLimit from 'express-rate-limit';

/** Rate limiter for /api/* routes — 10 requests per minute per IP */
export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
  },
});
