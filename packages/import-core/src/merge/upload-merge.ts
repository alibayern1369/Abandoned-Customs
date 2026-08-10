/**
 * Upload Merge path (UI) — fill empty fields; differing values take Excel as source of truth.
 * Separate from File2 CLI SKIP behavior.
 */

import { eq, inArray } from 'drizzle-orm';
import {
  auditLogs,
  importBatches,
  kootajItems,
  kootajs,
  letters,
  mergeDrafts,
  reviewItems,
  type Database,
} from '@metrookeh/db';
import {
  decideFieldMerge,
  decideLetterAttach,
  type FieldMergeAction,
  type FieldMergeResolution,
} from '@metrookeh/domain';
import { getCol, readWorkbookFromBuffer } from '../excel.js';
import { processFile1 } from '../file1.js';
import { processFile2 } from '../file2.js';
import { processFile3 } from '../file3.js';
import { cellToString, parseAnnouncedToTamlik } from '../normalize.js';
import type { ExcelRow, KootajRecord, Workbook } from '../types.js';
import type { FileType } from '@metrookeh/domain';
import { collectFile1PhysicalGroups } from '../writers/file1-groups.js';
import { collectFile2PhysicalGroups } from '../writers/file2-groups.js';
import { mapFile1Item, mapFile1Kootaj } from '../writers/map-file1.js';
import { mapFile2Item, mapFile2Kootaj } from '../writers/map-file2.js';
import { mapFile3Letter, type File3LetterInsert } from '../writers/map-file3.js';

export const MERGEABLE_PARENT_FIELDS = [
  'displayKootaj',
  'kootajDate',
  'ownerName',
  'ownerCode',
  'brokerName',
  'brokerCode',
  'declarantName',
  'declarantCode',
  'assessmentLocation',
  'declarationStage',
  'rialValue',
  'fxValue',
  'fxCurrency',
  'fxRate',
  'customsInferredDuty',
  'tamlikDeposit',
  'goodsStatusText',
  'announcedToTamlikText',
  'exitText',
  'originCountry',
  'exportCountry',
  'tradeCountry',
  'orderRegistrationNo',
] as const;

export type MergeableParentField = (typeof MERGEABLE_PARENT_FIELDS)[number];

export const PARENT_FIELD_LABELS: Record<MergeableParentField, string> = {
  displayKootaj: 'نمایش کوتاژ',
  kootajDate: 'تاریخ کوتاژ',
  ownerName: 'مالک',
  ownerCode: 'کد مالک',
  brokerName: 'حق‌العمل‌کار',
  brokerCode: 'کد حق‌العمل‌کار',
  declarantName: 'اظهارکننده',
  declarantCode: 'کد اظهارکننده',
  assessmentLocation: 'محل ارزیابی',
  declarationStage: 'مرحله اظهار',
  rialValue: 'ارزش ریالی',
  fxValue: 'ارزش ارزی',
  fxCurrency: 'نوع ارز',
  fxRate: 'نرخ ارز',
  customsInferredDuty: 'حقوق استنباطی',
  tamlikDeposit: 'واریزی تملیکی',
  goodsStatusText: 'وضعیت کالا',
  announcedToTamlikText: 'اعلام به تملیکی',
  exitText: 'خروج',
  originCountry: 'کشور مبدأ',
  exportCountry: 'کشور صادرکننده',
  tradeCountry: 'کشور طرف معامله',
  orderRegistrationNo: 'ثبت سفارش',
};

export type FieldDiff = {
  field: MergeableParentField;
  label: string;
  existing: string | null;
  incoming: string | null;
  action: FieldMergeAction;
  /** Default resolution suggestion for UI */
  suggested: FieldMergeResolution;
};

export type MergeItemPayload = {
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
  sourceFileType: 'FILE1' | 'FILE2';
  sourceRowNumber: number;
  rawSnapshot: Record<string, unknown>;
  rowItemNo?: string | null;
};

export type MergeKootajEntry = {
  kind: 'CREATE' | 'UPDATE';
  normalizedKootaj: string;
  displayKootaj: string | null;
  existingId: string | null;
  incomingParent: Partial<Record<MergeableParentField, string | null>>;
  fields: FieldDiff[];
  items: MergeItemPayload[];
  conflictCount: number;
  fillCount: number;
};

