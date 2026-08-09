import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { createDb, hashPassword } from './index.js';
import { users } from './schema/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.example') });


async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgresql://metrookeh:metrookeh@localhost:5432/metrookeh';
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? 'Administrator';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    console.error(
      'SEED_ADMIN_PASSWORD is required. Set it in .env (never hardcode a production password).',
    );
    process.exit(1);
  }

  if (password === 'change-me-in-dev') {
    console.warn(
      'Warning: using example SEED_ADMIN_PASSWORD. Change it before any shared environment.',
    );
  }

  const { db, client } = createDb(databaseUrl);

  try {
    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      console.log(`Seed skipped: user "${username}" already exists (${existing[0].id}).`);
      return;
    }

    const [created] = await db
      .insert(users)
      .values({
        username,
        displayName,
        role: 'admin',
        isActive: true,
        passwordHash: hashPassword(password),
      })
      .returning({ id: users.id, username: users.username, role: users.role });

    // Fingerprint only — never log the password
    const fingerprint = createHash('sha256').update(password).digest('hex').slice(0, 8);
    console.log(
      `Seeded development admin user: ${created.username} (${created.id}), role=${created.role}, pwd_fp=${fingerprint}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
