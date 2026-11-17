import { PassThrough } from 'node:stream';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { makeConfig } from '../../test/config.js';
import { buildApp } from '../app.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('error responses', () => {
  it('uses the standard shape for an unknown route', async () => {
    const app = buildApp({ config: makeConfig(), logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/does-not-exist' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    } finally {
      await app.close();
    }
  });

  it('uses the standard shape for a validation error', async () => {
    const app = buildApp({ config: makeConfig(), logger: false });

    const server = app.withTypeProvider<ZodTypeProvider>();

    server.get(
      '/test/validate',
      {
        schema: {
          querystring: z.object({ name: z.string() }),
        },
      },
      async (request) => ({ query: request.query }),
    );

    try {
      const response = await app.inject({ method: 'GET', url: '/test/validate' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
      });
    } finally {
      await app.close();
    }
  });

  it('hides unexpected error details in production', async () => {
    const app = buildApp({ config: makeConfig({ nodeEnv: 'production' }), logger: false });

    app.get('/test/boom', async () => {
      throw new Error('database password is hunter2');
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/test/boom' });

      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('hunter2');
      expect(response.body).not.toContain('stack');
      expect(response.json()).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    } finally {
      await app.close();
    }
  });
});

describe('request ids and logging', () => {
  it('reuses a safe incoming request id and returns it', async () => {
    const app = buildApp({ config: makeConfig(), logger: false });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { 'x-request-id': 'incoming-id_123' },
      });

      expect(response.headers['x-request-id']).toBe('incoming-id_123');
    } finally {
      await app.close();
    }
  });

  it('generates a request id when the header is missing or unsafe', async () => {
    const app = buildApp({ config: makeConfig(), logger: false });

    try {
      const missing = await app.inject({ method: 'GET', url: '/healthz' });
      const unsafe = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { 'x-request-id': 'not a safe id' },
      });

      expect(missing.headers['x-request-id']).toMatch(uuidPattern);
      expect(unsafe.headers['x-request-id']).toMatch(uuidPattern);
      expect(unsafe.headers['x-request-id']).not.toBe('not a safe id');
    } finally {
      await app.close();
    }
  });

  it('logs the request id without logging authorization headers', async () => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    const app = buildApp({
      config: makeConfig(),
      logger: {
        level: 'info',
        stream,
        serializers: {
          req: (request) => ({
            method: request.method,
            url: request.url,
          }),
        },
      },
    });

    try {
      await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { authorization: 'Bearer super-secret-token' },
      });
    } finally {
      await app.close();
    }

    expect(output).toContain('reqId');
    expect(output).not.toContain('super-secret-token');
  });
});
