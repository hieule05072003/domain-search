import axios from 'axios';
import { lookupDomain } from '../src/services/domain-lookup-service';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock whoiser
jest.mock('whoiser', () => ({
  whoisDomain: jest.fn(),
}));
import { whoisDomain } from 'whoiser';
const mockedWhois = whoisDomain as jest.MockedFunction<typeof whoisDomain>;

describe('lookupDomain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns taken domain via RDAP (HTTP 200)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        ldhName: 'example.com',
        status: ['active'],
        entities: [
          { roles: ['registrar'], vcardArray: [null, [['fn', {}, 'text', 'Test Registrar']]] },
        ],
        events: [
          { eventAction: 'registration', eventDate: '2000-01-01T00:00:00Z' },
          { eventAction: 'expiration', eventDate: '2030-01-01T00:00:00Z' },
        ],
        nameservers: [{ ldhName: 'ns1.example.com' }],
      },
    });

    const result = await lookupDomain('example.com');

    expect(result.available).toBe(false);
    expect(result.method).toBe('rdap');
    expect(result.details.registrar).toBe('Test Registrar');
    expect(result.details.createdDate).toBe('2000-01-01T00:00:00Z');
    expect(result.details.expiryDate).toBe('2030-01-01T00:00:00Z');
    expect(result.details.nameservers).toEqual(['ns1.example.com']);
  });

  test('returns available domain via RDAP (HTTP 404)', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 404, data: null });

    const result = await lookupDomain('available-test.com');

    expect(result.available).toBe(true);
    expect(result.method).toBe('rdap');
    expect(result.details.registrar).toBeNull();
  });

  test('falls back to WHOIS when RDAP fails', async () => {
    // RDAP fails
    mockedAxios.get.mockRejectedValueOnce(new Error('RDAP timeout'));

    // WHOIS succeeds
    mockedWhois.mockResolvedValueOnce({
      'whois.test.com': {
        'Domain Name': 'test.de',
        Registrar: 'German Registrar',
        'Created Date': '2010-05-01',
        'Registry Expiry Date': '2025-05-01',
        'Name Server': ['ns1.test.de', 'ns2.test.de'],
        'Domain Status': ['ok'],
      },
    } as any);

    const result = await lookupDomain('test.de');

    expect(result.available).toBe(false);
    expect(result.method).toBe('whois');
    expect(result.details.registrar).toBe('German Registrar');
  });

  test('returns unknown when both methods fail', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('RDAP down'));
    mockedWhois.mockRejectedValueOnce(new Error('WHOIS down'));

    const result = await lookupDomain('fail.com');

    expect(result.method).toBe('unknown');
    expect(result.error).toBeDefined();
  });

  test('never returns registrant PII', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        ldhName: 'test.com',
        status: ['active'],
        entities: [],
        events: [],
        nameservers: [],
      },
    });

    const result = await lookupDomain('test.com');
    const json = JSON.stringify(result);

    // Should not contain PII fields
    expect(json).not.toContain('email');
    expect(json).not.toContain('phone');
    expect(json).not.toContain('address');
  });
});
