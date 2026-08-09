/**
 * Dry-run import orchestration (Phase 3).
 * Persists import_batches + import_rows only — no domain writes.
 */

import path from 'node:path';
import type { Database } from '@metrookeh/db';
import { readWorkbook } from '../excel.js';
import { processFile1 } from '../file1.js';
import { processFile2 } from '../file2.js';
import { buildUnifiedSet } from '../pipeline.js';
import { planFile1DryRun, planFile2DryRun, planFile3DryRun } from './plan.js';
import { persistDryRun } from './persist.js';
import type { DryRunFileType, DryRunImportResult, DryRunPlan } from './types.js';

export type {
  PlannedImportRow,
  DryRunPlan,
  DryRunImportResult,
  DryRunPersistResult,
  DryRunFileType,
  DryRunBatchCounters,
  DryRunBatchStatus,
  ImportRowDisposition,
  ImportRowProcessingStatus,
} from './types.js';

export type { PersistDryRunOptions } from './persist.js';
export { persistDryRun } from './persist.js';
export {
  planFile1DryRun,
  planFile2DryRun,
  planFile3DryRun,
  planDryRun,
  planFullDryRun,
} from './plan.js';

export interface RunDryRunImportOptions {
  db: Database['db'];
  fileType: DryRunFileType;
  filePath: string;
  createdBy?: string | null;
  /** Required for FILE2 */
  file1KootajSet?: Map<string, unknown> | Set<string>;
  /** Required for FILE3 */
  unifiedKootajSet?: Set<string> | Map<string, unknown>;
}

/** Run a single-file dry-run import (plan + persist). */
export async function runDryRunImport(
  options: RunDryRunImportOptions,
): Promise<DryRunImportResult> {
  const workbook = readWorkbook(options.filePath);
  if (!workbook.filePath) workbook.filePath = path.resolve(options.filePath);

  let plan: DryRunPlan;
  if (options.fileType === 'FILE1') {
    plan = planFile1DryRun(workbook);
  } else if (options.fileType === 'FILE2') {
    if (!options.file1KootajSet) {
      throw new Error('runDryRunImport(FILE2) requires file1KootajSet');
    }
    plan = planFile2DryRun(workbook, options.file1KootajSet);
  } else {
    if (!options.unifiedKootajSet) {
      throw new Error('runDryRunImport(FILE3) requires unifiedKootajSet');
    }
    plan = planFile3DryRun(workbook, options.unifiedKootajSet);
  }

  const persisted = await persistDryRun({
    db: options.db,
    plan,
    createdBy: options.createdBy ?? null,
  });

  return { ...persisted, plan, domainWrites: false };
}

export interface RunFullDryRunImportOptions {
  db: Database['db'];
  file1Path: string;
  file2Path: string;
  file3Path: string;
  createdBy?: string | null;
}

export interface FullDryRunImportResult {
  file1: DryRunImportResult;
  file2: DryRunImportResult;
  file3: DryRunImportResult;
  domainWrites: false;
}

/**
 * Dry-run File1 → File2 → File3 in order, sharing analysis context.
 * Three batches; zero domain entity writes.
 */
export async function runFullDryRunImport(
  options: RunFullDryRunImportOptions,
): Promise<FullDryRunImportResult> {
  const wb1 = readWorkbook(options.file1Path);
  const wb2 = readWorkbook(options.file2Path);
  const wb3 = readWorkbook(options.file3Path);

  const f1 = processFile1(wb1);
  const f2 = processFile2(wb2, f1.kootajSet);
  const unified = buildUnifiedSet(f1, f2);

  const plan1 = planFile1DryRun(wb1);
  const plan2 = planFile2DryRun(wb2, f1.kootajSet);
  const plan3 = planFile3DryRun(wb3, unified);

  const file1 = {
    ...(await persistDryRun({
      db: options.db,
      plan: plan1,
      createdBy: options.createdBy ?? null,
    })),
    plan: plan1,
    domainWrites: false as const,
  };
  const file2 = {
    ...(await persistDryRun({
      db: options.db,
      plan: plan2,
      createdBy: options.createdBy ?? null,
    })),
    plan: plan2,
    domainWrites: false as const,
  };
  const file3 = {
    ...(await persistDryRun({
      db: options.db,
      plan: plan3,
      createdBy: options.createdBy ?? null,
    })),
    plan: plan3,
    domainWrites: false as const,
  };

  return { file1, file2, file3, domainWrites: false };
}
