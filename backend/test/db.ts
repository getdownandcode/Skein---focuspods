import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createDb } from '../src/db.js';
import { TEST_DATABASE_URL } from './config.js';

export function createTestDb(options: { connectionTimeoutMillis?: number } = {}): PrismaClient {
  return createDb(TEST_DATABASE_URL, options);
}

/**
 * Empties the test database between test files. New tables are picked up from the
 * catalog automatically, so this keeps working as models are added. Prisma's
 * migration bookkeeping table is left alone.
 */
export async function resetTestDatabase(db: PrismaClient): Promise<void> {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    return;
  }

  const targetList = tables
    .map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`)
    .join(', ');

  await db.$executeRawUnsafe(`TRUNCATE TABLE ${targetList} RESTART IDENTITY CASCADE`);
}
