/** Result of a domain availability + registration details lookup */
export interface DomainLookupResult {
  domain: string;
  available: boolean;
  method: 'rdap' | 'unknown';
  cached: boolean;
  details: {
    registrar: string | null;
    createdDate: string | null;
    expiryDate: string | null;
    updatedDate: string | null;
    nameservers: string[];
    status: string[];
  };
  error?: string;
}

/** A single domain suggestion with availability status */
export interface DomainSuggestion {
  domain: string;
  available: boolean | null;
  source: 'namestudio' | 'local';
}

/** Result of domain suggestion generation */
export interface SuggestionResult {
  originalDomain: string;
  suggestions: DomainSuggestion[];
}

/** Domain input validation result */
export interface DomainValidation {
  domain: string;
  tld: string;
  isValid: boolean;
  error?: string;
}

/** Reference pricing for a single TLD (Cloudflare at-cost, converted to VND) */
export interface PricingResult {
  tld: string;               // e.g. ".com"
  registerPriceVND: number;  // raw VND amount
  renewPriceVND: number;     // raw VND amount
  registerDisplay: string;   // formatted e.g. "250.000 ₫"
  renewDisplay: string;      // formatted e.g. "250.000 ₫"
}
