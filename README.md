# Metrookeh

Customs abandoned-goods (متروکه) management system.

## Current scope

Import writers through File3 (`@metrookeh/import-core`) plus RTL dashboard in `@metrookeh/web` (login, kootaj filters, review resolve/ignore, import history, Excel upload/export).

## Structure

```
metrookeh/
  apps/web/                 # Next.js RTL dashboard
  packages/db/              # Drizzle schema, migrations, seeds
  packages/domain/          # Enums + domain invariants
  packages/import-core/     # Analysis + dry-run + File1/File2/File3 writers
  packages/validator/       # Approved read-only validator (unchanged golden reference)
  docker/                   # Container entrypoint
  docs/                     # Architecture + database docs
  _analysis/                # Historical analysis only
```

## Prerequisites

- Docker + Docker Compose (full stack)
- Optional for local UI development: Node.js ≥ 20

## Deploy (clone → run on a server / LAN)

This is the supported way to run the app on an office server or any machine on the internal network.

```bash
git clone https://github.com/alibayern1369/Abandoned-Customs.git
cd Abandoned-Customs
cp .env.example .env
# Edit .env: set strong AUTH_SECRET, POSTGRES_PASSWORD, SEED_ADMIN_PASSWORD
docker compose up --build -d
```

Open `http://localhost:3000` on the server, or `http://<server-LAN-IP>:3000` from other PCs.

What Compose starts:

- `postgres` — PostgreSQL 16 (data in Docker volume `metrookeh_pgdata`)
- `web` — Next.js production build; on start it waits for DB, runs migrations, seeds admin if missing, then serves the app

Useful commands:

```bash
docker compose logs -f web
docker compose ps
docker compose down          # stop (keeps DB volume)
docker compose down -v       # stop AND delete DB data — destructive
```

Backup database:

```bash
docker compose exec postgres pg_dump -U metrookeh metrookeh > backup.sql
```

Update after pushing new code to GitHub:

```bash
git pull
docker compose up --build -d
```

## Local development (optional)

Postgres in Docker, Next.js on the host:

```bash
cp .env.example .env        # DATABASE_URL should use localhost
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3000
```

## Tests

```bash
npm run test:validator     # golden reference — must stay 15/15
npm run test:import-core   # analysis + dry-run + File1/File2/File3 writers
npm run test:db            # schema/constraint checks against Postgres
```

## Tech stack

- Node.js, Next.js App Router, TypeScript
- PostgreSQL + Drizzle ORM
- Docker Compose (Postgres + web)
- xlsx (validator + import-core)
- Tailwind CSS + self-hosted Vazirmatn (RTL dashboard)
