# Metrookeh

Customs abandoned-goods (متروکه) management system.

## Current scope

Import writers through File3 (`@metrookeh/import-core`) plus RTL dashboard in `@metrookeh/web` (login, kootaj filters, review resolve/ignore, import history).

**Not included yet:** Excel upload from UI, full multi-role RBAC, AI.

## Structure

```
metrookeh/
  apps/web/                 # Next.js RTL dashboard
  packages/db/              # Drizzle schema, migrations, seeds
  packages/domain/          # Enums + domain invariants
  packages/import-core/     # Analysis + dry-run + File1/File2/File3 writers
  packages/validator/       # Approved read-only validator (unchanged golden reference)
  docs/                     # Architecture + database docs
  _analysis/                # Historical analysis only
```

## Prerequisites

- Node.js ≥ 20
- Docker (for local PostgreSQL)

## Quick start

```bash
cp .env.example .env        # set SEED_ADMIN_PASSWORD + AUTH_SECRET
docker compose up -d
npm install
npm run db:generate         # if regenerating SQL from schema
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
- xlsx (validator + import-core)
- Tailwind CSS + Vazirmatn (RTL dashboard)
