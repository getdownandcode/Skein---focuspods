import { execFileSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './config.js';

export default function globalSetup(): void {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
