/**
 * Count locks against the three real Amar Excel files.
 * Skips cleanly when source files are not discoverable.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canDiscoverSourceFiles,
  resolveSourcePaths,
  runAnalysis,
  buildCountSummary,
  compareCountLocks,
  PRIOR_ANALYSIS_EXPECTATIONS,
  getImportCoreReadiness,
  runProductionImport,
} from '../src/index.js';

describe('Phase 6 readiness', () => {
  it('reports File1 + File2 + File3 writers', () => {
    const r = getImportCoreReadiness();
    assert.equal(r.phase, 6);
    assert.equal(r.dryRunPersistImplemented, true);
    assert.equal(r.file1WriterImplemented, true);
    assert.equal(r.file2WriterImplemented, true);
    assert.equal(r.file3WriterImplemented, true);
    assert.equal(r.productionImportImplemented, true);
    assert.equal(r.domainWritesImplemented, true);
  });

  it('exposes runProductionImport for File1→File2→File3', () => {
    assert.equal(typeof runProductionImport, 'function');
  });
});

describe('Real Excel count locks', () => {
  const available = canDiscoverSourceFiles();

  it('locks prior-analysis counts (598 / 526 / 50 / 554 / 86 / 77)', async (t) => {
    if (!available) {
      t.skip('Amar آپدیت Excel sources not found');
      return;
    }

    const paths = resolveSourcePaths([]);
    const result = runAnalysis(paths);
    const summary = buildCountSummary(result);
    const discrepancies = compareCountLocks(summary);

    assert.equal(
      discrepancies.length,
      0,
      discrepancies.map((d) => `${d.metric}: expected=${d.expected} actual=${d.actual}`).join('; '),
    );

    assert.equal(summary.file1_unique_kootajs, PRIOR_ANALYSIS_EXPECTATIONS.file1_unique_kootajs);
    assert.equal(summary.file2_existing_kootajs, PRIOR_ANALYSIS_EXPECTATIONS.file2_existing_kootajs);
    assert.equal(summary.file2_new_kootajs, PRIOR_ANALYSIS_EXPECTATIONS.file2_new_kootajs);
    assert.equal(summary.file2_existing_rows, PRIOR_ANALYSIS_EXPECTATIONS.file2_existing_rows);
    assert.equal(summary.file3_physical_rows, PRIOR_ANALYSIS_EXPECTATIONS.file3_physical_rows);
    assert.equal(
      summary.file3_rows_with_registration,
      PRIOR_ANALYSIS_EXPECTATIONS.file3_rows_with_registration,
    );
    assert.equal(result.unifiedSize, 648);
  });
});
