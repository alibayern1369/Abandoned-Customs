/**
 * Phase 3 dry-run types.
 * Planned dispositions only — no domain entity writes.
 */

export type ImportRowDisposition =
  | 'CREATED_KOOTAJ'
  | 'CREATED_ITEM'
  | 'SKIPPED_EXISTING'
  | 'LETTER_ATTACHED'
  | 'LETTER_DRAFT_IGNORED'
  | 'UNMATCHED'
  | 'EXTRACTION_FAILED'
  | 'CONFLICT'
  | 'PARENT_FIELD_CONFLICT'
  | 'IGNORED_EMPTY_KEY'
  | 'ERROR'
  | 'REVIEW';

export type ImportRowProcessingStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'SKIPPED';

export type DryRunFileType = 'FILE1' | 'FILE2' | 'FILE3';

export type DryRunBatchStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_REVIEW'
  | 'FAILED';

export interface PlannedImportRow {
  sourceRowNumber: number;
  rawPayload: Record<string, unknown>;
  normalizedKootaj: string | null;
  processingStatus: ImportRowProcessingStatus;
  disposition: ImportRowDisposition;
  errorMessage: string | null;
}

export interface DryRunBatchCounters {
  totalRows: number;
  createdRecords: number;
  skippedRecords: number;
  reviewRecords: number;
  errorRecords: number;
}

export interface DryRunPlan {
  fileType: DryRunFileType;
  fileName: string;
  sheet: string;
  rows: PlannedImportRow[];
  counters: DryRunBatchCounters;
  finalStatus: Exclude<DryRunBatchStatus, 'RUNNING'>;
  summary: Record<string, unknown>;
}

export interface DryRunPersistResult {
  batchId: string;
  status: DryRunBatchStatus;
  counters: DryRunBatchCounters;
  rowCount: number;
}

export interface DryRunImportResult extends DryRunPersistResult {
  plan: DryRunPlan;
  domainWrites: false;
}
