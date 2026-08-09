/**
 * Phase 5 — File2 domain writer.
 * SKIP existing normalized Kootajs (no overwrite). CREATE only NEW parents + items.
 * Persists import_batches + import_rows + kootajs + kootaj_items + review (conflicts) + audit.
 * Does NOT run File1/File3 writers.
 */

import path from 'node:path';
import { eq } from 'drizzle-orm';
import { decideFile2Action } from '@metrookeh/domain';
import {
  importBatches,
  importRows,
  kootajs,
  kootajItems,
  reviewItems,
  auditLogs,
  type Database,
} from '@metrookeh/db';
import { readWorkbook } from '../excel.js';
import { processFile2 } from '../file2.js';
import { planFile2DryRun } from '../dry-run/plan.js';
import type { DryRunBatchCounters, DryRunPlan } from '../dry-run/types.js';
import { collectFile2PhysicalGroups } from './file2-groups.js';
import { mapFile2Item, mapFile2Kootaj } from './map-file2.js';
import type { Workbook } from '../types.js';

export interface WriteFile2ImportOptions {
  db: Database['db'];
  filePath: string;
  createdBy?: string | null;
  /** Optional preloaded workbook (tests). */
  workbook?: Workbook;
  /**
   * Optional existing Kootaj set (e.g. from File1 analysis).
   * Always unioned with normalized keys already in `kootajs`.
   */
  existingKootajSet?: Set<string> | Map<string, unknown>;
}

export interface WriteFile2ImportResult {
  batchId: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_REVIEW' | 'FAILED';
  counters: DryRunBatchCounters;
  kootajCreated: number;
  kootajSkipped: number;
  itemsCreated: number;
  reviewCreated: number;
  domainWrites: true;
  fileType: 'FILE2';
}

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

const ROW_CHUNK = 250;
const KOOTAJ_CHUNK = 100;
const ITEM_CHUNK = 250;
const AUDIT_CHUNK = 200;

/**
 * Import File2 discovery sheet: SKIP known Kootajs, CREATE only NEW ones.
 * One transaction: batch → rows → new kootajs/items → review → audit → finalize.
 */
