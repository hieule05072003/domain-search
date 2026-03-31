import { createClient } from 'redis';

/** In-memory fallback cache when Redis is unavailable */
const memoryCache = new Map<string, { data: string; expiresAt: number }>();

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnected = false;

/** Initialize Redis connection — fails gracefully to in-memory fallback */
export async function initRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Cache] No REDIS_URL set — using in-memory cache');
    return;
  }

  try {
    redisClient = createClient({ url });
    redisClient.on('error', (err) => {
      console.warn('[Cache] Redis error:', err.message);
      redisConnected = false;
    });
    redisClient.on('connect', () => {
      redisConnected = true;
      console.log('[Cache] Redis connected');
    });
    await redisClient.connect();
  } catch (err: any) {
    console.warn('[Cache] Redis connection failed:', err.message, '— using in-memory cache');
    redisClient = null;
    redisConnected = false;
  }
}

/** Get cached value by key */
export async function getCache(key: string): Promise<string | null> {
  // Try Redis first
  if (redisClient && redisConnected) {
    try {
      return await redisClient.get(key);
    } catch {
      // Redis read failed — fall through to memory cache
    }
  }

  // In-memory fallback
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  memoryCache.delete(key);
  return null;
}

/** Set cached value with TTL in seconds */
export async function setCache(
  key: string,
  data: string,
  ttlSeconds: number
): Promise<void> {
  // Try Redis first
  if (redisClient && redisConnected) {
    try {
      await redisClient.setEx(key, ttlSeconds, data);
      return;
    } catch {
      // Redis write failed — fall through to memory cache
    }
  }

  // In-memory fallback
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/** Check if Redis is connected */
export function isRedisConnected(): boolean {
  return redisConnected;
}
