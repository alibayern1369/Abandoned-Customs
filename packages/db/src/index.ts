import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  // Neon / serverless poolers do not support prepared statements.
  const isServerless =
    process.env.VERCEL === '1' ||
    /neon\.tech/i.test(connectionString) ||
    /-pooler\./i.test(connectionString);

  const client = postgres(connectionString, {
    max: isServerless ? 1 : 10,
    prepare: !isServerless,
    ssl: isServerless || /sslmode=require/i.test(connectionString) ? 'require' : undefined,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export * from './schema/index.js';
export { hashPassword, verifyPassword } from './password.js';
