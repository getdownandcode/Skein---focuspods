import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('GET /healthz', () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it('returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
