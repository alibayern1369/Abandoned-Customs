import { config } from 'dotenv';
import path from 'node:path';
import { existsSync } from 'node:fs';

let loaded = false;

/** Load repo-root .env once (Next only auto-loads apps/web/.env*). */
export function ensureEnv(): void {
  if (loaded) return;
  loaded = true;

  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../../.env'),
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      config({ path: file, override: false });
    }
  }
}
