import axios from 'axios';
import { whoisDomain } from 'whoiser';
import { DomainLookupResult } from '../types/domain.types';

/** Hardcoded RDAP servers for top TLDs — avoids IANA bootstrap round-trip */
const RDAP_SERVERS: Record<string, string> = {
  com: 'https://rdap.verisign.com/com/v1',
  net: 'https://rdap.verisign.com/net/v1',
  org: 'https://rdap.org/domain',
  io: 'https://rdap.nic.io/domain',
  co: 'https://rdap.nic.co/domain',
  dev: 'https://rdap.nic.google/domain',
  app: 'https://rdap.nic.google/domain',
  uk: 'https://rdap.nominet.uk/uk/domain',
  fr: 'https://rdap.nic.fr/domain',
  vn: 'https://rdap.vnnic.vn/domain',
  ai: 'https://rdap.nic.ai/domain',
  me: 'https://rdap.nic.me/domain',
};

/** IANA bootstrap cache — refreshed every 24h */
let bootstrapCache: Record<string, string> = {};
let bootstrapLastFetch = 0;
const BOOTSTRAP_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
      const res = await axios.get('https://data.iana.org/rdap/domain.json', {
        timeout: 5000,
      });
      const services: [string[], string[]][] = res.data?.services || [];

      bootstrapCache = {};
      for (const [tlds, servers] of services) {
        for (const t of tlds) {
          bootstrapCache[t] = servers[0];
        }
      }
      bootstrapLastFetch = now;
    } catch {
      // Bootstrap fetch failed — return null, caller falls back to WHOIS
      return null;
    }
  }

  return bootstrapCache[tld] || null;
}

/**
 * Extract registrar name from RDAP entities array.
 * Looks for entity with role "registrar".
 */
function extractRegistrar(entities: any[]): string | null {
  if (!Array.isArray(entities)) return null;

  for (const entity of entities) {
    const roles: string[] = entity.roles || [];
    if (roles.includes('registrar')) {
      // Try vcardArray first, then publicIds, then handle/fn
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

/**
 * Extract date from RDAP events array by action type.
 * Common actions: "registration", "expiration", "last changed"
 */
function extractEventDate(events: any[], action: string): string | null {
  if (!Array.isArray(events)) return null;
  const event = events.find((e: any) => e.eventAction === action);
  return event?.eventDate || null;
}

/**
 * Try RDAP lookup — primary method.
 * HTTP 200 = taken (parse details), HTTP 404 = available, error = null (trigger fallback)
 */
async function tryRdap(
  domain: string,
  tld: string
): Promise<DomainLookupResult | null> {
  try {
    // Find RDAP server: hardcoded map first, then IANA bootstrap
    let serverBase = RDAP_SERVERS[tld];

    if (!serverBase) {
      const bootstrapUrl = await getBootstrapServer(tld);
      if (!bootstrapUrl) return null; // No RDAP server found — fallback to WHOIS
      serverBase = `${bootstrapUrl.replace(/\/$/, '')}/domain`;
    }

    const url = serverBase.includes('/domain')
      ? `${serverBase}/${domain}`
      : `${serverBase}/domain/${domain}`;

    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: () => true, // Accept all HTTP status codes
    });

    // HTTP 404 = domain not in registry = available
    if (response.status === 404) {
      return {
        domain,
        available: true,
        method: 'rdap',
        cached: false,
        details: emptyDetails(),
      };
    }

    // HTTP 200 = domain is registered
    if (response.status === 200 && response.data) {
      const data = response.data;

      const nameservers: string[] = Array.isArray(data.nameservers)
        ? data.nameservers
            .map((ns: any) => ns.ldhName || ns.unicodeName)
            .filter(Boolean)
        : [];

      const status: string[] = Array.isArray(data.status)
        ? data.status
        : [];

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

    // Other HTTP status (e.g., 400, 500) — return null to trigger fallback
    return null;
  } catch {
    // Network error, timeout, etc. — return null to trigger WHOIS fallback
    return null;
  }
}

/**
 * Try WHOIS lookup via whoiser — fallback for ccTLDs without RDAP.
 * Empty object = available, populated = taken.
 */
async function tryWhois(
  domain: string
): Promise<DomainLookupResult | null> {
  try {
    const whoisData = await whoisDomain(domain, { timeout: 5000 });

    // whoiser returns object keyed by WHOIS server
    const serverKeys = Object.keys(whoisData);
    if (serverKeys.length === 0) {
      // Empty result = domain likely available
      return {
        domain,
        available: true,
        method: 'whois',
        cached: false,
        details: emptyDetails(),
      };
    }

    // Get data from first WHOIS server response
    const data: any = whoisData[serverKeys[0]];

    // Check for "not found" indicators
    const domainName = data['Domain Name'] || data['domain name'] || '';
    if (!domainName && !data['Registrar']) {
      return {
        domain,
        available: true,
        method: 'whois',
        cached: false,
        details: emptyDetails(),
      };
    }

    // Domain is registered — extract details
    const nameservers: string[] = [];
    const nsField = data['Name Server'] || data['nserver'] || data['Nameservers'];
    if (Array.isArray(nsField)) {
      nameservers.push(...nsField.map((ns: string) => ns.toLowerCase()));
    } else if (typeof nsField === 'string') {
      nameservers.push(nsField.toLowerCase());
    }

    const status: string[] = [];
    const statusField = data['Domain Status'] || data['Status'];
    if (Array.isArray(statusField)) {
      status.push(...statusField);
    } else if (typeof statusField === 'string') {
      status.push(statusField);
    }

    return {
      domain,
      available: false,
      method: 'whois',
      cached: false,
      details: {
        registrar: data['Registrar'] || data['registrar'] || null,
        createdDate: data['Created Date'] || data['Creation Date'] || null,
        expiryDate:
          data['Registry Expiry Date'] ||
          data['Expiry Date'] ||
          data['Expiration Date'] ||
          null,
        updatedDate: data['Updated Date'] || null,
        nameservers,
        status,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Main domain lookup — tries RDAP first, falls back to WHOIS.
 * Returns availability + registration details in a single call.
 */
export async function lookupDomain(
  domain: string
): Promise<DomainLookupResult> {
  const tld = domain.split('.').pop()!;

  // Try RDAP (fast, standardized JSON)
  const rdapResult = await tryRdap(domain, tld);
  if (rdapResult) return rdapResult;

  // Fallback to WHOIS (covers ccTLDs without RDAP)
  const whoisResult = await tryWhois(domain);
  if (whoisResult) return whoisResult;

  // Both methods failed
  return {
    domain,
    available: false,
    method: 'unknown',
    cached: false,
    details: emptyDetails(),
    error: 'All lookup methods failed',
  };
}
