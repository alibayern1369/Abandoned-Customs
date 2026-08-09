# Architecture

## Principle

Excel files are **input/output formats only**. PostgreSQL is the **source of truth**.

```
Excel files
    ↓
Import Service (FILE1 | FILE2 | FILE3)   ← Phase 2 analysis / Phase 3 dry-run persist
    ↓
Normalize / Match  ← @metrookeh/import-core (ported) / @metrookeh/validator (golden)
    ↓
Persist dry-run → import_batches + import_rows   ← Phase 3
    ↓
File1 domain writer → kootajs + kootaj_items + audit   ← Phase 4
    ↓
File2 SKIP/CREATE writer → new kootajs + items + audit   ← Phase 5
    ↓
File3 letter attach   ← Phase 6
    ↓
Application API + Dashboard (later)
    ↓
Excel Export (from DB — never from prior Excel as master)
```

## Monorepo layout

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router RTL dashboard (login, kootajs, reviews, imports) |
| `packages/db` | Drizzle schema, migrations, seeds |
| `packages/domain` | Enums, letter/File2 invariants |
| `packages/import-core` | Analysis + dry-run + File1/File2/File3 writers (Phase 6) |
| `packages/validator` | Approved read-only validator — **golden reference** |
| `docs/` | This documentation |
| `_analysis/` | Historical Excel analysis only |

## Layers

| Layer | Responsibility |
|--------|----------------|
| `domain` | Entities and invariants (1 Kootaj, 0..1 letter, File2 SKIP) |
| `import-core` | Deterministic normalize/match/aggregate; dry-run; File1/File2/File3 domain writers |
| `db` | Schema, constraints, repositories |
| `web` | Auth, queries, review actions, RTL dashboard (later) |

## Core invariants

1. One parent `kootajs` row per `normalized_kootaj` (`UNIQUE`).
2. File2 existing Kootaj → **SKIP** (no overwrite/merge).
3. File3 **never** creates a Kootaj.
4. Second distinct valid letter → `review_items` (`LETTER_CONFLICT`), never silent overwrite.
5. Kootaj with child rows cannot be casually deleted (`ON DELETE RESTRICT`).
6. Audit logs are append-only (no application UPDATE/DELETE; DB trigger blocks mutations).

## Why Kootaj is the parent

Validated Excel data shows many physical rows sharing one Kootaj identity (File1: 624 rows → 598 unique Kootajs). Matching, letters, and search are all keyed by normalized Kootaj. The parent holds declaration-level fields that must never be blindly summed across item rows.

## Why items are 1:N

Each physical Excel detail row (goods description, HS/tariff, weights, warehouse receipt number, package counts) belongs to one Kootaj. Preserving item rows allows reconstruction of the original detail and correct SUM of item-level weights/packages.

## Why letters are 0:1

Business rule confirmed by the validator: at most one active letter per Kootaj. Multiple distinct letter numbers for the same Kootaj are conflicts for human review. Draft automation rows without a registration number are ignored for letter attachment.

## Why File2 is SKIP / CREATE

File2 is a discovery source for Kootajs missing from File1. If the normalized Kootaj already exists, the entire group is skipped — File2 must not overwrite parent or item data in v1. Only NEW normalized identities create parents (`source_origin = FILE2`).

## Why File3 never creates Kootaj

File3 is an automation/letter export. Kootaj is extracted from description text. Unmatched extractions go to the review queue (`UNMATCHED`). Creating parents from letters would invent customs identities that did not come from File1/File2.

## Why Excel is not the source of truth

Excel partitions and repeated declaration totals are views/exports. Re-importing Excel as master would lose review resolutions, audit history, and letter conflict decisions. The DB stores normalized entities + raw `import_rows` provenance so every value can answer “where did this come from?”

## Status axes (independent — no mega-status)

Do **not** create a single `kootajs.status` column. Compose filters from:

| Axis | Storage |
|------|---------|
| Letter presence | join `letters` |
| Source/origin | `kootajs.source_origin` (`FILE1` \| `FILE2`) |
| Goods/lifecycle | `kootajs.goods_status_text` (raw File1) |
| Exit | `kootajs.exit_text` (raw File1; derived EXITED/NOT_EXITED deferred) |
| Review | open `review_items` |

## Tech stack

- Node.js, Next.js App Router, TypeScript
- PostgreSQL + Drizzle ORM
- `xlsx` for Excel parsing (validator + import-core)
- Tailwind CSS later for RTL UI
- Validator package remains unchanged as the golden reference

## Phase boundaries

**Phase 1:** foundation, schema, migrations, docs, tests.

**Phase 2:** port `import-core` from validator; golden + parity tests; real Excel count locks (598/526/50/554/86/77). No DB writes.

**Phase 3:** dry-run import service — persist `import_batches` + `import_rows` with planned dispositions. No domain writes.

**Phase 4:** File1 writer — `kootajs` + `kootaj_items` + `review_items` (parent conflicts) + `audit_logs`.

**Phase 5:** File2 writer — SKIP existing normalized Kootaj / CREATE NEW (`source_origin = FILE2`) + items + review/audit.

## Phase boundaries

**Phase 1–6:** foundation through File3 letter attach + production import chain.

**Dashboard (apps/web):** RTL Next.js UI with seed-admin login, independent Kootaj filters, review resolve/ignore, import history. Excel upload / full RBAC / AI still deferred.

