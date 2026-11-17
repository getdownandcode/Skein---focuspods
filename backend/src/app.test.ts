import { afterAll, describe, expect, it } from 'vitest';
import { makeConfig } from '../test/config.js';
import { buildApp } from './app.js';
import { createDb } from './db.js';

describe('GET /healthz', () => {
  const app = buildApp({ config: makeConfig(), logger: false });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /readyz', () => {
  it('returns 200 when the database is reachable', async () => {
    const app = buildApp({ config: makeConfig(), logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/readyz' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });

  it('returns 503 when the database is unreachable', async () => {
    const db = createDb('postgresql://focuspods:focuspods@127.0.0.1:5999/focuspods_test', {
      connectionTimeoutMillis: 750,
    });
    const app = buildApp({ config: makeConfig(), db, logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/readyz' });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        error: { code: 'NOT_READY', message: 'Database is unavailable' },
      });
    } finally {
      await app.close();
    }
  });
});
