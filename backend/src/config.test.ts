import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgresql://focuspods:focuspods@localhost:5432/focuspods_test',
  JWT_SECRET: 'a'.repeat(32),
  GOOGLE_CLIENT_IDS:
    '1234567890-one.apps.googleusercontent.com, 1234567890-two.apps.googleusercontent.com',
  CORS_ORIGINS: 'http://localhost:3000, https://app.example.com',
};

describe('loadConfig', () => {
  it('parses a valid environment', () => {
    expect(loadConfig(validEnv)).toEqual({
      nodeEnv: 'test',
      port: 4000,
      databaseUrl: 'postgresql://focuspods:focuspods@localhost:5432/focuspods_test',
      jwtSecret: 'a'.repeat(32),
      googleClientIds: [
        '1234567890-one.apps.googleusercontent.com',
        '1234567890-two.apps.googleusercontent.com',
      ],
      corsOrigins: ['http://localhost:3000', 'https://app.example.com'],
    });
  });

  it('uses defaults for NODE_ENV and PORT', () => {
    const config = loadConfig({
      ...validEnv,
      NODE_ENV: undefined,
      PORT: undefined,
    });

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
  });

  it('rejects a missing variable with a clear message', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: undefined })).toThrow(
      /Invalid environment configuration: DATABASE_URL:/,
    );
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ ...validEnv, PORT: 'not-a-port' })).toThrow(/PORT:/);
  });

  it('rejects an empty client id list', () => {
    expect(() => loadConfig({ ...validEnv, GOOGLE_CLIENT_IDS: '  ' })).toThrow(
      /GOOGLE_CLIENT_IDS:/,
    );
  });
});
