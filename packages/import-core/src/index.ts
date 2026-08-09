/**
 * @metrookeh/import-core — Phase 6
 *
 * Ported matching from @metrookeh/validator + dry-run provenance + File1/File2/File3 domain writers.
 * Validator remains the golden reference and must stay 15/15.
 *
 * Phase 4: writeFile1Import → kootajs + kootaj_items + review (conflicts) + audit.
 * Phase 5: writeFile2Import → SKIP existing / CREATE NEW (source_origin=FILE2).
 * Phase 6: writeFile3Import → letter attach / unmatched / conflict review (never creates Kootaj).
 */

import type { Database } from '@metrookeh/db';
import {
  writeFile1Import,
  writeFile2Import,
  writeFile3Import,
  type WriteFile1ImportResult,
  type WriteFile2ImportResult,
  type WriteFile3ImportResult,
} from './writers/index.js';

export {
  FILE_TYPES,
  decideFile2Action,
  decideLetterAttach,
  type FileType,
} from '@metrookeh/domain';

export const IMPORT_CORE_PHASE = 6 as const;

export interface ImportCoreReadiness {
  phase: typeof IMPORT_CORE_PHASE;
  dryRunPersistImplemented: true;
  file1WriterImplemented: true;
  file2WriterImplemented: true;
  file3WriterImplemented: true;
  productionImportImplemented: true;
  domainWritesImplemented: true;
  validatorPackage: '@metrookeh/validator';
  note: string;
}

export function getImportCoreReadiness(): ImportCoreReadiness {
  return {
    phase: IMPORT_CORE_PHASE,
    dryRunPersistImplemented: true,
    file1WriterImplemented: true,
    file2WriterImplemented: true,
    file3WriterImplemented: true,
    productionImportImplemented: true,
    domainWritesImplemented: true,
    validatorPackage: '@metrookeh/validator',
    note: 'Phase 6: File1 + File2 + File3 domain writers. Dashboard / complete API / AI deferred.',
  };
}

export interface RunProductionImportOptions {
  db: Database['db'];
  file1Path: string;
  file2Path: string;
  file3Path: string;
  createdBy?: string | null;
}

export interface RunProductionImportResult {
  file1: WriteFile1ImportResult;
  file2: WriteFile2ImportResult;
  file3: WriteFile3ImportResult;
  domainWrites: true;
}

/**
 * Full production import: File1 → File2 → File3 domain writers in order.
 */
export async function runProductionImport(
  options: RunProductionImportOptions,
): Promise<RunProductionImportResult> {
  const file1 = await writeFile1Import({
    db: options.db,
    filePath: options.file1Path,
    createdBy: options.createdBy,
  });
  const file2 = await writeFile2Import({
    db: options.db,
    filePath: options.file2Path,
    createdBy: options.createdBy,
  });
  const file3 = await writeFile3Import({
    db: options.db,
    filePath: options.file3Path,
    createdBy: options.createdBy,
  });

  return { file1, file2, file3, domainWrites: true };
}

export {
  foldDigits,
  normalizeKootaj,
  kootajEquals,
  normalizeNumber,
  normalizeLetterNumber,
  normalizeLetterDate,
  isLetterRegistrationNumber,
  parseAnnouncedToTamlik,
  extractKootajFromDescription,
  cellToString,
  type AnnouncedToTamlikParse,
} from './normalize.js';

export {
  buildKootajLevel,
  buildItemDetails,
  computeSafeAggregates,
  FILE1_FIELDS,
  FILE2_FIELDS,
  NEVER_SUM_FIELDS,
  SUMMABLE_ITEM_FIELDS,
} from './aggregate.js';

export {
  resolveSourcePaths,
  readWorkbook,
  readWorkbookFromBuffer,
  getCol,
  canDiscoverSourceFiles,
} from './excel.js';

export { processFile1 } from './file1.js';
export { processFile2 } from './file2.js';
export { processFile3 } from './file3.js';

export {
  runAnalysis,
  buildUnifiedSet,
  buildCountSummary,
  compareCountLocks,
  type AnalysisResult,
  type CountSummary,
  type CountDiscrepancy,
} from './pipeline.js';

export {
  planFile1DryRun,
  planFile2DryRun,
  planFile3DryRun,
  planDryRun,
  planFullDryRun,
  persistDryRun,
  runDryRunImport,
  runFullDryRunImport,
  type PlannedImportRow,
  type DryRunPlan,
  type DryRunImportResult,
  type FullDryRunImportResult,
  type DryRunPersistResult,
  type DryRunFileType,
  type DryRunBatchCounters,
  type RunDryRunImportOptions,
  type RunFullDryRunImportOptions,
  type PersistDryRunOptions,
} from './dry-run/index.js';

export {
  writeFile1Import,
  mapFile1Kootaj,
  mapFile1Item,
  collectFile1PhysicalGroups,
  writeFile2Import,
  mapFile2Kootaj,
  mapFile2Item,
  collectFile2PhysicalGroups,
  writeFile3Import,
  mapFile3Letter,
  type WriteFile1ImportOptions,
  type WriteFile1ImportResult,
  type File1KootajInsert,
  type File1ItemInsert,
  type WriteFile2ImportOptions,
  type WriteFile2ImportResult,
  type File2KootajInsert,
  type File2ItemInsert,
  type WriteFile3ImportOptions,
  type WriteFile3ImportResult,
  type File3LetterInsert,
} from './writers/index.js';

export {
  decideFieldMerge,
  type FieldMergeAction,
  type FieldMergeResolution,
} from '@metrookeh/domain';

export {
  buildMergeReportFromBuffer,
  createMergeDraft,
  getMergeDraft,
  applyMergeDecisions,
  detectUploadFileType,
  MERGEABLE_PARENT_FIELDS,
  PARENT_FIELD_LABELS,
  type MergeReport,
  type MergeKootajEntry,
  type MergeLetterEntry,
  type FieldDiff,
  type FieldDecision,
  type LetterDecision,
  type MergeableParentField,
} from './merge/upload-merge.js';

export {
  PRIOR_ANALYSIS_EXPECTATIONS,
  type ExcelRow,
  type Workbook,
  type File1Result,
  type File2Result,
  type File3Result,
  type File3ProcessedRow,
  type KootajRecord,
  type SourcePaths,
  type PriorAnalysisExpectations,
} from './types.js';
