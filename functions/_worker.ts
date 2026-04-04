/**
 * Cloudflare Pages Functions entry point.
 * Hono app handling all API + auth routes.
 * Static files served by CF Pages from public/ directory.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validateDomain } from '../src/utils/domain-validator';
import { lookupDomain } from '../src/services/domain-lookup-service';
import { getSuggestions } from '../src/services/suggestion-service';
import { getPricing } from '../src/services/pricing-service';
import { kvCacheMiddleware } from '../src/middleware/kv-cache-middleware';
import { kvRateLimiter } from '../src/middleware/kv-rate-limiter';
import { jwtAuthMiddleware, type JwtUser } from '../src/middleware/jwt-auth-middleware';
import authRoutes from '../src/routes/auth-routes-jwt';

/** CF Workers environment bindings */
export type Bindings = {
  CACHE: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
};

type Variables = { user: JwtUser | null };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/* ── Global middleware ── */
app.use('*', cors());
app.use('*', jwtAuthMiddleware());

/* ── Rate limiting on API routes ── */
app.use('/api/*', kvRateLimiter(60000, 30));

/* ── Cache middleware per route ── */
app.use('/api/check', kvCacheMiddleware('lookup', 86400));
app.use('/api/suggest', kvCacheMiddleware('suggest', 172800));
app.use('/api/pricing', kvCacheMiddleware('pricing', 43200));

/* ── Auth routes ── */
app.route('/auth', authRoutes);

/* ── Health check ── */
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

/* ── Domain availability check ── */
app.get('/api/check', async (c) => {
  const input = c.req.query('domain') || '';
  const validation = validateDomain(input);
  if (!validation.isValid) return c.json({ error: validation.error }, 400);

  try {
    const result = await lookupDomain(validation.domain);
    if (result.method === 'unknown' && result.error) return c.json(result, 503);
    return c.json(result);
  } catch (err: any) {
    console.error('[/api/check] Error:', err.message);
    return c.json({ error: 'Lookup failed', details: err.message }, 500);
  }
});

/* ── Domain suggestions ── */
app.get('/api/suggest', async (c) => {
  const input = c.req.query('domain') || '';
  const validation = validateDomain(input);
  if (!validation.isValid) return c.json({ error: validation.error }, 400);

  try {
    const result = await getSuggestions(validation.domain);
    return c.json(result);
  } catch (err: any) {
    console.error('[/api/suggest] Error:', err.message);
    return c.json({ error: 'Suggestions failed', details: err.message }, 500);
  }
});

/* ── Domain pricing ── */
app.get('/api/pricing', async (c) => {
  const raw = c.req.query('tlds') || '';
  if (!raw.trim()) return c.json({ error: 'Missing tlds parameter' }, 400);

  const tlds = raw.split(',').map((t) => t.trim()).filter(Boolean);
  try {
    const results = await getPricing(tlds);
    return c.json(results);
  } catch (err: any) {
    console.error('[/api/pricing] Error:', err.message);
    return c.json([]);
  }
});

/* ── Fallback: serve static assets for non-API routes ── */
app.all('*', async (c) => {
  try {
    const assets = (c.env as any).ASSETS;
    if (assets) {
      return assets.fetch(c.req.raw);
    }
    return c.notFound();
  } catch {
    return c.notFound();
  }
});

export default app;
