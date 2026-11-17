import { describe, expect, it } from 'vitest';
import { makeConfig } from '../../test/config.js';
import { buildApp } from '../app.js';

describe('CORS', () => {
  it('allows an origin from the configured allowlist', async () => {
    const app = buildApp({
      config: makeConfig({ corsOrigins: ['https://allowed.example'] }),
      logger: false,
    });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: 'https://allowed.example' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example');
    } finally {
      await app.close();
    }
  });

  it('does not send CORS headers to a blocked origin', async () => {
    const app = buildApp({
      config: makeConfig({ corsOrigins: ['https://allowed.example'] }),
      logger: false,
    });

    try {
      const simple = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: 'https://evil.example' },
      });
      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/healthz',
        headers: {
          origin: 'https://evil.example',
          'access-control-request-method': 'GET',
        },
      });

      expect(simple.headers['access-control-allow-origin']).toBeUndefined();
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

describe('security headers', () => {
  it('sets helmet headers', async () => {
    const app = buildApp({ config: makeConfig(), logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/healthz' });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    } finally {
      await app.close();
    }
  });
});

describe('rate limiting', () => {
  it('returns 429 after the configured limit', async () => {
    const app = buildApp({
      config: makeConfig(),
      logger: false,
      rateLimit: { max: 2, timeWindow: 60_000 },
    });

    try {
      const first = await app.inject({ method: 'GET', url: '/healthz' });
      const second = await app.inject({ method: 'GET', url: '/healthz' });
      const third = await app.inject({ method: 'GET', url: '/healthz' });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(third.statusCode).toBe(429);
      expect(third.json()).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      });
    } finally {
      await app.close();
    }
  });
});