export type MergeLetterEntry = {
  kind: 'ATTACH' | 'CONFLICT' | 'UNMATCHED' | 'SKIP';
  normalizedKootaj: string | null;
  existingKootajId: string | null;
  existingLetterNumber: string | null;
  incoming: {
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
  };
  reason: string;
};

export type MergeReport = {
  fileName: string;
  fileType: FileType;
  summary: {
    create: number;
    update: number;
    fillFields: number;
    conflictFields: number;
    lettersAttach: number;
    lettersConflict: number;
    lettersUnmatched: number;
  };
  kootajs: MergeKootajEntry[];
  letters: MergeLetterEntry[];
};

export type FieldDecision = {
  normalizedKootaj: string;
  field: MergeableParentField;
  resolution: FieldMergeResolution;
};

export type LetterDecision = {
  normalizedKootaj: string;
  resolution: 'ATTACH' | 'SKIP' | 'REVIEW';
};

function str(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
}

function parentFromMapped(
  mapped: Record<string, unknown>,
): Partial<Record<MergeableParentField, string | null>> {
  const out: Partial<Record<MergeableParentField, string | null>> = {};
  for (const field of MERGEABLE_PARENT_FIELDS) {
    if (field in mapped) {
      const raw = mapped[field];
      out[field] = raw == null ? null : String(raw);
    }
  }
  return out;
}

function existingParentSnapshot(
  row: typeof kootajs.$inferSelect,
): Partial<Record<MergeableParentField, string | null>> {
  const out: Partial<Record<MergeableParentField, string | null>> = {};
  for (const field of MERGEABLE_PARENT_FIELDS) {
    const raw = row[field as keyof typeof row];
    out[field] = raw == null ? null : String(raw);
  }
  return out;
}

function buildFieldDiffs(
  existing: Partial<Record<MergeableParentField, string | null>> | null,
  incoming: Partial<Record<MergeableParentField, string | null>>,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of MERGEABLE_PARENT_FIELDS) {
    if (!(field in incoming)) continue;
    const existingVal = existing?.[field] ?? null;
    const incomingVal = incoming[field] ?? null;
    const action = decideFieldMerge(existingVal, incomingVal);
    if (action === 'SKIP_EMPTY' || action === 'SAME') continue;
    diffs.push({
      field,
      label: PARENT_FIELD_LABELS[field],
      existing: str(existingVal),
      incoming: str(incomingVal),
      action,
      // Excel is source of truth: fill empties and overwrite differing values.
      suggested: 'TAKE',
    });
  }
  return diffs;
}

/** Detect FILE1 / FILE2 / FILE3 from sheet names and headers. */
export function detectUploadFileType(workbook: Workbook): FileType {
  if (workbook.sheetNames.includes('متروکه کلی')) return 'FILE1';

  const sheetName = workbook.sheetNames[0];
  const rows = workbook.sheets[sheetName] ?? [];
  const headers = new Set(Object.keys(rows[0] ?? {}).map((h) => h.trim()));

  if (headers.has('توضیحات') && (headers.has('شماره ثبت') || headers.has('شناسه نامه'))) {
    return 'FILE3';
  }
  if (
    headers.has('نام صاحب کالا') ||
    headers.has('شماره مجوز بارگيري') ||
    headers.has('شماره مجوز بارگیری')
  ) {
    return 'FILE2';
  }
  if (
    headers.has('وضعیت کالا') ||
    headers.has('شماره کوتاژ') ||
    headers.has('کد تعرفه') ||
    headers.has('کوتاژ')
  ) {
    return 'FILE1';
  }
  return 'FILE2';
}

function itemFromFile1(sourceRow: ExcelRow, lineNo: number): MergeItemPayload {
  const mapped = mapFile1Item(sourceRow, lineNo);
  return {
    ...mapped,
    netWeight: null,
    packageCount: null,
    packageType: null,
    manufacturerCountry: null,
    eWarehouseReceiptNo: null,
  };
}

