/** Shared import-core types. No DB / side effects. */

export type ExcelRow = Record<string, unknown> & { _source_row?: number };

export interface Workbook {
  sheetNames: string[];
  sheets: Record<string, ExcelRow[]>;
  filePath?: string;
}

export interface NormalizeKootajResult {
  original_value: string | null;
  normalized_value: string | null;
}

export interface ExtractionResult {
  original_description: string;
  extracted_raw: string | null;
  normalized_value: string | null;
  method: 'labeled_shomare_kootaj' | 'fallback_kootaj' | null;
  ok: boolean;
  reason: string | null;
}

export interface FieldValue {
  value: string;
  rule: string;
  distinct_count: number;
  distinct_values?: string[];
}

export interface ParentFieldConflict {
  field: string;
  distinct_values: string[];
}

export interface AggregateNumber {
  rule: string;
  sum?: number;
  value?: number | null;
  distinct?: string[];
  distinct_count?: number;
  row_count?: number;
  would_be_wrong_sum?: number;
  warning?: string | null;
}

export interface KootajRecord {
  normalized_kootaj: string;
  original_values: string[];
  row_count: number;
  warehouse_receipt_count: number;
  warehouse_receipts: string[];
  kootaj_level: Record<string, FieldValue> | Record<string, string>;
  items: Record<string, unknown>[];
  aggregates: Record<string, AggregateNumber>;
  parent_field_conflicts: ParentFieldConflict[];
  classification?: 'EXISTING_SKIPPED' | 'NEW' | null;
}

export interface File1Result {
  sheet: string;
  physical_rows: number;
  unique_kootajs: number;
  kootajs_with_multiple_rows: number;
  kootajs_with_multiple_warehouse_receipts: number;
  kootajs: KootajRecord[];
  kootajSet: Map<string, KootajRecord>;
}

export interface File2Result {
  sheet: string;
  physical_rows: number;
  unique_kootajs: number;
  empty_key_rows: number;
  existing_kootajs: number;
  new_kootajs: number;
  existing_rows: number;
  new_rows: number;
  duplicate_extra_rows: number;
  groups_with_multiple_rows: number;
  suspicious: Array<Record<string, unknown>>;
  existing: KootajRecord[];
  new: KootajRecord[];
}

export interface File3ProcessedRow {
  source_row: number;
  letter_system_id: string;
  description: string;
  extraction: ExtractionResult;
  normalized_kootaj: string | null;
  letter_number_original: string;
  letter_number: string | null;
  letter_date_original: string;
  letter_date: string | null;
  letter_date_source: string | null;
  has_valid_letter: boolean;
  match_status: 'EXTRACTION_FAILED' | 'MATCHED' | 'UNMATCHED';
  registrar: string;
}

export interface File3Result {
  sheet: string;
  physical_rows: number;
  successfully_extracted_kootajs_rows: number;
  failed_kootaj_extraction: number;
  unique_extracted_kootajs: number;
  rows_with_registration_number: number;
  matched_rows: number;
  unmatched_rows: number;
  matched_kootajs: number;
  unmatched_kootajs: number;
  kootajs_with_valid_letters: number;
  kootajs_with_multiple_letter_candidates: number;
  conflicts_count: number;
  kootajs_with_multiple_automation_rows: number;
  processed: File3ProcessedRow[];
  matched: File3ProcessedRow[];
  unmatched: File3ProcessedRow[];
  extraction_failed: File3ProcessedRow[];
  conflicts: Array<Record<string, unknown>>;
  valid_letters: Array<Record<string, unknown>>;
  no_letter: Array<Record<string, unknown>>;
  letter_outcomes: Array<Record<string, unknown>>;
}

export interface SourcePaths {
  file1: string;
  file2: string;
  file3: string;
  sourceDir?: string;
  outputDir: string;
}

/** Soft expectations from prior analysis — compared AFTER processing, never hardcoded into logic. */
export const PRIOR_ANALYSIS_EXPECTATIONS = {
  file1_unique_kootajs: 598,
  file2_existing_kootajs: 526,
  file2_new_kootajs: 50,
  file2_existing_rows: 554,
  file3_physical_rows: 86,
  file3_rows_with_registration: 77,
} as const;

export type PriorAnalysisExpectations = typeof PRIOR_ANALYSIS_EXPECTATIONS;
