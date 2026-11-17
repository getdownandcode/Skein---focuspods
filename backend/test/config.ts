import type { Config } from '../src/config.js';

export const TEST_DATABASE_URL = 'postgresql://focuspods:focuspods@localhost:5432/focuspods_test';

const defaultConfig: Config = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: TEST_DATABASE_URL,
  jwtSecret: 'test-secret-that-is-long-enough',
  googleClientIds: ['1234567890-test.apps.googleusercontent.com'],
  corsOrigins: ['http://localhost:3000'],
};

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return { ...defaultConfig, ...overrides };
}