function itemFromFile2(sourceRow: ExcelRow, lineNo: number): MergeItemPayload {
  return mapFile2Item(sourceRow, lineNo);
}

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

async function loadExistingByNormalized(
  db: Database['db'] | Tx,
  keys: string[],
): Promise<Map<string, typeof kootajs.$inferSelect>> {
  const map = new Map<string, typeof kootajs.$inferSelect>();
  if (keys.length === 0) return map;
  const chunk = 500;
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk);
    const rows = await db.select().from(kootajs).where(inArray(kootajs.normalizedKootaj, slice));
    for (const row of rows) map.set(row.normalizedKootaj, row);
  }
  return map;
}

async function loadLettersByKootajIds(
  db: Database['db'] | Tx,
  ids: string[],
): Promise<Map<string, typeof letters.$inferSelect>> {
  const map = new Map<string, typeof letters.$inferSelect>();
  if (ids.length === 0) return map;
  const rows = await db.select().from(letters).where(inArray(letters.kootajId, ids));
  for (const row of rows) map.set(row.kootajId, row);
  return map;
}

function buildEntriesFromFile1(
  workbook: Workbook,
  existingMap: Map<string, typeof kootajs.$inferSelect>,
): MergeKootajEntry[] {
  const analysis = processFile1(workbook);
  const { groups } = collectFile1PhysicalGroups(workbook);
  const entries: MergeKootajEntry[] = [];

  for (const record of analysis.kootajs) {
    const mapped = mapFile1Kootaj(record);
    const incoming = parentFromMapped(mapped as unknown as Record<string, unknown>);
    const existing = existingMap.get(record.normalized_kootaj) ?? null;
    const physical = groups.get(record.normalized_kootaj)?.rows ?? [];
    const items = physical.map((row, idx) => itemFromFile1(row, idx + 1));

    if (!existing) {
      entries.push({
        kind: 'CREATE',
        normalizedKootaj: record.normalized_kootaj,
        displayKootaj: mapped.displayKootaj,
        existingId: null,
        incomingParent: incoming,
        fields: buildFieldDiffs(null, incoming).map((f) => ({
          ...f,
          action: 'FILL',
          suggested: 'TAKE',
        })),
        items,
        conflictCount: 0,
        fillCount: Object.values(incoming).filter((v) => str(v)).length,
      });
      continue;
    }

    const fields = buildFieldDiffs(existingParentSnapshot(existing), incoming);
    entries.push({
      kind: 'UPDATE',
      normalizedKootaj: record.normalized_kootaj,
      displayKootaj: mapped.displayKootaj ?? existing.displayKootaj,
      existingId: existing.id,
      incomingParent: incoming,
      fields,
      items,
      conflictCount: fields.filter((f) => f.action === 'CONFLICT').length,
      fillCount: fields.filter((f) => f.action === 'FILL').length,
    });
  }

  return entries;
}

function buildEntriesFromFile2(
  workbook: Workbook,
  existingMap: Map<string, typeof kootajs.$inferSelect>,
  /** Precomputed records from a single processFile2 pass (avoids re-parsing large workbooks). */
  precomputedRecords?: KootajRecord[],
): MergeKootajEntry[] {
  // Empty set → treat all as "new" for analysis grouping; we decide CREATE/UPDATE ourselves.
  const records: KootajRecord[] =
    precomputedRecords ?? processFile2(workbook, new Set()).new;
  const { groups } = collectFile2PhysicalGroups(workbook);
  const entries: MergeKootajEntry[] = [];

  for (const record of records) {
    const mapped = mapFile2Kootaj(record);
    const incoming = parentFromMapped(mapped as unknown as Record<string, unknown>);
    const existing = existingMap.get(record.normalized_kootaj) ?? null;
    const physical = groups.get(record.normalized_kootaj)?.rows ?? [];
    const items = physical.map((row, idx) => itemFromFile2(row, idx + 1));

    if (!existing) {
      entries.push({
        kind: 'CREATE',
        normalizedKootaj: record.normalized_kootaj,
        displayKootaj: mapped.displayKootaj,
        existingId: null,
        incomingParent: incoming,
        fields: buildFieldDiffs(null, incoming).map((f) => ({
          ...f,
          action: 'FILL',
          suggested: 'TAKE',
        })),
        items,
        conflictCount: 0,
        fillCount: Object.values(incoming).filter((v) => str(v)).length,
      });
      continue;
    }

    const fields = buildFieldDiffs(existingParentSnapshot(existing), incoming);
    entries.push({
      kind: 'UPDATE',
      normalizedKootaj: record.normalized_kootaj,
      displayKootaj: mapped.displayKootaj ?? existing.displayKootaj,
      existingId: existing.id,
      incomingParent: incoming,
      fields,
      items,
      conflictCount: fields.filter((f) => f.action === 'CONFLICT').length,
      fillCount: fields.filter((f) => f.action === 'FILL').length,
    });
  }

  return entries;
}

