/**
 * Cloudflare KV-based cache middleware for Hono.
 * Caches JSON API responses with TTL. Returns X-Cache header.
 */
import { MiddlewareHandler } from 'hono';

export function kvCacheMiddleware(prefix: string, ttlSeconds: number): MiddlewareHandler {
  return async (c, next) => {
    const domain = c.req.query('domain');
    if (!domain) return next();

    const cacheKey = `${prefix}:${domain.toLowerCase()}`;
    const kv = (c.env as any).CACHE as KVNamespace;

    // Check cache
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        c.header('X-Cache', 'HIT');
        return c.json(JSON.parse(cached));
      }
    } catch {
      // KV read failed — proceed without cache
    }

    // Cache miss — proceed to handler
    c.header('X-Cache', 'MISS');
    await next();

    // Store successful response in KV (fire-and-forget via waitUntil)
    if (c.res.status >= 200 && c.res.status < 400) {
      try {
        const body = await c.res.clone().text();
        c.executionCtx.waitUntil(
          kv.put(cacheKey, body, { expirationTtl: ttlSeconds })
        );
      } catch {
        // Cache write failed — non-critical
      }
    }
  };
}
