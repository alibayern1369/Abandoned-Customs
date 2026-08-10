/** Shared domain enums and invariants. No import/persistence side effects. */

export const USER_ROLES = ['viewer', 'importer', 'reviewer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SOURCE_ORIGINS = ['FILE1', 'FILE2'] as const;
export type SourceOrigin = (typeof SOURCE_ORIGINS)[number];

export const FILE_TYPES = ['FILE1', 'FILE2', 'FILE3'] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const IMPORT_BATCH_STATUSES = [
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_REVIEW',
  'FAILED',
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const REVIEW_ITEM_TYPES = [
  'EXTRACTION_FAILED',
  'UNMATCHED',
  'LETTER_CONFLICT',
  'PARENT_FIELD_CONFLICT',
] as const;
export type ReviewItemType = (typeof REVIEW_ITEM_TYPES)[number];

export const REVIEW_ITEM_STATUSES = ['OPEN', 'RESOLVED', 'IGNORED'] as const;
export type ReviewItemStatus = (typeof REVIEW_ITEM_STATUSES)[number];

/** Independent status axes — never collapse into one Kootaj.status column. */
export const STATUS_AXES = [
  'letter_presence',
  'source_origin',
  'goods_lifecycle_text',
  'exit_text_raw',
  'review_queue',
] as const;
export type StatusAxis = (typeof STATUS_AXES)[number];

export interface LetterAttachDecision {
  action: 'ATTACH' | 'IDEMPOTENT_SKIP' | 'CONFLICT_REVIEW' | 'UNMATCHED_REVIEW' | 'DRAFT_IGNORE';
  reason: string;
}

/**
 * File3 letter rule (domain-level): never silent-replace a different letter.
 *
 * File1 column «تاریخ خروج کالا  از گمرک توسط اموال تملیکی»:
 * - empty / «…خارج نشده است» → NOT_EXITED
 * - any other non-empty value (date/ref) → EXITED
 */
export function isExited(exitText: string | null | undefined): boolean {
  const text = (exitText ?? '').trim();
  if (!text) return false;
  if (text.includes('خارج نشده')) return false;
  return true;
}

export function decideLetterAttach(input: {
  kootajExists: boolean;
  hasValidLetterNumber: boolean;
  existingLetterNumber: string | null;
  incomingLetterNumber: string | null;
}): LetterAttachDecision {
  if (!input.kootajExists) {
    return { action: 'UNMATCHED_REVIEW', reason: 'File3 never creates Kootaj' };
  }
  if (!input.hasValidLetterNumber || !input.incomingLetterNumber) {
    return { action: 'DRAFT_IGNORE', reason: 'No valid letter registration number' };
  }
  if (!input.existingLetterNumber) {
    return { action: 'ATTACH', reason: 'First valid letter for Kootaj' };
  }
  if (input.existingLetterNumber === input.incomingLetterNumber) {
    return { action: 'IDEMPOTENT_SKIP', reason: 'Same letter already attached' };
  }
  return {
    action: 'CONFLICT_REVIEW',
    reason: 'Different letter already attached — do not overwrite',
  };
}

/** File2 rule: existing normalized Kootaj → SKIP; missing → CREATE. */
export function decideFile2Action(exists: boolean): 'SKIP' | 'CREATE' {
  return exists ? 'SKIP' : 'CREATE';
}

/** Upload-merge field outcomes (UI path — separate from File2 SKIP). */
export const FIELD_MERGE_ACTIONS = ['FILL', 'SAME', 'CONFLICT', 'SKIP_EMPTY'] as const;
export type FieldMergeAction = (typeof FIELD_MERGE_ACTIONS)[number];

export const FIELD_MERGE_RESOLUTIONS = ['KEEP', 'TAKE', 'SKIP'] as const;
export type FieldMergeResolution = (typeof FIELD_MERGE_RESOLUTIONS)[number];

function normalizeFieldValue(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/**
 * Compare one parent field for upload merge.
 * EMPTY DB + incoming → FILL; both equal → SAME; both non-empty and different → CONFLICT.
 * UI upload path treats CONFLICT as Excel-wins (auto TAKE); letters stay separate.
 */
export function decideFieldMerge(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): FieldMergeAction {
  const a = normalizeFieldValue(existing);
  const b = normalizeFieldValue(incoming);
  if (b === '') return 'SKIP_EMPTY';
  if (a === '') return 'FILL';
  if (a === b) return 'SAME';
  return 'CONFLICT';
}