export async function writeFile2Import(
  options: WriteFile2ImportOptions,
): Promise<WriteFile2ImportResult> {
  const workbook = options.workbook ?? readWorkbook(options.filePath);
  if (!workbook.filePath) {
    workbook.filePath = path.resolve(options.filePath);
  }

  try {
    return await options.db.transaction(async (tx) => {
      const existingSet = await resolveExistingKootajSet(tx, options.existingKootajSet);

      const analysis = processFile2(workbook, existingSet);
      const plan = planFile2DryRun(workbook, existingSet);
      const { groups } = collectFile2PhysicalGroups(workbook);

      // Defense: classification must match domain rule
      for (const record of analysis.existing) {
        if (decideFile2Action(true) !== 'SKIP') {
          throw new Error('File2 writer: domain SKIP rule violated');
        }
        if (record.classification !== 'EXISTING_SKIPPED') {
          throw new Error(`File2 writer: expected EXISTING_SKIPPED for ${record.normalized_kootaj}`);
        }
      }
      for (const record of analysis.new) {
        if (decideFile2Action(false) !== 'CREATE') {
          throw new Error('File2 writer: domain CREATE rule violated');
        }
        if (existingSet.has(record.normalized_kootaj)) {
          throw new Error(
            `File2 writer: refused CREATE for existing Kootaj ${record.normalized_kootaj}`,
          );
        }
      }

      const [batch] = await tx
        .insert(importBatches)
        .values({
          fileName: plan.fileName,
          fileType: 'FILE2',
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

      // --- NEW parents only (chunked) ---
      const parentPayloads = analysis.new.map((record) => ({
        record,
        mapped: mapFile2Kootaj(record),
      }));

      const kootajIdByNormalized = new Map<string, string>();
      for (let offset = 0; offset < parentPayloads.length; offset += KOOTAJ_CHUNK) {
        const chunk = parentPayloads.slice(offset, offset + KOOTAJ_CHUNK);
        const inserted = await tx
          .insert(kootajs)
          .values(
            chunk.map(({ mapped }) => ({
              ...mapped,
              createdImportBatchId: batchId,
              createdByUserId: options.createdBy ?? null,
            })),
          )
          .returning({ id: kootajs.id, normalizedKootaj: kootajs.normalizedKootaj });

        for (const row of inserted) {
          kootajIdByNormalized.set(row.normalizedKootaj, row.id);
        }
      }

      const kootajCreated = kootajIdByNormalized.size;
      const kootajSkipped = analysis.existing_kootajs;

      // --- Items for NEW only (chunked) ---
      const allItems: Array<{
        kootajId: string;
        lineNo: number;
        tariffCode: string | null;
        goodsDescription: string | null;
        grossWeight: string | null;
        netWeight: string | null;
        packageCount: string | null;
        packageType: string | null;
        manufacturerCountry: string | null;
        warehouseReceiptNo: string | null;
        eWarehouseReceiptNo: string | null;
        sourceFileType: 'FILE2';
        sourceRowNumber: number;
        rawSnapshot: Record<string, unknown>;
        importBatchId: string;
        importRowId: string | null;
      }> = [];

      for (const record of analysis.new) {
        const kootajId = kootajIdByNormalized.get(record.normalized_kootaj);
        const physical = groups.get(record.normalized_kootaj);
        if (!kootajId || !physical || physical.rows.length === 0) {
          throw new Error(
            `File2 writer: missing physical rows for NEW Kootaj ${record.normalized_kootaj}`,
          );
        }

        physical.rows.forEach((row, idx) => {
          const item = mapFile2Item(row, idx + 1);
          allItems.push({
            kootajId,
            ...item,
            importBatchId: batchId,
            importRowId: rowIdBySource.get(item.sourceRowNumber) ?? null,
          });
        });
      }

      for (let offset = 0; offset < allItems.length; offset += ITEM_CHUNK) {
        await tx.insert(kootajItems).values(allItems.slice(offset, offset + ITEM_CHUNK));
      }
      const itemsCreated = allItems.length;

      // --- Parent-field conflict reviews (NEW only) ---
      const conflictRecords = analysis.new.filter((k) => k.parent_field_conflicts.length > 0);
      const reviewRows: Array<{
        type: 'PARENT_FIELD_CONFLICT';
        status: 'OPEN';
        importBatchId: string;
        importRowId: string | null;
        kootajId: string;
        normalizedKootaj: string;
        payload: Record<string, unknown>;
      }> = [];

      for (const record of conflictRecords) {
        const kootajId = kootajIdByNormalized.get(record.normalized_kootaj)!;
        const physical = groups.get(record.normalized_kootaj)!;
        const firstSourceRow = Number(physical.rows[0]._source_row);
        reviewRows.push({
          type: 'PARENT_FIELD_CONFLICT',
          status: 'OPEN',
          importBatchId: batchId,
          importRowId: rowIdBySource.get(firstSourceRow) ?? null,
          kootajId,
          normalizedKootaj: record.normalized_kootaj,
          payload: {
            conflicts: record.parent_field_conflicts,
            rule: 'KEEP_FIRST',
            source: 'FILE2',
          },
        });
      }

      const insertedReviews =
        reviewRows.length > 0
          ? await tx.insert(reviewItems).values(reviewRows).returning({ id: reviewItems.id })
          : [];
      const reviewCreated = insertedReviews.length;

      // --- Audits (chunked) ---
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

      for (const record of analysis.new) {
        const kootajId = kootajIdByNormalized.get(record.normalized_kootaj)!;
        const physical = groups.get(record.normalized_kootaj)!;
        auditValues.push({
          actorUserId: options.createdBy ?? null,
          action: 'KOOTAJ_CREATED',
          entityType: 'kootaj',
          entityId: kootajId,
          beforeData: null,
          afterData: {
            normalized_kootaj: record.normalized_kootaj,
            source_origin: 'FILE2',
            item_count: physical.rows.length,
            has_parent_field_conflict: record.parent_field_conflicts.length > 0,
          },
          metadata: { file_type: 'FILE2' },
          importBatchId: batchId,
        });
      }

      for (let i = 0; i < conflictRecords.length; i++) {
        auditValues.push({
          actorUserId: options.createdBy ?? null,
          action: 'CONFLICT_DETECTED',
          entityType: 'review_item',
          entityId: insertedReviews[i].id,
          beforeData: null,
          afterData: {
            type: 'PARENT_FIELD_CONFLICT',
            normalized_kootaj: conflictRecords[i].normalized_kootaj,
            conflict_count: conflictRecords[i].parent_field_conflicts.length,
          },
          metadata: { file_type: 'FILE2' },
          importBatchId: batchId,
        });
      }

      const counters: DryRunBatchCounters = {
        totalRows: plan.counters.totalRows,
        createdRecords: kootajCreated,
        skippedRecords: plan.counters.skippedRecords,
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
          kootaj_created: kootajCreated,
          kootaj_skipped: kootajSkipped,
          items_created: itemsCreated,
          review_created: reviewCreated,
          existing_kootajs_analysis: analysis.existing_kootajs,
          new_kootajs_analysis: analysis.new_kootajs,
        },
        metadata: { file_type: 'FILE2', phase: 5 },
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
        kootajCreated,
        kootajSkipped,
        itemsCreated,
        reviewCreated,
        domainWrites: true,
        fileType: 'FILE2',
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`File2 import failed: ${message}`, { cause: err });
  }
}

async function resolveExistingKootajSet(
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
