import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from './config.js';
import { createDb } from './db.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { getRequestId } from './lib/request-id.js';
import { registerDocs } from './plugins/docs.js';
import { errorResponseSchema, registerErrorHandlers } from './plugins/errors.js';
import { defaultRateLimit, registerSecurity, type RateLimitOptions } from './plugins/security.js';

const statusSchema = z.object({ status: z.literal('ok') });

export interface BuildAppOptions {
  config: Config;
  /** Injectable so tests can point at a real database, including an unreachable one. */
  db?: PrismaClient;
  logger?: FastifyServerOptions['logger'];
  /** Tests lower this so the 429 path does not wait a minute. */
  rateLimit?: RateLimitOptions;
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

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandlers(app);
  registerSecurity(app, config, options.rateLimit ?? defaultRateLimit);
  registerDocs(app, config);

  // Routes are registered after the security and docs plugins so their hooks apply.
  app.register(async (instance) => {
    const server = instance.withTypeProvider<ZodTypeProvider>();

    server.get(
      '/healthz',
      {
        schema: {
          tags: ['ops'],
          summary: 'Liveness probe',
          response: { 200: statusSchema },
        },
      },
      async () => ({ status: 'ok' as const }),
    );

    server.get(
      '/readyz',
      {
        schema: {
          tags: ['ops'],
          summary: 'Readiness probe',
          response: { 200: statusSchema, 503: errorResponseSchema },
        },
      },
      async (request, reply) => {
        try {
          await db.$queryRaw`SELECT 1`;
          return { status: 'ok' as const };
        } catch (error) {
          request.log.error({ err: error }, 'database readiness check failed');
          return reply
            .code(503)
            .send({ error: { code: 'NOT_READY', message: 'Database is unavailable' } });
        }
      },
    );
  });

  return app;
}
