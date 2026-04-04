/**
 * Cloudflare KV-based rate limiter for Hono.
 * Uses CF-Connecting-IP header for per-client tracking.
 */
import { MiddlewareHandler } from 'hono';

export function kvRateLimiter(windowMs: number, max: number): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const windowKey = `rate:${ip}:${Math.floor(Date.now() / windowMs)}`;
    const kv = (c.env as any).CACHE as KVNamespace;

    try {
      const current = parseInt((await kv.get(windowKey)) || '0', 10);

      if (current >= max) {
        return c.json(
          {
            error: 'rate_limit_exceeded',
            message: 'Too many requests. Please try again later.',
          },
          429
        );
      }

      // Increment counter (fire-and-forget)
      c.executionCtx.waitUntil(
        kv.put(windowKey, String(current + 1), {
          expirationTtl: Math.ceil(windowMs / 1000),
        })
      );
    } catch {
      // KV error — allow request through (fail open)
    }

    await next();
  };
}