function letterIncomingFromAnnounced(
  announced: string | null | undefined,
): File3LetterInsert | null {
  const parsed = parseAnnouncedToTamlik(announced);
  if (!parsed.hasValidLetterNumber || !parsed.letterNumber) return null;
  return {
    letterNumber: parsed.letterNumber,
    letterNumberOriginal: parsed.letterNumberOriginal,
    letterDate: parsed.letterDate,
    letterDateOriginal: parsed.letterDateOriginal,
    letterDateSource: parsed.letterDate ? 'announced_to_tamlik' : null,
    description: null,
    letterSystemId: null,
    registrar: null,
    extractionMethod: 'announced_to_tamlik',
    extractedKootajRaw: null,
  };
}

/**
 * Letters from File1 «تاریخ اعلام به اموال تملیکی».
 * Only year/serial (≥4-digit serial) counts as having a letter; date-only → without letter.
 * Later uploads that gain a serial ATTACH; conflicting serials → review.
 */
function buildLettersFromFile1Announced(
  entries: MergeKootajEntry[],
  existingMap: Map<string, typeof kootajs.$inferSelect>,
  letterMap: Map<string, typeof letters.$inferSelect>,
): MergeLetterEntry[] {
  const out: MergeLetterEntry[] = [];

  for (const entry of entries) {
    const incoming = letterIncomingFromAnnounced(entry.incomingParent.announcedToTamlikText);
    if (!incoming) continue;

    const existing = existingMap.get(entry.normalizedKootaj) ?? null;
    if (!existing) {
      out.push({
        kind: 'ATTACH',
        normalizedKootaj: entry.normalizedKootaj,
        existingKootajId: null,
        existingLetterNumber: null,
        incoming,
        reason: 'نامه از ستون اعلام به اموال تملیکی (کوتاژ جدید)',
      });
      continue;
    }

    const existingLetter = letterMap.get(existing.id) ?? null;
    const decision = decideLetterAttach({
      kootajExists: true,
      hasValidLetterNumber: true,
      existingLetterNumber: existingLetter?.letterNumber ?? null,
      incomingLetterNumber: incoming.letterNumber,
    });

    if (decision.action === 'ATTACH') {
      out.push({
        kind: 'ATTACH',
        normalizedKootaj: entry.normalizedKootaj,
        existingKootajId: existing.id,
        existingLetterNumber: null,
        incoming,
        reason: 'نامه از ستون اعلام به اموال تملیکی',
      });
    } else if (decision.action === 'CONFLICT_REVIEW') {
      out.push({
        kind: 'CONFLICT',
        normalizedKootaj: entry.normalizedKootaj,
        existingKootajId: existing.id,
        existingLetterNumber: existingLetter?.letterNumber ?? null,
        incoming,
        reason: decision.reason,
      });
    } else {
      out.push({
        kind: 'SKIP',
        normalizedKootaj: entry.normalizedKootaj,
        existingKootajId: existing.id,
        existingLetterNumber: existingLetter?.letterNumber ?? null,
        incoming,
        reason: decision.reason,
      });
    }
  }

  return out;
}

