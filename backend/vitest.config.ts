import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-db.ts'],
    // One database, so test files must not truncate each other's data.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
