import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env automatically. Node can do it for local commands.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// The CLI only needs a URL to connect for migrate commands. The app itself still
// fails fast when DATABASE_URL is missing (see src/config.ts).
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://focuspods:focuspods@localhost:5432/focuspods';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
