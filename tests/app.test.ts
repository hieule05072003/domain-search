import request from 'supertest';

// Mock whoiser to avoid ESM import issues in Jest
jest.mock('whoiser', () => ({
  whoisDomain: jest.fn().mockResolvedValue({}),
}));

import app from '../src/app';

describe('App smoke tests', () => {
  test('GET / returns 200 with HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Tìm Kiếm Tên Miền');
  });

  test('GET /health returns ok JSON', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/check without domain returns 400', async () => {
    const res = await request(app).get('/api/check');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('GET /api/suggest without domain returns 400', async () => {
    const res = await request(app).get('/api/suggest');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
