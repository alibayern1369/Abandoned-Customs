/**
 * Excel IO helpers.
 * Ported from @metrookeh/validator — behavior must stay identical.
 */

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import type { ExcelRow, SourcePaths, Workbook } from './types.js';

/**
 * Resolve the three source Excel paths.
 * Prefer CLI args; else discover under d:\Files\Amar\1405\*آپدیت*
 */
export function resolveSourcePaths(argv: string[] = process.argv.slice(2)): SourcePaths {
  if (argv.length >= 3) {
    return {
      file1: path.resolve(argv[0]),
      file2: path.resolve(argv[1]),
      file3: path.resolve(argv[2]),
      outputDir: path.resolve(argv[3] || path.join(process.cwd(), 'output')),
    };
  }

  const amarRoot = String.raw`d:\Files\Amar\1405`;
  const sourceDir = findSourceDir(amarRoot);
  const files = discoverFiles(sourceDir);

  return {
    file1: files.file1,
    file2: files.file2,
    file3: files.file3,
    sourceDir,
    outputDir: path.resolve(argv[0] || path.join(process.cwd(), 'output')),
  };
}

function findSourceDir(amarRoot: string): string {
  for (const name of fs.readdirSync(amarRoot)) {
    if (name.includes('آپدیت')) return path.join(amarRoot, name);
  }
  throw new Error(`Source directory not found under ${amarRoot}`);
}

function discoverFiles(dir: string): { file1: string; file2: string; file3: string } {
  const full = fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('~$'))
    .map((f) => {
      const p = path.join(dir, f);
      return { name: f, path: p, size: fs.statSync(p).size, ext: path.extname(f).toLowerCase() };
    });

  const xlsx = full.filter((f) => f.ext === '.xlsx').sort((a, b) => b.size - a.size);
  const xls = full.filter((f) => f.ext === '.xls').sort((a, b) => b.size - a.size);

  const file1 =
    full.find((f) => f.ext === '.xlsx' && f.name.includes('کیش') && f.size > 100000)?.path ||
    xlsx[0]?.path;
  const file2 =
    full.find((f) => f.ext === '.xlsx' && f.name.includes('سامانه'))?.path ||
    xlsx.find((f) => f.path !== file1)?.path;
  const file3 =
    full.find((f) => f.ext === '.xls' && f.name.includes('اتوماسیون'))?.path || xls[0]?.path;

  if (!file1 || !file2 || !file3) {
    throw new Error(`Could not discover three Excel files in ${dir}`);
  }

  return { file1, file2, file3 };
}

/** Read workbook as array-of-objects per sheet (header row 1). Read-only. */
export function readWorkbook(filePath: string): Workbook {
  const wb = XLSX.readFile(filePath, { cellDates: false, raw: false });
  return workbookFromXlsx(wb, filePath);
}

/** Read workbook from an in-memory buffer (UI upload). */
export function readWorkbookFromBuffer(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  fileName = 'upload.xlsx',
): Workbook {
  const data =
    buffer instanceof Buffer
      ? buffer
      : Buffer.from(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer);
  const wb = XLSX.read(data, { type: 'buffer', cellDates: false, raw: false });
  return workbookFromXlsx(wb, fileName);
}

function workbookFromXlsx(wb: XLSX.WorkBook, filePath: string): Workbook {
  const sheets: Record<string, ExcelRow[]> = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, {
      defval: '',
      raw: false,
      blankrows: false,
    }) as ExcelRow[];
    sheets[name] = rows;
  }
  return { sheetNames: wb.SheetNames, sheets, filePath };
}

/** Get first matching column value from a row by exact header names. */
export function getCol(row: ExcelRow, ...candidates: string[]): unknown {
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, c)) return row[c];
  }
  // Fuzzy: trim header keys
  const keys = Object.keys(row);
  for (const c of candidates) {
    const hit = keys.find((k) => k.trim() === c.trim());
    if (hit) return row[hit];
  }
  return undefined;
}

/** True when the standard Amar آپدیت source folder is present. */
export function canDiscoverSourceFiles(): boolean {
  try {
    resolveSourcePaths([]);
    return true;
  } catch {
    return false;
  }
}
