import { afterAll, beforeAll } from 'vitest';
import { createTestDb, resetTestDatabase } from './db.js';

const db = createTestDb();

beforeAll(async () => {
  await resetTestDatabase(db);
});

afterAll(async () => {
  await db.$disconnect();
});
