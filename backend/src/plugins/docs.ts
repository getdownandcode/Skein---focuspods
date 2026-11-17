import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import type { Config } from '../config.js';

export function registerDocs(app: FastifyInstance, config: Config): void {
  app.register(swagger, {
    openapi: {
      info: {
        title: 'focuspods API',
        description: 'Focus pods backend API',
        version: '0.0.0',
      },
    },
    transform: jsonSchemaTransform,
  });

  if (config.nodeEnv !== 'production') {
    app.register(swaggerUi, { routePrefix: '/docs' });
  }
}
