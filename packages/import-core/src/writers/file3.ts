/**
 * Phase 6 — File3 letter attach writer.
 * Never creates Kootajs. Attaches at most one letter per matched Kootaj.
 * Second distinct letter → review_items(LETTER_CONFLICT), never silent overwrite.
 * Persists import_batches + import_rows + letters + review + audit.
 * Does NOT run File1/File2 writers.
 */

import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { decideLetterAttach } from '@metrookeh/domain';
import {
  importBatches,
  importRows,
  kootajs,
  letters,
  reviewItems,
  auditLogs,
  type Database,
} from '@metrookeh/db';
import { readWorkbook } from '../excel.js';
import { processFile3 } from '../file3.js';
import { planFile3DryRun } from '../dry-run/plan.js';
import type {
  DryRunBatchCounters,
  DryRunPlan,
  PlannedImportRow,
} from '../dry-run/types.js';
import { mapFile3Letter } from './map-file3.js';
import type { File3ProcessedRow, File3Result, Workbook } from '../types.js';

export interface WriteFile3ImportOptions {
  db: Database['db'];
  filePath: string;
  createdBy?: string | null;
  /** Optional preloaded workbook (tests). */
  workbook?: Workbook;
  /**
   * Optional unified Kootaj set (File1 + File2 NEW).
   * Always unioned with normalized keys already in `kootajs`.
   */
  unifiedKootajSet?: Set<string> | Map<string, unknown>;
}

export interface WriteFile3ImportResult {
  batchId: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_REVIEW' | 'FAILED';
  counters: DryRunBatchCounters;
  lettersAttached: number;
  lettersSkipped: number;
  reviewCreated: number;
  kootajCreated: 0;
  domainWrites: true;
  fileType: 'FILE3';
}

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

const ROW_CHUNK = 250;
const LETTER_CHUNK = 100;
const AUDIT_CHUNK = 200;

interface ExistingLetter {
  id: string;
  letterNumber: string;
}

/**
 * Import File3 automation sheet: attach letters to existing Kootajs only.
 * One transaction: batch → rows → letters → review → audit → finalize.
 */
