import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { createDb } from './db.js';
import type { PrismaClient } from './generated/prisma/client.js';

export interface BuildAppOptions {
  config: Config;
  /** Injectable so tests can point at a real database, including an unreachable one. */
  db?: PrismaClient;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const { config } = options;
  const db = options.db ?? createDb(config.databaseUrl);
  const app = Fastify({ logger: options.logger ?? true });

  app.addHook('onClose', async () => {
    await db.$disconnect();
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      request.log.error({ err: error }, 'database readiness check failed');
      return reply
        .code(503)
        .send({ error: { code: 'NOT_READY', message: 'Database is unavailable' } });
    }
  });

  return app;
}
