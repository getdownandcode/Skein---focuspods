import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Config } from './config.js';
import { createDb } from './db.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { getRequestId } from './lib/request-id.js';
import { registerErrorHandlers } from './plugins/errors.js';

export interface BuildAppOptions {
  config: Config;
  /** Injectable so tests can point at a real database, including an unreachable one. */
  db?: PrismaClient;
  logger?: FastifyServerOptions['logger'];
}

// Tokens and invitation secrets must never reach the logs. Fastify only needs the
// request line and address, so headers are not serialized at all.
const loggerOptions: Exclude<FastifyServerOptions['logger'], boolean | undefined> = {
  serializers: {
    req: (request) => ({
      method: request.method,
      url: request.url,
    }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.idToken',
      'req.body.accessToken',
      'req.body.refreshToken',
      'req.body.token',
      'req.body.password',
    ],
    censor: '[REDACTED]',
  },
};

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const { config } = options;
  const db = options.db ?? createDb(config.databaseUrl);
  const app = Fastify({
    logger: options.logger ?? {
      ...loggerOptions,
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
    },
    genReqId: getRequestId,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onClose', async () => {
    await db.$disconnect();
  });

  registerErrorHandlers(app);

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
