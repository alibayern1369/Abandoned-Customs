#!/bin/sh
set -eu

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-metrookeh}"
POSTGRES_DB="${POSTGRES_DB:-metrookeh}"

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "AUTH_SECRET is required. Set it in .env before starting." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

echo "Waiting for Postgres at ${POSTGRES_HOST}..."
i=0
until pg_isready -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "Postgres did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done
echo "Postgres is ready."

echo "Running migrations..."
cd /app/db-tools
./node_modules/.bin/tsx src/migrate.ts

if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "Running seed (skips if admin already exists)..."
  ./node_modules/.bin/tsx src/seed.ts
else
  echo "SEED_ADMIN_PASSWORD not set — skipping seed."
fi

cd /app
echo "Starting Next.js on 0.0.0.0:${PORT:-3000}..."
exec node apps/web/server.js
