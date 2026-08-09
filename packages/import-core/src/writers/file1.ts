/**
 * Phase 4 — File1 domain writer.
 * Persists import_batches + import_rows + kootajs + kootaj_items + review (conflicts) + audit.
 * Does NOT run File2/File3 writers.
 */

import path from 'node:path';
import { eq } from 'drizzle-orm';
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
import { processFile1 } from '../file1.js';
import { planFile1DryRun } from '../dry-run/plan.js';
import type { DryRunBatchCounters, DryRunPlan } from '../dry-run/types.js';
import { collectFile1PhysicalGroups } from './file1-groups.js';
import { mapFile1Item, mapFile1Kootaj } from './map-file1.js';
import type { Workbook } from '../types.js';

export interface WriteFile1ImportOptions {
  db: Database['db'];
  filePath: string;
  createdBy?: string | null;
  /** Optional preloaded workbook (tests). */
  workbook?: Workbook;
}

export interface WriteFile1ImportResult {
  batchId: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_REVIEW' | 'FAILED';
  counters: DryRunBatchCounters;
  kootajCreated: number;
  itemsCreated: number;
  reviewCreated: number;
  domainWrites: true;
  fileType: 'FILE1';
}

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

const ROW_CHUNK = 250;
const KOOTAJ_CHUNK = 100;
const ITEM_CHUNK = 250;
const AUDIT_CHUNK = 200;

/**
 * Import File1 master sheet into domain tables (seed / master create).
 * One transaction: batch → rows → kootajs/items → review → audit → finalize.
 */
export async function writeFile1Import(
  options: WriteFile1ImportOptions,
): Promise<WriteFile1ImportResult> {
  const workbook = options.workbook ?? readWorkbook(options.filePath);
  if (!workbook.filePath) {
    workbook.filePath = path.resolve(options.filePath);
  }

  const analysis = processFile1(workbook);
  const plan = planFile1DryRun(workbook);
  const { groups } = collectFile1PhysicalGroups(workbook);

  try {
    return await options.db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(importBatches)
        .values({
          fileName: plan.fileName,
          fileType: 'FILE1',
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

      // --- Parents (chunked) ---
      const parentPayloads = analysis.kootajs.map((record) => ({
        record,
        mapped: mapFile1Kootaj(record),
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

      // --- Items (chunked) ---
      const allItems: Array<{
        kootajId: string;
        lineNo: number;
        rowItemNo: string | null;
        tariffCode: string | null;
        goodsDescription: string | null;
        grossWeight: string | null;
        warehouseReceiptNo: string | null;
        sourceFileType: 'FILE1';
        sourceRowNumber: number;
        rawSnapshot: Record<string, unknown>;
        importBatchId: string;
        importRowId: string | null;
      }> = [];

      for (const record of analysis.kootajs) {
        const kootajId = kootajIdByNormalized.get(record.normalized_kootaj);
        const physical = groups.get(record.normalized_kootaj);
        if (!kootajId || !physical || physical.rows.length === 0) {
          throw new Error(
            `File1 writer: missing physical rows for Kootaj ${record.normalized_kootaj}`,
          );
        }

        physical.rows.forEach((row, idx) => {
          const item = mapFile1Item(row, idx + 1);
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

      // --- Parent-field conflict reviews ---
      const conflictRecords = analysis.kootajs.filter((k) => k.parent_field_conflicts.length > 0);
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

      for (const record of analysis.kootajs) {
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
            source_origin: 'FILE1',
            item_count: physical.rows.length,
            has_parent_field_conflict: record.parent_field_conflicts.length > 0,
          },
          metadata: { file_type: 'FILE1' },
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
          metadata: { file_type: 'FILE1' },
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
          items_created: itemsCreated,
          review_created: reviewCreated,
          unique_kootajs_analysis: analysis.unique_kootajs,
        },
        metadata: { file_type: 'FILE1', phase: 4 },
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
        itemsCreated,
        reviewCreated,
        domainWrites: true,
        fileType: 'FILE1',
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`File1 import failed: ${message}`, { cause: err });
  }
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
