import axios from 'axios';
import { PricingResult } from '../types/domain.types';

/** Cloudflare at-cost domain prices from cfdomainpricing.com */
const PRICING_URL = 'https://cfdomainpricing.com/prices.json';

/** VND per USD fixed conversion rate */
const VND_RATE = 25500;

/** Cache: full TLD price map + last fetch timestamp */
let priceCache: Record<string, { registration: number; renewal: number }> = {};
let cacheFetchedAt = 0;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Format a VND amount as "250.000 ₫" (dot as thousands separator).
 */
function formatVND(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString('vi-VN'); // uses dot separators in vi-VN locale
  return `${formatted} ₫`;
}

/**
 * Ensure the price cache is populated, fetching from cfdomainpricing.com if stale.
 * Silently ignores fetch failures — callers handle empty cache gracefully.
 */
async function ensureCache(): Promise<void> {
  const now = Date.now();
  if (now - cacheFetchedAt < CACHE_TTL_MS && Object.keys(priceCache).length > 0) {
    return; // Cache is still fresh
  }

  try {
    const res = await axios.get<Record<string, { registration: number; renewal: number }>>(
      PRICING_URL,
      { timeout: 8000, headers: { Accept: 'application/json' } }
    );
    if (res.data && typeof res.data === 'object') {
      priceCache = res.data;
      cacheFetchedAt = now;
    }
  } catch {
    // Graceful fail — keep stale cache if available
  }
}

/**
 * Look up pricing for a list of TLDs (without leading dot).
 * Returns only TLDs that have pricing data.
 * Prices converted from USD to VND using fixed rate 25500.
 */
export async function getPricing(tlds: string[]): Promise<PricingResult[]> {
  await ensureCache();

  const results: PricingResult[] = [];

  for (const rawTld of tlds) {
    // Normalise: strip leading dot, lowercase
    const tld = rawTld.replace(/^\./, '').toLowerCase();
    const entry = priceCache[tld];
    if (!entry) continue;

    const registerPriceVND = Math.round(entry.registration * VND_RATE);
    const renewPriceVND    = Math.round(entry.renewal    * VND_RATE);

    results.push({
      tld: `.${tld}`,
      registerPriceVND,
      renewPriceVND,
      registerDisplay: formatVND(registerPriceVND),
      renewDisplay:    formatVND(renewPriceVND),
    });
  }

  return results;
}
