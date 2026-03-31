import { DomainSuggestion, SuggestionResult } from '../types/domain.types';
import { lookupDomain } from './domain-lookup-service';
import { limitConcurrency } from '../utils/concurrent-limiter';

/** Alternative TLDs to suggest when primary is taken */
const ALT_TLDS = ['io', 'co', 'ai', 'dev', 'app', 'net', 'org', 'me'];

/** Prefixes to try for name variations */
const PREFIXES = ['get', 'try', 'my', 'use'];

/** Suffixes to try for name variations */
const SUFFIXES = ['app', 'hq', 'hub'];

/**
 * Generate local domain suggestions — TLD swaps + name variations.
 * Returns raw domain strings (no availability check yet).
 */
function generateLocalSuggestions(domain: string): string[] {
  const parts = domain.split('.');
  const baseName = parts.slice(0, -1).join('.');
  const originalTld = parts[parts.length - 1];
  const suggestions = new Set<string>();

  // Strategy 1: different TLDs with same name
  for (const tld of ALT_TLDS) {
    if (tld !== originalTld) {
      suggestions.add(`${baseName}.${tld}`);
    }
  }

  // Strategy 2: prefixes with original TLD
  for (const prefix of PREFIXES) {
    suggestions.add(`${prefix}${baseName}.${originalTld}`);
  }

  // Strategy 3: suffixes with original TLD
  for (const suffix of SUFFIXES) {
    suggestions.add(`${baseName}${suffix}.${originalTld}`);
  }

  return Array.from(suggestions).slice(0, 12);
}

/**
 * Check availability for a list of domains concurrently.
 * Max 4 parallel lookups to avoid rate limiting.
 * 3s timeout per check — marks as null if timeout.
 */
async function batchCheckAvailability(
  domains: string[]
): Promise<DomainSuggestion[]> {
  const tasks = domains.map((domain) => async (): Promise<DomainSuggestion> => {
    try {
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 3000)
      );
      const lookupPromise = lookupDomain(domain);

      const result = await Promise.race([lookupPromise, timeoutPromise]);

      return {
        domain,
        available: result ? result.available : null,
        source: 'local' as const,
      };
    } catch {
      return { domain, available: null, source: 'local' as const };
    }
  });

  return limitConcurrency(tasks, 4);
}

/**
 * Get domain suggestions for a taken domain.
 * Generates alternatives, checks availability, sorts (available first).
 */
export async function getSuggestions(
  domain: string
): Promise<SuggestionResult> {
  // Generate candidate suggestions
  const candidates = generateLocalSuggestions(domain);

  // Batch check availability (max 4 concurrent, 3s timeout each)
  const suggestions = await batchCheckAvailability(candidates);

  // Sort: available first, then unknown (null), then taken
  suggestions.sort((a, b) => {
    if (a.available === true && b.available !== true) return -1;
    if (b.available === true && a.available !== true) return 1;
    if (a.available === null && b.available === false) return -1;
    if (b.available === null && a.available === false) return 1;
    return 0;
  });

  return {
    originalDomain: domain,
    suggestions: suggestions.slice(0, 10),
  };
}
