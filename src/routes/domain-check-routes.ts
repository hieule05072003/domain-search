import { Router, Request, Response } from 'express';
import { validateDomain } from '../utils/domain-validator';
import { lookupDomain } from '../services/domain-lookup-service';
import { getSuggestions } from '../services/suggestion-service';

const router = Router();

/** Home page — renders search form */
router.get('/', (_req: Request, res: Response) => {
  res.render('index');
});

/** Health check endpoint */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Domain availability + registration details check */
router.get('/api/check', async (req: Request, res: Response) => {
  const input = (req.query.domain as string) || '';
  const validation = validateDomain(input);

  if (!validation.isValid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const result = await lookupDomain(validation.domain);

    // Return 503 if all methods failed
    if (result.method === 'unknown' && result.error) {
      res.status(503).json(result);
      return;
    }

    res.json(result);
  } catch (err: any) {
    console.error('[/api/check] Error:', err.message);
    res.status(500).json({ error: 'Lookup failed', details: err.message });
  }
});

/** Domain suggestions — alternative domains when primary is taken */
router.get('/api/suggest', async (req: Request, res: Response) => {
  const input = (req.query.domain as string) || '';
  const validation = validateDomain(input);

  if (!validation.isValid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const result = await getSuggestions(validation.domain);
    res.json(result);
  } catch (err: any) {
    console.error('[/api/suggest] Error:', err.message);
    res.status(500).json({ error: 'Suggestions failed', details: err.message });
  }
});

export default router;
