import { Request, Response, NextFunction } from 'express';
import { getCache, setCache } from '../utils/redis-client';

/**
 * Cache middleware factory — caches JSON responses by domain query param.
 * Returns cached response with X-Cache: HIT header on cache hit.
 * On miss, wraps res.json() to store result before sending.
 */
export function cacheMiddleware(prefix: string, ttlSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const domain = req.query.domain as string;
    if (!domain) return next();

    const cacheKey = `${prefix}:${domain.toLowerCase()}`;

    // Check cache
    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.json(JSON.parse(cached));
        return;
      }
    } catch {
      // Cache read failed — proceed without cache
    }

    // Cache miss — intercept res.json() to store result
    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = ((data: any) => {
      // Only cache successful responses (not errors)
      if (res.statusCode >= 200 && res.statusCode < 400) {
        setCache(cacheKey, JSON.stringify(data), ttlSeconds).catch(() => {});
      }
      return originalJson(data);
    }) as any;

    next();
  };
}
