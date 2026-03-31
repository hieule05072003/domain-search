import { DomainValidation } from '../types/domain.types';

/** Regex: valid domain label (alphanumeric + hyphens, 2-63 chars per label) */
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Validate and normalize domain input.
 * Strips protocol, www, trailing dots. Auto-appends .com if no TLD.
 */
export function validateDomain(input: string): DomainValidation {
  if (!input || typeof input !== 'string') {
    return { domain: '', tld: '', isValid: false, error: 'Domain is required' };
  }

  let domain = input.trim().toLowerCase();

  // Strip protocol (http://, https://)
  domain = domain.replace(/^https?:\/\//, '');

  // Strip www prefix
  domain = domain.replace(/^www\./, '');

  // Strip trailing dot
  domain = domain.replace(/\.$/, '');

  // Strip path/query/hash
  domain = domain.split('/')[0];
  domain = domain.split('?')[0];
  domain = domain.split('#')[0];

  // Auto-append .com if no TLD detected
  if (!domain.includes('.')) {
    domain = `${domain}.com`;
  }

  // Validate format
  if (!DOMAIN_REGEX.test(domain)) {
    return { domain, tld: '', isValid: false, error: 'Invalid domain format' };
  }

  // Check total length (max 253 chars for full domain)
  if (domain.length > 253) {
    return { domain, tld: '', isValid: false, error: 'Domain name too long' };
  }

  const parts = domain.split('.');
  const tld = parts[parts.length - 1];

  return { domain, tld, isValid: true };
}
