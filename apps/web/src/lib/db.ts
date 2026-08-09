import { createDb, type Database } from '@metrookeh/db';
import { ensureEnv } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __metrookehDb: Database | undefined;
}

export function getDb(): Database['db'] {
  ensureEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  if (!globalThis.__metrookehDb) {
    globalThis.__metrookehDb = createDb(url);
  }

  return globalThis.__metrookehDb.db;
}
