import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export interface CreateDbOptions {
  /** Fail fast instead of waiting forever when the database is unreachable. */
  connectionTimeoutMillis?: number;
}

export function createDb(databaseUrl: string, options: CreateDbOptions = {}): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
  });

  return new PrismaClient({ adapter });
}