async function buildLetterEntries(
  workbook: Workbook,
  db: Database['db'],
): Promise<MergeLetterEntry[]> {
  const allKeys = await db.select({ normalizedKootaj: kootajs.normalizedKootaj, id: kootajs.id }).from(kootajs);
  const unified = new Set(allKeys.map((k) => k.normalizedKootaj));
  const idByKey = new Map(allKeys.map((k) => [k.normalizedKootaj, k.id]));
  const analysis = processFile3(workbook, unified);
  const letterMap = await loadLettersByKootajIds(
    db,
    [...idByKey.values()],
  );

  const entries: MergeLetterEntry[] = [];
  for (const row of analysis.processed) {
    const key = row.extraction.normalized_value;
    if (!row.letter_number) continue;

    const incoming = mapFile3Letter(row);
    if (!key || !idByKey.has(key)) {
      entries.push({
        kind: 'UNMATCHED',
        normalizedKootaj: key,
        existingKootajId: null,
        existingLetterNumber: null,
        incoming,
        reason: 'کوتاژ در سامانه یافت نشد',
      });
      continue;
    }

    const kootajId = idByKey.get(key)!;
    const existingLetter = letterMap.get(kootajId) ?? null;
    const decision = decideLetterAttach({
      kootajExists: true,
      hasValidLetterNumber: true,
      existingLetterNumber: existingLetter?.letterNumber ?? null,
      incomingLetterNumber: incoming.letterNumber,
    });

    if (decision.action === 'ATTACH') {
      entries.push({
        kind: 'ATTACH',
        normalizedKootaj: key,
        existingKootajId: kootajId,
        existingLetterNumber: null,
        incoming,
        reason: decision.reason,
      });
    } else if (decision.action === 'CONFLICT_REVIEW') {
      entries.push({
        kind: 'CONFLICT',
        normalizedKootaj: key,
        existingKootajId: kootajId,
        existingLetterNumber: existingLetter?.letterNumber ?? null,
        incoming,
        reason: decision.reason,
      });
    } else {
      entries.push({
        kind: 'SKIP',
        normalizedKootaj: key,
        existingKootajId: kootajId,
        existingLetterNumber: existingLetter?.letterNumber ?? null,
        incoming,
        reason: decision.reason,
      });
    }
  }

  return entries;
}

function summarize(entries: MergeKootajEntry[], letterEntries: MergeLetterEntry[]) {
  return {
    create: entries.filter((e) => e.kind === 'CREATE').length,
    update: entries.filter((e) => e.kind === 'UPDATE').length,
    fillFields: entries.reduce((n, e) => n + e.fillCount, 0),
    conflictFields: entries.reduce((n, e) => n + e.conflictCount, 0),
    lettersAttach: letterEntries.filter((e) => e.kind === 'ATTACH').length,
    lettersConflict: letterEntries.filter((e) => e.kind === 'CONFLICT').length,
    lettersUnmatched: letterEntries.filter((e) => e.kind === 'UNMATCHED').length,
  };
}

export async function buildMergeReportFromBuffer(options: {
  db: Database['db'];
  buffer: Buffer | Uint8Array | ArrayBuffer;
  fileName: string;
  fileType?: FileType;
}): Promise<MergeReport> {
  let workbook = readWorkbookFromBuffer(options.buffer, options.fileName);
  workbook = normalizeKootajColumnAlias(workbook);
  const fileType = options.fileType ?? detectUploadFileType(workbook);

  if (fileType === 'FILE3') {
    const letterEntries = await buildLetterEntries(workbook, options.db);
    return {
      fileName: options.fileName,
      fileType,
      summary: summarize([], letterEntries),
      kootajs: [],
      letters: letterEntries,
    };
  }

  if (fileType === 'FILE1') {
    workbook = ensureFile1MasterSheet(workbook);
  }

  let probeKeys: string[] = [];
  let file2Records: KootajRecord[] | null = null;
  if (fileType === 'FILE1') {
    probeKeys = processFile1(workbook).kootajs.map((k) => k.normalized_kootaj);
  } else {
    // One File2 pass — reuse for probe keys and entry building (avoids double parse on large files).
    file2Records = processFile2(workbook, new Set()).new;
    probeKeys = file2Records.map((k) => k.normalized_kootaj);
  }

  const existingMap = await loadExistingByNormalized(options.db, probeKeys);
  const entries =
    fileType === 'FILE1'
      ? buildEntriesFromFile1(workbook, existingMap)
      : buildEntriesFromFile2(workbook, existingMap, file2Records ?? undefined);

  let letterEntries: MergeLetterEntry[] = [];
  if (fileType === 'FILE1') {
    const letterMap = await loadLettersByKootajIds(
      options.db,
      [...existingMap.values()].map((row) => row.id),
    );
    letterEntries = buildLettersFromFile1Announced(entries, existingMap, letterMap);
  }

  return {
    fileName: options.fileName,
    fileType,
    summary: summarize(entries, letterEntries),
    kootajs: entries,
    letters: letterEntries,
  };
}

