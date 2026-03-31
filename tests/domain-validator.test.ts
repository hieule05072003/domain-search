import { validateDomain } from '../src/utils/domain-validator';

describe('validateDomain', () => {
  test('valid .com domain', () => {
    const r = validateDomain('example.com');
    expect(r.isValid).toBe(true);
    expect(r.domain).toBe('example.com');
    expect(r.tld).toBe('com');
  });

  test('valid .io domain', () => {
    const r = validateDomain('my-site.io');
    expect(r.isValid).toBe(true);
    expect(r.tld).toBe('io');
  });

  test('auto-appends .com when no TLD', () => {
    const r = validateDomain('mysite');
    expect(r.isValid).toBe(true);
    expect(r.domain).toBe('mysite.com');
  });

  test('strips https:// protocol', () => {
    const r = validateDomain('https://example.com');
    expect(r.domain).toBe('example.com');
    expect(r.isValid).toBe(true);
  });

  test('strips www prefix', () => {
    const r = validateDomain('www.example.com');
    expect(r.domain).toBe('example.com');
  });

  test('strips trailing dot', () => {
    const r = validateDomain('example.com.');
    expect(r.domain).toBe('example.com');
    expect(r.isValid).toBe(true);
  });

  test('strips path and query', () => {
    const r = validateDomain('example.com/path?q=1');
    expect(r.domain).toBe('example.com');
  });

  test('converts to lowercase', () => {
    const r = validateDomain('EXAMPLE.COM');
    expect(r.domain).toBe('example.com');
  });

  test('rejects empty input', () => {
    const r = validateDomain('');
    expect(r.isValid).toBe(false);
    expect(r.error).toBe('Domain is required');
  });

  test('rejects invalid format', () => {
    const r = validateDomain('not valid!');
    expect(r.isValid).toBe(false);
    expect(r.error).toBe('Invalid domain format');
  });

  test('rejects bare TLD', () => {
    const r = validateDomain('.com');
    expect(r.isValid).toBe(false);
  });
});
