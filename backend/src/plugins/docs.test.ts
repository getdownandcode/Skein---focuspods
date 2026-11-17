import { describe, expect, it } from 'vitest';
import { makeConfig } from '../../test/config.js';
import { buildApp } from '../app.js';

describe('API docs', () => {
  it('serves Swagger UI outside production', async () => {
    const app = buildApp({ config: makeConfig({ nodeEnv: 'development' }), logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/docs' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    } finally {
      await app.close();
    }
  });

  it('publishes the routes in the OpenAPI document', async () => {
    const app = buildApp({ config: makeConfig({ nodeEnv: 'development' }), logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/docs/json' });

      expect(response.statusCode).toBe(200);
      const document = response.json();
      expect(document.paths['/healthz']).toBeDefined();
      expect(document.paths['/readyz']).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('returns the standard 404 in production', async () => {
    const app = buildApp({ config: makeConfig({ nodeEnv: 'production' }), logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/docs' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    } finally {
      await app.close();
    }
  });
});