/** Map generic «کوتاژ» header onto File1/File2 expected column names. */
function normalizeKootajColumnAlias(workbook: Workbook): Workbook {
  const sheets: Record<string, ExcelRow[]> = {};
  for (const name of workbook.sheetNames) {
    sheets[name] = (workbook.sheets[name] ?? []).map((row) => {
      const next = { ...row };
      const generic = getCol(row, 'کوتاژ');
      if (generic != null && cellToString(generic) !== '') {
        if (getCol(row, 'شماره کوتاژ') == null || cellToString(getCol(row, 'شماره کوتاژ')) === '') {
          next['شماره کوتاژ'] = generic;
        }
        if (
          getCol(row, 'شماره مجوز بارگيري') == null &&
          getCol(row, 'شماره مجوز بارگیری') == null
        ) {
          next['شماره مجوز بارگيري'] = generic;
        }
      }
      return next;
    });
  }
  return { ...workbook, sheets };
}

function ensureFile1MasterSheet(workbook: Workbook): Workbook {
  if (workbook.sheets['متروکه کلی']) return workbook;
  const first = workbook.sheetNames[0];
  if (!first || !workbook.sheets[first]) {
    throw new Error('فایل اکسل شیت معتبری ندارد');
  }
  return {
    ...workbook,
    sheetNames: ['متروکه کلی', ...workbook.sheetNames.filter((n) => n !== 'متروکه کلی')],
    sheets: { ...workbook.sheets, 'متروکه کلی': workbook.sheets[first] },
  };
}

export async function createMergeDraft(options: {
  db: Database['db'];
  report: MergeReport;
  createdBy?: string | null;
}): Promise<{ draftId: string }> {
  const [row] = await options.db
    .insert(mergeDrafts)
    .values({
      fileName: options.report.fileName,
      fileType: options.report.fileType,
      status: 'AWAITING_RESOLUTION',
      createdBy: options.createdBy ?? null,
      report: options.report,
    })
    .returning({ id: mergeDrafts.id });
  return { draftId: row.id };
}

export async function getMergeDraft(
  db: Database['db'],
  draftId: string,
): Promise<(typeof mergeDrafts.$inferSelect) | null> {
  const [row] = await db.select().from(mergeDrafts).where(eq(mergeDrafts.id, draftId)).limit(1);
  return row ?? null;
}

function resolveParentPatch(
  entry: MergeKootajEntry,
  decisions: Map<string, FieldMergeResolution>,
): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const diff of entry.fields) {
    const key = `${entry.normalizedKootaj}::${diff.field}`;
    const resolution = decisions.get(key) ?? diff.suggested;
    if (resolution === 'TAKE') {
      patch[diff.field] = diff.incoming;
    }
    // KEEP / SKIP → leave DB as-is
  }
  return patch;
}

