import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';

export interface RateLimitOptions {
  max: number;
  timeWindow: number;
}

export const defaultRateLimit: RateLimitOptions = {
  max: 100,
  timeWindow: 60_000,
};

export function registerSecurity(
  app: FastifyInstance,
  config: Config,
  options: RateLimitOptions = defaultRateLimit,
): void {
  app.register(helmet);
  app.register(cors, { origin: config.corsOrigins });
  app.register(rateLimit, { max: options.max, timeWindow: options.timeWindow });
}
