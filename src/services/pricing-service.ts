/**
 * Domain pricing service — fetches at-cost prices from cfdomainpricing.com.
 * Uses native fetch() for CF Workers compatibility.
 */
import { PricingResult } from '../types/domain.types';

const PRICING_URL = 'https://cfdomainpricing.com/prices.json';
const VND_RATE = 25500;

/** Cache: full TLD price map + last fetch timestamp */
let priceCache: Record<string, { registration: number; renewal: number }> = {};
let cacheFetchedAt = 0;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Format a VND amount as "250.000 ₫" */
function formatVND(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString('vi-VN');
  return `${formatted} ₫`;
}

/** Ensure the price cache is populated, fetching if stale */
async function ensureCache(): Promise<void> {
  const now = Date.now();
  if (now - cacheFetchedAt < CACHE_TTL_MS && Object.keys(priceCache).length > 0) {
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(PRICING_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    const data = (await res.json()) as Record<string, { registration: number; renewal: number }>;
    if (data && typeof data === 'object') {
      priceCache = data;
      cacheFetchedAt = now;
    }
  } catch {
    // Graceful fail — keep stale cache if available
  }
}

/**
 * Look up pricing for a list of TLDs (without leading dot).
 * Returns only TLDs that have pricing data.
 */
export async function getPricing(tlds: string[]): Promise<PricingResult[]> {
  await ensureCache();

  const results: PricingResult[] = [];

  for (const rawTld of tlds) {
    const tld = rawTld.replace(/^\./, '').toLowerCase();
    const entry = priceCache[tld];
    if (!entry) continue;

    const registerPriceVND = Math.round(entry.registration * VND_RATE);
    const renewPriceVND = Math.round(entry.renewal * VND_RATE);

    results.push({
      tld: `.${tld}`,
      registerPriceVND,
      renewPriceVND,
      registerDisplay: formatVND(registerPriceVND),
      renewDisplay: formatVND(renewPriceVND),
    });
  }

  return results;
}
