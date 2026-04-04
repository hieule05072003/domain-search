/**
 * Domain lookup service — RDAP-only (CF Workers compatible).
 * Uses native fetch() instead of axios. No WHOIS/DNS fallback.
 */
import { DomainLookupResult } from '../types/domain.types';

/** Hardcoded RDAP servers for top TLDs — avoids IANA bootstrap round-trip */
const RDAP_SERVERS: Record<string, string> = {
  com: 'https://rdap.verisign.com/com/v1',
  net: 'https://rdap.verisign.com/net/v1',
  org: 'https://rdap.publicinterestregistry.org/rdap/domain',
  io: 'https://rdap.nic.io/domain',
  co: 'https://rdap.nic.co/domain',
  dev: 'https://rdap.nic.google/domain',
  app: 'https://rdap.nic.google/domain',
  uk: 'https://rdap.nominet.uk/uk/domain',
  fr: 'https://rdap.nic.fr/domain',
  // vn: VNNIC RDAP is unreliable — falls through to DNS-over-HTTPS
  ai: 'https://rdap.nic.ai/domain',
  me: 'https://rdap.nic.me/domain',
};

/** IANA bootstrap cache — refreshed every 24h */
let bootstrapCache: Record<string, string> = {};
let bootstrapLastFetch = 0;
const BOOTSTRAP_TTL = 24 * 60 * 60 * 1000;

/** Build empty details object */
function emptyDetails(): DomainLookupResult['details'] {
  return {
    registrar: null,
    createdDate: null,
    expiryDate: null,
    updatedDate: null,
    nameservers: [],
    status: [],
  };
}

/**
 * Fetch IANA RDAP bootstrap to discover RDAP server for unknown TLDs.
 * Cached in memory for 24h.
 */
async function getBootstrapServer(tld: string): Promise<string | null> {
  const now = Date.now();

  if (now - bootstrapLastFetch > BOOTSTRAP_TTL || !bootstrapCache[tld]) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('https://data.iana.org/rdap/domain.json', {
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = (await res.json()) as { services?: [string[], string[]][] };
      const services = data?.services || [];

      bootstrapCache = {};
      for (const [tlds, servers] of services) {
        for (const t of tlds) {
          bootstrapCache[t] = servers[0];
        }
      }
      bootstrapLastFetch = now;
    } catch {
      return null;
    }
  }

  return bootstrapCache[tld] || null;
}

/** Extract registrar name from RDAP entities array */
function extractRegistrar(entities: any[]): string | null {
  if (!Array.isArray(entities)) return null;

  for (const entity of entities) {
    const roles: string[] = entity.roles || [];
    if (roles.includes('registrar')) {
      const vcard = entity.vcardArray?.[1];
      if (vcard) {
        const fnEntry = vcard.find((v: any[]) => v[0] === 'fn');
        if (fnEntry) return fnEntry[3] as string;
      }
      if (entity.publicIds?.[0]?.identifier) {
        return entity.publicIds[0].identifier;
      }
      return entity.handle || null;
    }
  }
  return null;
}

/** Extract date from RDAP events array by action type */
function extractEventDate(events: any[], action: string): string | null {
  if (!Array.isArray(events)) return null;
  const event = events.find((e: any) => e.eventAction === action);
  return event?.eventDate || null;
}

/**
 * Try RDAP lookup — primary (and only) method.
 * HTTP 200 = taken (parse details), HTTP 404 = available, error = null (unsupported)
 */
async function tryRdap(
  domain: string,
  tld: string
): Promise<DomainLookupResult | null> {
  try {
    let serverBase = RDAP_SERVERS[tld];

    if (!serverBase) {
      const bootstrapUrl = await getBootstrapServer(tld);
      if (!bootstrapUrl) return null;
      serverBase = `${bootstrapUrl.replace(/\/$/, '')}/domain`;
    }

    const url = serverBase.includes('/domain')
      ? `${serverBase}/${domain}`
      : `${serverBase}/domain/${domain}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (response.status === 404) {
      return {
        domain,
        available: true,
        method: 'rdap',
        cached: false,
        details: emptyDetails(),
      };
    }

    if (response.ok) {
      const data = (await response.json()) as any;

      const nameservers: string[] = Array.isArray(data.nameservers)
        ? data.nameservers
            .map((ns: any) => ns.ldhName || ns.unicodeName)
            .filter(Boolean)
        : [];

      const status: string[] = Array.isArray(data.status) ? data.status : [];

      return {
        domain,
        available: false,
        method: 'rdap',
        cached: false,
        details: {
          registrar: extractRegistrar(data.entities),
          createdDate: extractEventDate(data.events, 'registration'),
          expiryDate: extractEventDate(data.events, 'expiration'),
          updatedDate: extractEventDate(data.events, 'last changed'),
          nameservers,
          status,
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * DNS-over-HTTPS fallback — works on CF Workers.
 * Checks if domain has NS records (registered) or NXDOMAIN (available).
 * No registration details, just availability heuristic.
 */
async function tryDnsOverHttps(domain: string): Promise<DomainLookupResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as { Status: number; Answer?: any[] };

    // Status 3 = NXDOMAIN = domain doesn't exist = likely available
    if (data.Status === 3) {
      return {
        domain,
        available: true,
        method: 'rdap' as const,
        cached: false,
        details: emptyDetails(),
      };
    }

    // Has NS/answer records = domain is registered
    if (data.Answer && data.Answer.length > 0) {
      return {
        domain,
        available: false,
        method: 'rdap' as const,
        cached: false,
        details: emptyDetails(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Main domain lookup — RDAP first, DNS-over-HTTPS fallback.
 * Returns availability + registration details.
 */
export async function lookupDomain(
  domain: string
): Promise<DomainLookupResult> {
  const tld = domain.split('.').pop()!;

  const rdapResult = await tryRdap(domain, tld);
  if (rdapResult) return rdapResult;

  // Fallback: DNS-over-HTTPS (covers TLDs with broken/missing RDAP like .vn)
  const dnsResult = await tryDnsOverHttps(domain);
  if (dnsResult) return dnsResult;

  // All methods failed
  return {
    domain,
    available: false,
    method: 'unknown',
    cached: false,
    details: emptyDetails(),
    error: 'Không thể kiểm tra tên miền này. Vui lòng thử lại sau.',
  };
}