async function insertItems(
  tx: Tx,
  kootajId: string,
  batchId: string,
  items: MergeItemPayload[],
  existingReceipts: Set<string>,
  isNewKootaj: boolean,
) {
  const toInsert = items.filter((item) => {
    if (isNewKootaj) return true;
    const receipt = (item.warehouseReceiptNo || item.eWarehouseReceiptNo || '').trim();
    if (!receipt) return false;
    if (existingReceipts.has(receipt)) return false;
    existingReceipts.add(receipt);
    return true;
  });

  if (toInsert.length === 0) return 0;

  await tx.insert(kootajItems).values(
    toInsert.map((item) => ({
      kootajId,
      lineNo: item.lineNo,
      rowItemNo: item.rowItemNo ?? null,
      tariffCode: item.tariffCode,
      goodsDescription: item.goodsDescription,
      grossWeight: item.grossWeight,
      netWeight: item.netWeight,
      packageCount: item.packageCount,
      packageType: item.packageType,
      manufacturerCountry: item.manufacturerCountry,
      warehouseReceiptNo: item.warehouseReceiptNo,
      eWarehouseReceiptNo: item.eWarehouseReceiptNo,
      sourceFileType: item.sourceFileType,
      sourceRowNumber: item.sourceRowNumber,
      importBatchId: batchId,
      rawSnapshot: item.rawSnapshot,
    })),
  );
  return toInsert.length;
}

