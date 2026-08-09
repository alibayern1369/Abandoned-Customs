# @metrookeh/web

Next.js App Router RTL dashboard for Metrookeh.

## Features

- Login with seed admin user
- Dashboard summary counters
- Kootaj list with independent filters (origin, letter, exit text, open review, search)
- Kootaj detail (parent fields, letter, items, related reviews)
- Review queue with RESOLVED / IGNORED actions
- Import batch history

## Dev

From repo root (Postgres only in Docker, Next on the host):

```bash
cp .env.example .env   # set DATABASE_URL, SEED_ADMIN_PASSWORD, AUTH_SECRET
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

For full Docker (web + Postgres), see the root README: `docker compose up --build -d`.

Open http://localhost:3000 and sign in with the seeded admin.
