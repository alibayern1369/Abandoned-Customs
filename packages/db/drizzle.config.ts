import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://metrookeh:metrookeh@localhost:5432/metrookeh';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
