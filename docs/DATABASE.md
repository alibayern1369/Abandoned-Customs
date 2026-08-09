# Database

PostgreSQL + Drizzle ORM. No SQLite. No `warehouse_receipts` table in V1.

## Tables

| Table | Purpose |
|--------|---------|
| `users` | Minimal RBAC (`viewer`, `importer`, `reviewer`, `admin`) |
| `kootajs` | Unique parent per `normalized_kootaj` |
| `kootaj_items` | Detail/goods rows (1:N under Kootaj) |
| `letters` | At most one active letter per Kootaj (0:1) |
| `import_batches` | One row per Excel import operation |
| `import_rows` | Per physical Excel row provenance (`raw_payload`) |
| `review_items` | Deterministic exceptions queue |
| `audit_logs` | Append-only event trail |

## Relationships

```
users
  └── created_by → import_batches
        ├── 1:N → import_rows
        ├── creates → kootajs
        │              ├── 1:N → kootaj_items
        │              └── 0:1 → letters   (UNIQUE kootaj_id)
        └── creates → review_items

audit_logs (polymorphic entity_type + entity_id)
```

### Why Kootaj is the parent

One normalized identity groups all declaration-level attributes and owns items + letter. Search and matching are Kootaj-centric.

### Why items are 1:N

Physical Excel rows under one Kootaj differ by goods/tariff/weight/receipt. Parent declaration totals stay on `kootajs` and must never be SUM’d from item repetition.

### Why letters are 0:1

`UNIQUE(letters.kootaj_id)` enforces a single active letter. A different second letter becomes `LETTER_CONFLICT` in `review_items` — never silent replacement.

## Constraints

| Rule | Enforcement |
|------|-------------|
| Unique Kootaj identity | `UNIQUE(kootajs.normalized_kootaj)` |
| Items belong to parent | `kootaj_items.kootaj_id` → `kootajs.id` **ON DELETE RESTRICT** |
| Max one letter | `UNIQUE(letters.kootaj_id)` + FK **ON DELETE RESTRICT** |
| Import row provenance | `import_rows.import_batch_id` → `import_batches.id` |
| Review links | FKs to batch / row / kootaj where applicable |
| No casual Kootaj delete | RESTRICT while children exist |
| Audit immutability | Trigger rejects UPDATE/DELETE on `audit_logs` |
| Audit → batch FK | `ON DELETE RESTRICT` (SET NULL is incompatible with append-only trigger) |

### Source origin

`kootajs.source_origin` ∈ `{ FILE1, FILE2 }` only. File3 cannot create parents.

### Independent fields (not one status)

- `goods_status_text` — raw File1 lifecycle text
- `exit_text` — raw File1 exit text (no derived EXITED/NOT_EXITED yet)
- letter presence — presence/absence of `letters` row
- `source_origin` — FILE1/FILE2
- review — `review_items.status`

## Indexes (useful queries only)

| Target | Index |
|--------|--------|
| `kootajs.normalized_kootaj` | UNIQUE |
| `kootajs.source_origin` | B-tree |
| `kootajs.owner_name` | B-tree |
| `kootajs.order_registration_no` | B-tree |
| `kootaj_items.goods_description` | B-tree |
| `kootaj_items.tariff_code` | B-tree |
| `kootaj_items.warehouse_receipt_no` | B-tree |
| `kootaj_items.import_batch_id` | B-tree |
| `letters.letter_number` | B-tree |
| `letters.kootaj_id` | UNIQUE |
| `import_rows.import_batch_id` | B-tree |
| `import_rows.normalized_kootaj` | B-tree |
| `review_items (status, type)` | B-tree |
| `import_batches.created_by` | B-tree |

## Enums

| Enum | Values |
|------|--------|
| `user_role` | viewer, importer, reviewer, admin |
| `source_origin` | FILE1, FILE2 |
| `file_type` | FILE1, FILE2, FILE3 |
| `import_batch_status` | RUNNING, COMPLETED, COMPLETED_WITH_REVIEW, FAILED |
| `review_item_type` | EXTRACTION_FAILED, UNMATCHED, LETTER_CONFLICT, PARENT_FIELD_CONFLICT |
| `review_item_status` | OPEN, RESOLVED, IGNORED |

## Import batch counters

`total_rows`, `created_records`, `skipped_records`, `review_records`, `error_records`, plus `completed_at` / `error_message`.

Phase 3 dry-run fills these from **planned** dispositions only (no domain inserts). Example locks on real Amar sources: File1 `created_records=598` / `total_rows=624`; File2 `created_records=50` with `554` `SKIPPED_EXISTING` rows; File3 `total_rows=86`.

Phase 4 File1 writer sets `created_records` to unique Kootajs actually inserted (`598` on Amar File1) and writes matching `kootajs` / `kootaj_items` rows in the same transaction.

Phase 5 File2 writer sets `created_records` to NEW unique Kootajs inserted (`50` on Amar File2), `skipped_records` includes `SKIPPED_EXISTING` rows (`554`), and never overwrites existing parents.

Phase 6 File3 writer sets `created_records` to letters actually attached (0:1 per Kootaj), queues UNMATCHED / EXTRACTION_FAILED / LETTER_CONFLICT into `review_items`, and never inserts `kootajs`.

## Seed

Development admin only, via `npm run db:seed`.

- Username: `SEED_ADMIN_USERNAME` (default `admin`)
- Password: **required** `SEED_ADMIN_PASSWORD` from environment
- Never hardcode a production password

## Migrations

```bash
docker compose up -d
cp .env.example .env   # set SEED_ADMIN_PASSWORD
npm install
npm run db:migrate
npm run db:seed
npm run test:db
```

Schema source of truth for codegen: `packages/db/src/schema/`.
Generated SQL: `packages/db/src/migrations/`.
