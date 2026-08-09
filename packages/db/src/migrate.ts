import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.example') });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://metrookeh:metrookeh@localhost:5432/metrookeh';

async function main() {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  console.log('Migrations complete.');

  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