export async function applyMergeDecisions(options: {
  db: Database['db'];
  draftId: string;
  fieldDecisions: FieldDecision[];
  letterDecisions?: LetterDecision[];
  createdBy?: string | null;
}): Promise<{
  batchId: string;
  created: number;
  updated: number;
  itemsCreated: number;
  updatedKootajs: string[];
}> {
  const draft = await getMergeDraft(options.db, options.draftId);
  if (!draft) throw new Error('پیش‌نویس ادغام یافت نشد');
  if (draft.status !== 'AWAITING_RESOLUTION') throw new Error('این پیش‌نویس قبلاً اعمال یا لغو شده است');

  const report = draft.report as MergeReport;
  const decisionMap = new Map<string, FieldMergeResolution>();
  for (const d of options.fieldDecisions) {
    decisionMap.set(`${d.normalizedKootaj}::${d.field}`, d.resolution);
  }
  const letterDecisionMap = new Map<string, LetterDecision['resolution']>();
  for (const d of options.letterDecisions ?? []) {
    letterDecisionMap.set(d.normalizedKootaj, d.resolution);
  }

  return await options.db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(importBatches)
      .values({
        fileName: report.fileName,
        fileType: report.fileType,
        status: 'RUNNING',
        createdBy: options.createdBy ?? null,
        totalRows: report.kootajs.length + report.letters.length,
      })
      .returning({ id: importBatches.id });
    const batchId = batch.id;

    let created = 0;
    let updated = 0;
    let itemsCreated = 0;
    let reviewCreated = 0;
    const updatedKootajs: string[] = [];
    const createdIdByKey = new Map<string, string>();

    for (const entry of report.kootajs) {
      if (entry.kind === 'CREATE') {
        const parentValues: Record<string, unknown> = {
          normalizedKootaj: entry.normalizedKootaj,
          displayKootaj: entry.displayKootaj,
          sourceOrigin: report.fileType === 'FILE1' ? 'FILE1' : 'FILE2',
          createdImportBatchId: batchId,
          createdByUserId: options.createdBy ?? null,
        };
        for (const [field, value] of Object.entries(entry.incomingParent)) {
          parentValues[field] = value;
        }

        const [inserted] = await tx
          .insert(kootajs)
          .values(parentValues as typeof kootajs.$inferInsert)
          .returning({ id: kootajs.id });

        createdIdByKey.set(entry.normalizedKootaj, inserted.id);
        itemsCreated += await insertItems(tx, inserted.id, batchId, entry.items, new Set(), true);
        created += 1;

        await tx.insert(auditLogs).values({
          actorUserId: options.createdBy ?? null,
          action: 'KOOTAJ_CREATE_UPLOAD_MERGE',
          entityType: 'kootaj',
          entityId: inserted.id,
          afterData: { normalizedKootaj: entry.normalizedKootaj },
          importBatchId: batchId,
        });
        continue;
      }

      if (!entry.existingId) continue;
      const patch = resolveParentPatch(entry, decisionMap);
      if (Object.keys(patch).length > 0) {
        await tx
          .update(kootajs)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(kootajs.id, entry.existingId));
        updated += 1;
        updatedKootajs.push(entry.displayKootaj || entry.normalizedKootaj);

        await tx.insert(auditLogs).values({
          actorUserId: options.createdBy ?? null,
          action: 'KOOTAJ_MERGE_UPLOAD',
          entityType: 'kootaj',
          entityId: entry.existingId,
          afterData: patch,
          metadata: { normalizedKootaj: entry.normalizedKootaj },
          importBatchId: batchId,
        });
      }

      const existingItems = await tx
        .select({
          warehouseReceiptNo: kootajItems.warehouseReceiptNo,
          eWarehouseReceiptNo: kootajItems.eWarehouseReceiptNo,
        })
        .from(kootajItems)
        .where(eq(kootajItems.kootajId, entry.existingId));
      const receipts = new Set(
        existingItems
          .flatMap((i) => [i.warehouseReceiptNo, i.eWarehouseReceiptNo])
          .filter((v): v is string => Boolean(v && v.trim())),
      );
      itemsCreated += await insertItems(tx, entry.existingId, batchId, entry.items, receipts, false);
    }

    for (const letterEntry of report.letters) {
      const resolvedKootajId =
        letterEntry.existingKootajId ??
        (letterEntry.normalizedKootaj
          ? (createdIdByKey.get(letterEntry.normalizedKootaj) ?? null)
          : null);

      if (letterEntry.kind === 'ATTACH' && resolvedKootajId) {
        const resolution = letterDecisionMap.get(letterEntry.normalizedKootaj ?? '') ?? 'ATTACH';
        if (resolution === 'SKIP') continue;
        await tx.insert(letters).values({
          kootajId: resolvedKootajId,
          ...letterEntry.incoming,
          importBatchId: batchId,
          attachedByUserId: options.createdBy ?? null,
        });
        await tx.insert(auditLogs).values({
          actorUserId: options.createdBy ?? null,
          action: 'LETTER_ATTACH_UPLOAD',
          entityType: 'letter',
          entityId: resolvedKootajId,
          afterData: letterEntry.incoming,
          importBatchId: batchId,
        });
      } else if (letterEntry.kind === 'CONFLICT' && letterEntry.existingKootajId) {
        const resolution = letterDecisionMap.get(letterEntry.normalizedKootaj ?? '') ?? 'REVIEW';
        if (resolution === 'SKIP') continue;
        if (resolution === 'ATTACH') {
          // Do not overwrite — always review for letter conflicts per domain rule
        }
        await tx.insert(reviewItems).values({
          type: 'LETTER_CONFLICT',
          status: 'OPEN',
          kootajId: letterEntry.existingKootajId,
          normalizedKootaj: letterEntry.normalizedKootaj,
          importBatchId: batchId,
          payload: {
            existingLetterNumber: letterEntry.existingLetterNumber,
            incoming: letterEntry.incoming,
            reason: letterEntry.reason,
          },
        });
        reviewCreated += 1;
      } else if (letterEntry.kind === 'UNMATCHED') {
        await tx.insert(reviewItems).values({
          type: 'UNMATCHED',
          status: 'OPEN',
          kootajId: null,
          normalizedKootaj: letterEntry.normalizedKootaj,
          importBatchId: batchId,
          payload: {
            normalizedKootaj: letterEntry.normalizedKootaj,
            incoming: letterEntry.incoming,
          },
        });
        reviewCreated += 1;
      }
    }

    const status = reviewCreated > 0 ? 'COMPLETED_WITH_REVIEW' : 'COMPLETED';
    await tx
      .update(importBatches)
      .set({
        status,
        createdRecords: created,
        skippedRecords: 0,
        reviewRecords: reviewCreated,
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));

    await tx
      .update(mergeDrafts)
      .set({
        status: 'APPLIED',
        appliedAt: new Date(),
        importBatchId: batchId,
      })
      .where(eq(mergeDrafts.id, options.draftId));

    return { batchId, created, updated, itemsCreated, updatedKootajs };
  });
}

export function cellHint(row: ExcelRow): string {
  return cellToString(getCol(row, 'کوتاژ', 'شماره کوتاژ', 'شماره مجوز بارگيري', 'شماره مجوز بارگیری'));
}
