# @metrookeh/import-core — Phase 6

Ported Excel analysis from `@metrookeh/validator`, dry-run provenance, and **File1 + File2 + File3 domain writers**.

## Included

- `normalize` / `aggregate` / `file1` / `file2` / `file3`
- `runAnalysis()` — read-only File1 → File2 → File3
- Dry-run: `persistDryRun` / `runDryRunImport` / `runFullDryRunImport`
- **`writeFile1Import()`** — master create (`source_origin = FILE1`)
- **`writeFile2Import()`** — SKIP existing / CREATE NEW (`source_origin = FILE2`)
- **`writeFile3Import()`** — letter attach / unmatched / conflict (never creates Kootaj)
- **`runProductionImport()`** — File1 → File2 → File3 domain writers
- Count locks (598 / 526 / 50 / 554 / 86 / 77)

## File3 writer behavior

- **Never** creates `kootajs` parents
- MATCHED + single valid letter + no existing letter → insert `letters` (0:1)
- Same letter already attached → idempotent SKIP
- Different letter already attached → `review_items(LETTER_CONFLICT)`, no overwrite
- Multiple distinct letters in File3 for one Kootaj → `LETTER_CONFLICT`, no attach
- UNMATCHED extraction → `review_items(UNMATCHED)`
- Failed Kootaj extraction → `review_items(EXTRACTION_FAILED)`
- Draft rows (no registration number) → ignored

## Not included

- Dashboard / complete HTTP API / AI
