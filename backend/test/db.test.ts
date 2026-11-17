import { afterAll, describe, expect, it } from 'vitest';
import { createTestDb, resetTestDatabase } from './db.js';

describe('resetTestDatabase', () => {
  const db = createTestDb();

  afterAll(async () => {
    await db.$executeRawUnsafe('DROP TABLE IF EXISTS _reset_probe');
    await db.$disconnect();
  });

  it('empties new tables but keeps Prisma migration history', async () => {
    await db.$executeRawUnsafe(
      'CREATE TABLE _reset_probe (id integer PRIMARY KEY, value text NOT NULL)',
    );
    await db.$executeRawUnsafe("INSERT INTO _reset_probe (id, value) VALUES (1, 'row')");

    await resetTestDatabase(db);

    const probes = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM _reset_probe
    `;
    const migrations = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM _prisma_migrations
    `;

    expect(Number(probes[0]?.count)).toBe(0);
    expect(Number(migrations[0]?.count)).toBeGreaterThan(0);
  });
});
