/**
 * Persist a dry-run plan: import_batches + import_rows only.
 * Never writes kootajs / kootaj_items / letters / review_items / audit_logs.
 */

import { eq } from 'drizzle-orm';
import { importBatches, importRows, type Database } from '@metrookeh/db';
import type { DryRunPlan, DryRunPersistResult } from './types.js';

export interface PersistDryRunOptions {
  db: Database['db'];
  plan: DryRunPlan;
  createdBy?: string | null;
}

const INSERT_CHUNK = 200;

/**
 * Write one dry-run batch + all planned rows in a single transaction.
 * On failure the transaction rolls back — no partial batch remains.
 * Domain tables are never touched by this function (Phase 3 invariant).
 */
export async function persistDryRun(options: PersistDryRunOptions): Promise<DryRunPersistResult> {
  const { db, plan, createdBy = null } = options;

  return db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(importBatches)
      .values({
        fileName: plan.fileName,
        fileType: plan.fileType,
        status: 'RUNNING',
        createdBy: createdBy ?? null,
        totalRows: 0,
        createdRecords: 0,
        skippedRecords: 0,
        reviewRecords: 0,
        errorRecords: 0,
      })
      .returning({ id: importBatches.id });

    const batchId = batch.id;

    for (let offset = 0; offset < plan.rows.length; offset += INSERT_CHUNK) {
      const chunk = plan.rows.slice(offset, offset + INSERT_CHUNK);
      await tx.insert(importRows).values(
        chunk.map((row) => ({
          importBatchId: batchId,
          sourceRowNumber: row.sourceRowNumber,
          rawPayload: row.rawPayload,
          normalizedKootaj: row.normalizedKootaj,
          processingStatus: row.processingStatus,
          disposition: row.disposition,
          errorMessage: row.errorMessage,
        })),
      );
    }

    const [updated] = await tx
      .update(importBatches)
      .set({
        status: plan.finalStatus,
        totalRows: plan.counters.totalRows,
        createdRecords: plan.counters.createdRecords,
        skippedRecords: plan.counters.skippedRecords,
        reviewRecords: plan.counters.reviewRecords,
        errorRecords: plan.counters.errorRecords,
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(importBatches.id, batchId))
      .returning({
        id: importBatches.id,
        status: importBatches.status,
        totalRows: importBatches.totalRows,
        createdRecords: importBatches.createdRecords,
        skippedRecords: importBatches.skippedRecords,
        reviewRecords: importBatches.reviewRecords,
        errorRecords: importBatches.errorRecords,
      });

    return {
      batchId: updated.id,
      status: updated.status,
      counters: {
        totalRows: updated.totalRows,
        createdRecords: updated.createdRecords,
        skippedRecords: updated.skippedRecords,
        reviewRecords: updated.reviewRecords,
        errorRecords: updated.errorRecords,
      },
      rowCount: plan.rows.length,
    };
  });
}