export async function writeFile3Import(
  options: WriteFile3ImportOptions,
): Promise<WriteFile3ImportResult> {
  const workbook = options.workbook ?? readWorkbook(options.filePath);
  if (!workbook.filePath) {
    workbook.filePath = path.resolve(options.filePath);
  }

  try {
    return await options.db.transaction(async (tx) => {
      const unifiedSet = await resolveUnifiedKootajSet(tx, options.unifiedKootajSet);
      const kootajIdByNormalized = await loadKootajIds(tx, unifiedSet);
      const existingLettersByKootajId = await loadExistingLetters(
        tx,
        [...kootajIdByNormalized.values()],
      );

      const analysis = processFile3(workbook, unifiedSet);
      const basePlan = planFile3DryRun(workbook, unifiedSet);
      const plan = applyDbAwareDispositions(
        basePlan,
        analysis,
        kootajIdByNormalized,
        existingLettersByKootajId,
      );

      // Defense: File3 must never invent parents
      for (const row of analysis.processed) {
        if (row.match_status === 'UNMATCHED' && row.normalized_kootaj) {
          if (unifiedSet.has(row.normalized_kootaj)) {
            throw new Error(
              `File3 writer: UNMATCHED row unexpectedly in unified set (${row.normalized_kootaj})`,
            );
          }
        }
      }

      const [batch] = await tx
        .insert(importBatches)
        .values({
          fileName: plan.fileName,
          fileType: 'FILE3',
          status: 'RUNNING',
          createdBy: options.createdBy ?? null,
          totalRows: 0,
          createdRecords: 0,
          skippedRecords: 0,
          reviewRecords: 0,
          errorRecords: 0,
        })
        .returning({ id: importBatches.id });

      const batchId = batch.id;
      const rowIdBySource = await insertImportRows(tx, batchId, plan);

      // --- Attach letters (chunked) ---
      const attachCandidates = collectAttachRows(analysis, plan);
      const letterValues: Array<{
        kootajId: string;
        letterNumber: string;
        letterNumberOriginal: string | null;
        letterDate: string | null;
        letterDateOriginal: string | null;
        letterDateSource: string | null;
        description: string | null;
        letterSystemId: string | null;
        registrar: string | null;
        extractionMethod: string | null;
        extractedKootajRaw: string | null;
        importBatchId: string;
        importRowId: string | null;
        attachedByUserId: string | null;
        normalizedKootaj: string;
      }> = [];

      for (const row of attachCandidates) {
        const nk = row.normalized_kootaj!;
        const kootajId = kootajIdByNormalized.get(nk);
        if (!kootajId) {
          throw new Error(`File3 writer: MATCHED Kootaj missing in DB: ${nk}`);
        }
        const mapped = mapFile3Letter(row);
        const decision = decideLetterAttach({
          kootajExists: true,
          hasValidLetterNumber: true,
          existingLetterNumber: existingLettersByKootajId.get(kootajId)?.letterNumber ?? null,
          incomingLetterNumber: mapped.letterNumber,
        });
        if (decision.action !== 'ATTACH') {
          throw new Error(
            `File3 writer: expected ATTACH for ${nk}, got ${decision.action}`,
          );
        }
        letterValues.push({
          kootajId,
          ...mapped,
          importBatchId: batchId,
          importRowId: rowIdBySource.get(row.source_row) ?? null,
          attachedByUserId: options.createdBy ?? null,
          normalizedKootaj: nk,
        });
      }

      const insertedLetters: Array<{ id: string; kootajId: string }> = [];
      for (let offset = 0; offset < letterValues.length; offset += LETTER_CHUNK) {
        const chunk = letterValues.slice(offset, offset + LETTER_CHUNK);
        const inserted = await tx
          .insert(letters)
          .values(
            chunk.map(({ normalizedKootaj: _nk, ...rest }) => rest),
          )
          .returning({ id: letters.id, kootajId: letters.kootajId });
        insertedLetters.push(...inserted);
      }
      const lettersAttached = insertedLetters.length;

      // --- Reviews ---
      const reviewRows = buildReviewRows({
        analysis,
        plan,
        batchId,
        rowIdBySource,
        kootajIdByNormalized,
        existingLettersByKootajId,
      });

      const insertedReviews =
        reviewRows.length > 0
          ? await tx.insert(reviewItems).values(reviewRows).returning({ id: reviewItems.id })
          : [];
      const reviewCreated = insertedReviews.length;

      // --- Audits ---
      const auditValues: Array<{
        actorUserId: string | null;
        action: string;
        entityType: string;
        entityId: string;
        beforeData: null;
        afterData: Record<string, unknown>;
        metadata: Record<string, unknown>;
        importBatchId: string;
      }> = [];

      for (let i = 0; i < insertedLetters.length; i++) {
        auditValues.push({
          actorUserId: options.createdBy ?? null,
          action: 'LETTER_ATTACHED',
          entityType: 'letter',
          entityId: insertedLetters[i].id,
          beforeData: null,
          afterData: {
            kootaj_id: insertedLetters[i].kootajId,
            normalized_kootaj: letterValues[i].normalizedKootaj,
            letter_number: letterValues[i].letterNumber,
          },
          metadata: { file_type: 'FILE3' },
          importBatchId: batchId,
        });
      }

      for (let i = 0; i < reviewRows.length; i++) {
        auditValues.push({
          actorUserId: options.createdBy ?? null,
          action: 'CONFLICT_DETECTED',
          entityType: 'review_item',
          entityId: insertedReviews[i].id,
          beforeData: null,
          afterData: {
            type: reviewRows[i].type,
            normalized_kootaj: reviewRows[i].normalizedKootaj,
          },
          metadata: { file_type: 'FILE3' },
          importBatchId: batchId,
        });
      }

      const lettersSkipped = plan.counters.skippedRecords;
      const counters: DryRunBatchCounters = {
        totalRows: plan.counters.totalRows,
        createdRecords: lettersAttached,
        skippedRecords: lettersSkipped,
        reviewRecords: reviewCreated,
        errorRecords: 0,
      };
      const status = reviewCreated > 0 ? 'COMPLETED_WITH_REVIEW' : 'COMPLETED';

      auditValues.push({
        actorUserId: options.createdBy ?? null,
        action: 'IMPORT_COMPLETED',
        entityType: 'import_batch',
        entityId: batchId,
        beforeData: null,
        afterData: {
          status,
          counters,
          letters_attached: lettersAttached,
          letters_skipped: lettersSkipped,
          review_created: reviewCreated,
          kootaj_created: 0,
          matched_rows: analysis.matched_rows,
          unmatched_rows: analysis.unmatched_rows,
          conflicts: analysis.conflicts_count,
        },
        metadata: { file_type: 'FILE3', phase: 6 },
        importBatchId: batchId,
      });

      for (let offset = 0; offset < auditValues.length; offset += AUDIT_CHUNK) {
        await tx.insert(auditLogs).values(auditValues.slice(offset, offset + AUDIT_CHUNK));
      }

      await tx
        .update(importBatches)
        .set({
          status,
          totalRows: counters.totalRows,
          createdRecords: counters.createdRecords,
          skippedRecords: counters.skippedRecords,
          reviewRecords: counters.reviewRecords,
          errorRecords: counters.errorRecords,
          completedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(importBatches.id, batchId));

      return {
        batchId,
        status,
        counters,
        lettersAttached,
        lettersSkipped,
        reviewCreated,
        kootajCreated: 0,
        domainWrites: true,
        fileType: 'FILE3',
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`File3 import failed: ${message}`, { cause: err });
  }
}

async function resolveUnifiedKootajSet(
  tx: Tx,
  optional?: Set<string> | Map<string, unknown>,
): Promise<Set<string>> {
  const fromDb = await tx.select({ n: kootajs.normalizedKootaj }).from(kootajs);
  const set = new Set(fromDb.map((r) => r.n));
  if (optional instanceof Set) {
    for (const key of optional) set.add(key);
  } else if (optional) {
    for (const key of optional.keys()) set.add(key);
  }
  return set;
}

async function loadKootajIds(
  tx: Tx,
  unifiedSet: Set<string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (unifiedSet.size === 0) return map;

  const keys = [...unifiedSet];
  const CHUNK = 500;
  for (let offset = 0; offset < keys.length; offset += CHUNK) {
    const chunk = keys.slice(offset, offset + CHUNK);
    const rows = await tx
      .select({ id: kootajs.id, n: kootajs.normalizedKootaj })
      .from(kootajs)
      .where(inArray(kootajs.normalizedKootaj, chunk));
    for (const row of rows) {
      map.set(row.n, row.id);
    }
  }
  return map;
}

async function loadExistingLetters(
  tx: Tx,
  kootajIds: string[],
): Promise<Map<string, ExistingLetter>> {
  const map = new Map<string, ExistingLetter>();
  if (kootajIds.length === 0) return map;

  const CHUNK = 500;
  for (let offset = 0; offset < kootajIds.length; offset += CHUNK) {
    const chunk = kootajIds.slice(offset, offset + CHUNK);
    const rows = await tx
      .select({
        id: letters.id,
        kootajId: letters.kootajId,
        letterNumber: letters.letterNumber,
      })
      .from(letters)
      .where(inArray(letters.kootajId, chunk));
    for (const row of rows) {
      map.set(row.kootajId, { id: row.id, letterNumber: row.letterNumber });
    }
  }
  return map;
}

/**
 * Adjust dry-run dispositions using DB letter state (idempotent skip / conflict).
 */
function applyDbAwareDispositions(
  basePlan: DryRunPlan,
  analysis: File3Result,
  kootajIdByNormalized: Map<string, string>,
  existingLettersByKootajId: Map<string, ExistingLetter>,
): DryRunPlan {
  const rows: PlannedImportRow[] = basePlan.rows.map((row) => ({ ...row }));
  const counters = {
    totalRows: basePlan.counters.totalRows,
    createdRecords: 0,
    skippedRecords: 0,
    reviewRecords: 0,
    errorRecords: 0,
  };

  const letterStatus = new Map<string, string | undefined>();
  for (const o of analysis.letter_outcomes) {
    letterStatus.set(String(o.normalized_kootaj), o.letter_status as string | undefined);
  }

  for (let i = 0; i < rows.length; i++) {
    const planned = rows[i];
    const processed = analysis.processed[i];

    if (
      planned.disposition === 'EXTRACTION_FAILED' ||
      planned.disposition === 'UNMATCHED' ||
      planned.disposition === 'CONFLICT'
    ) {
      counters.reviewRecords += 1;
      continue;
    }

    if (planned.disposition === 'LETTER_DRAFT_IGNORED') {
      counters.skippedRecords += 1;
      continue;
    }

    if (planned.disposition !== 'LETTER_ATTACHED') {
      continue;
    }

    const nk = processed.normalized_kootaj!;
    const kootajId = kootajIdByNormalized.get(nk);
    if (!kootajId) {
      // Analysis said MATCHED but parent missing in DB → treat as unmatched review
      rows[i] = {
        ...planned,
        disposition: 'UNMATCHED',
        processingStatus: 'PROCESSED',
        errorMessage: 'File3 never creates Kootaj — matched key missing in DB',
      };
      counters.reviewRecords += 1;
      continue;
    }

    if (letterStatus.get(nk) === 'CONFLICT') {
      counters.reviewRecords += 1;
      continue;
    }

    const decision = decideLetterAttach({
      kootajExists: true,
      hasValidLetterNumber: Boolean(processed.letter_number),
      existingLetterNumber: existingLettersByKootajId.get(kootajId)?.letterNumber ?? null,
      incomingLetterNumber: processed.letter_number,
    });

    if (decision.action === 'ATTACH') {
      counters.createdRecords += 1;
      continue;
    }

    if (decision.action === 'IDEMPOTENT_SKIP') {
      rows[i] = {
        ...planned,
        disposition: 'LETTER_DRAFT_IGNORED',
        processingStatus: 'SKIPPED',
        errorMessage: decision.reason,
      };
      counters.skippedRecords += 1;
      continue;
    }

    if (decision.action === 'CONFLICT_REVIEW') {
      rows[i] = {
        ...planned,
        disposition: 'CONFLICT',
        processingStatus: 'PROCESSED',
        errorMessage: decision.reason,
      };
      counters.reviewRecords += 1;
      continue;
    }

    rows[i] = {
      ...planned,
      disposition: 'LETTER_DRAFT_IGNORED',
      processingStatus: 'SKIPPED',
      errorMessage: decision.reason,
    };
    counters.skippedRecords += 1;
  }

  return {
    ...basePlan,
    rows,
    counters,
    finalStatus: counters.reviewRecords > 0 ? 'COMPLETED_WITH_REVIEW' : 'COMPLETED',
    summary: {
      ...basePlan.summary,
      dry_run: false,
      domain_writes: true,
      db_aware: true,
    },
  };
}

function collectAttachRows(
  analysis: File3Result,
  plan: DryRunPlan,
): File3ProcessedRow[] {
  const attachSourceRows = new Set(
    plan.rows.filter((r) => r.disposition === 'LETTER_ATTACHED').map((r) => r.sourceRowNumber),
  );
  return analysis.processed.filter((r) => attachSourceRows.has(r.source_row));
}

function buildReviewRows(input: {
  analysis: File3Result;
  plan: DryRunPlan;
  batchId: string;
  rowIdBySource: Map<number, string>;
  kootajIdByNormalized: Map<string, string>;
  existingLettersByKootajId: Map<string, ExistingLetter>;
}): Array<{
  type: 'EXTRACTION_FAILED' | 'UNMATCHED' | 'LETTER_CONFLICT';
  status: 'OPEN';
  importBatchId: string;
  importRowId: string | null;
  kootajId: string | null;
  normalizedKootaj: string | null;
  payload: Record<string, unknown>;
}> {
  const {
    analysis,
    plan,
    batchId,
    rowIdBySource,
    kootajIdByNormalized,
    existingLettersByKootajId,
  } = input;
  const reviews: Array<{
    type: 'EXTRACTION_FAILED' | 'UNMATCHED' | 'LETTER_CONFLICT';
    status: 'OPEN';
    importBatchId: string;
    importRowId: string | null;
    kootajId: string | null;
    normalizedKootaj: string | null;
    payload: Record<string, unknown>;
  }> = [];

  const seenUnmatched = new Set<string>();
  const seenConflict = new Set<string>();

  for (let i = 0; i < plan.rows.length; i++) {
    const planned = plan.rows[i];
    const processed = analysis.processed[i];

    if (planned.disposition === 'EXTRACTION_FAILED') {
      reviews.push({
        type: 'EXTRACTION_FAILED',
        status: 'OPEN',
        importBatchId: batchId,
        importRowId: rowIdBySource.get(planned.sourceRowNumber) ?? null,
        kootajId: null,
        normalizedKootaj: null,
        payload: {
          source_row: planned.sourceRowNumber,
          reason: processed.extraction.reason,
          description: processed.description,
          letter_number: processed.letter_number,
        },
      });
      continue;
    }

    if (planned.disposition === 'UNMATCHED') {
      const nk = processed.normalized_kootaj;
      if (!nk || seenUnmatched.has(nk)) continue;
      seenUnmatched.add(nk);
      reviews.push({
        type: 'UNMATCHED',
        status: 'OPEN',
        importBatchId: batchId,
        importRowId: rowIdBySource.get(planned.sourceRowNumber) ?? null,
        kootajId: null,
        normalizedKootaj: nk,
        payload: {
          source_row: planned.sourceRowNumber,
          letter_number: processed.letter_number,
          letter_system_id: processed.letter_system_id,
          rule: 'File3 never creates Kootaj',
        },
      });
      continue;
    }

    if (planned.disposition === 'CONFLICT') {
      const nk = processed.normalized_kootaj;
      if (!nk || seenConflict.has(nk)) continue;
      seenConflict.add(nk);

      const kootajId = kootajIdByNormalized.get(nk) ?? null;
      const existing = kootajId ? existingLettersByKootajId.get(kootajId) : undefined;
      const inFileConflict = analysis.conflicts.find(
        (c) => String(c.normalized_kootaj) === nk,
      );

      reviews.push({
        type: 'LETTER_CONFLICT',
        status: 'OPEN',
        importBatchId: batchId,
        importRowId: rowIdBySource.get(planned.sourceRowNumber) ?? null,
        kootajId,
        normalizedKootaj: nk,
        payload: {
          existing_letter_number: existing?.letterNumber ?? null,
          incoming_letter_number: processed.letter_number,
          in_file_candidates: inFileConflict?.candidates ?? null,
          reason: planned.errorMessage,
        },
      });
    }
  }

  return reviews;
}

async function insertImportRows(
  tx: Tx,
  batchId: string,
  plan: DryRunPlan,
): Promise<Map<number, string>> {
  const rowIdBySource = new Map<number, string>();

  for (let offset = 0; offset < plan.rows.length; offset += ROW_CHUNK) {
    const chunk = plan.rows.slice(offset, offset + ROW_CHUNK);
    const inserted = await tx
      .insert(importRows)
      .values(
        chunk.map((row) => ({
          importBatchId: batchId,
          sourceRowNumber: row.sourceRowNumber,
          rawPayload: row.rawPayload,
          normalizedKootaj: row.normalizedKootaj,
          processingStatus: row.processingStatus,
          disposition: row.disposition,
          errorMessage: row.errorMessage,
        })),
      )
      .returning({
        id: importRows.id,
        sourceRowNumber: importRows.sourceRowNumber,
      });

    for (const row of inserted) {
      rowIdBySource.set(row.sourceRowNumber, row.id);
    }
  }

  return rowIdBySource;
}
