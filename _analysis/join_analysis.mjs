import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const outDir = String.raw`D:\نرم افزار متروکه\_analysis`;
const amarRoot = String.raw`d:\Files\Amar\1405`;

function findSourceDir() {
  for (const name of fs.readdirSync(amarRoot)) {
    if (name.includes('آپدیت')) return path.join(amarRoot, name);
  }
  throw new Error('source dir not found');
}
function findFiles(dir) {
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('~$'));
  const full = files.map((f) => {
    const p = path.join(dir, f);
    return { name: f, path: p, size: fs.statSync(p).size, ext: path.extname(f).toLowerCase() };
  });
  const xlsx = full.filter((f) => f.ext === '.xlsx').sort((a, b) => b.size - a.size);
  const xls = full.filter((f) => f.ext === '.xls');
  return {
    file1: full.find((f) => f.ext === '.xlsx' && f.name.includes('کیش') && f.size > 100000)?.path || xlsx[0].path,
    file2: full.find((f) => f.ext === '.xlsx' && f.name.includes('سامانه'))?.path,
    file3: full.find((f) => f.ext === '.xls' && f.name.includes('اتوماسیون'))?.path || xls[0].path,
  };
}
function cellStr(v) {
  if (v == null) return '';
  return String(v).trim();
}
function normDigits(s) {
  return String(s ?? '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - '٠'.charCodeAt(0)));
}
function normKootaj(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  let s = normDigits(String(v)).trim().replace(/[^\d]/g, '');
  if (!s) return '';
  if (/^0+$/.test(s)) return '0';
  return s.replace(/^0+/, '');
}
function normDateTime(v) {
  const s = normDigits(cellStr(v));
  // extract yyyy/m/d h:m:s-ish into comparable key
  const m = s.match(/(\d{3,4})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return s.replace(/\s+/g, ' ');
  const pad = (x) => String(Number(x)).padStart(2, '0');
  return `${m[1]}/${pad(m[2])}/${pad(m[3])} ${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`;
}
function normWh(v) {
  return normKootaj(v); // mostly numeric; keep alnum stripped digits+letters?
}
function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = normDigits(String(v)).replace(/,/g, '').replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
function readWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
  return wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
    if (!rows.length) return { name, headers: [], data: [] };
    const headers = (rows[0] || []).map((h, i) => (h == null || String(h).trim() === '' ? `BLANK_${i + 1}` : String(h).trim()));
    const data = [];
    for (let r = 1; r < rows.length; r++) {
      const arr = rows[r] || [];
      const obj = { _sheet: name };
      let empty = true;
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = arr[c] ?? null;
        if (arr[c] != null && String(arr[c]).trim() !== '') empty = false;
      }
      if (!empty) data.push(obj);
    }
    return { name, headers, data };
  });
}

const lines = [];
const W = (s = '') => lines.push(s);
const files = findFiles(findSourceDir());

const f1 = readWorkbook(files.file1);
const sheet1 = f1.find((s) => s.name.includes('کلی')) || f1[0];
const all1 = sheet1.data; // master sheet only to avoid partition duplicates
const f2 = readWorkbook(files.file2)[0].data;
const f3 = readWorkbook(files.file3)[0].data;

W('=== FILE2 vs FILE1 JOIN ANALYSIS (master sheet only) ===');
W(`F1_master_rows=${all1.length}`);
W(`F2_rows=${f2.length}`);

// Build F1 indexes
const byWh = new Map();
const byDate = new Map();
const byWhDate = new Map();
const byWhDateWeightTariff = new Map();
for (const r of all1) {
  const k = normKootaj(r['شماره کوتاژ']);
  const wh = cellStr(r['شماره قبض انبار']);
  const dt = normDateTime(r['تاریخ کوتاژ']);
  const w = String(toNum(r['وزن ناخالص']) ?? '');
  const t = cellStr(r['کد تعرفه']);
  const rial = String(toNum(r['ارزش ریالی کالا']) ?? '');
  if (!byWh.has(wh)) byWh.set(wh, new Set());
  byWh.get(wh).add(k);
  if (!byDate.has(dt)) byDate.set(dt, new Set());
  byDate.get(dt).add(k);
  const wd = `${wh}||${dt}`;
  if (!byWhDate.has(wd)) byWhDate.set(wd, new Set());
  byWhDate.get(wd).add(k);
  const key = `${wh}||${dt}||${w}||${t}`;
  if (!byWhDateWeightTariff.has(key)) byWhDateWeightTariff.set(key, []);
  byWhDateWeightTariff.get(key).push({ k, desc: cellStr(r['شرح کالا']), rial });
}

let whUnique = 0, whMulti = 0, whNone = 0;
let dateUnique = 0, dateMulti = 0, dateNone = 0;
let whDateUnique = 0, whDateMulti = 0, whDateNone = 0;
let rowMatchUnique = 0, rowMatchMulti = 0, rowMatchNone = 0;
let rialSameWhenMatched = 0, rialDifferWhenMatched = 0;
const noneExamples = [];
const multiExamples = [];
const successExamples = [];

// Also check شماره مجوز بارگيري uniqueness vs kootaj-like
const licenseVals = new Map();
for (const r of f2) {
  const lic = normKootaj(r['شماره مجوز بارگيري']);
  if (!lic) continue;
  if (!licenseVals.has(lic)) licenseVals.set(lic, 0);
  licenseVals.set(lic, licenseVals.get(lic) + 1);
}
const licenseInF1 = [...licenseVals.keys()].filter((x) => all1.some((r) => normKootaj(r['شماره کوتاژ']) === x));
W(`LICENSE_as_kootaj_overlap|uniqueLicenses=${licenseVals.size}|overlapWithF1Kootaj=${licenseInF1.length}|examples=${licenseInF1.slice(0, 10).join(',')}`);

for (const r of f2) {
  const wh = cellStr(r['شماره قبض انبار']);
  const dt = normDateTime(r['زمان کوتاژ']);
  const w = String(toNum(r['وزن ناخالص']) ?? '');
  const t = cellStr(r['کد اچ اس کالا']);
  const name = cellStr(r['نام کالا']);
  const rial = String(toNum(r['ارزش ریالی اظهارنامه']) ?? '');

  const sWh = byWh.get(wh) || new Set();
  if (sWh.size === 0) whNone++;
  else if (sWh.size === 1) whUnique++;
  else whMulti++;

  const sDt = byDate.get(dt) || new Set();
  if (sDt.size === 0) dateNone++;
  else if (sDt.size === 1) dateUnique++;
  else dateMulti++;

  const sWd = byWhDate.get(`${wh}||${dt}`) || new Set();
  if (sWd.size === 0) whDateNone++;
  else if (sWd.size === 1) whDateUnique++;
  else {
    whDateMulti++;
    if (multiExamples.length < 10) multiExamples.push({ wh, dt, kootajs: [...sWd].join(','), name });
  }

  const hits = byWhDateWeightTariff.get(`${wh}||${dt}||${w}||${t}`) || [];
  if (hits.length === 0) {
    rowMatchNone++;
    if (noneExamples.length < 15) noneExamples.push({ wh, dt, w, t, name, rial });
  } else if (hits.length === 1 || new Set(hits.map((h) => h.k)).size === 1) {
    rowMatchUnique++;
    const k = hits[0].k;
    const f1rial = hits[0].rial;
    if (f1rial === rial) rialSameWhenMatched++;
    else rialDifferWhenMatched++;
    if (successExamples.length < 10) successExamples.push({ k, wh, dt, name, f2rial: rial, f1rial });
  } else {
    rowMatchMulti++;
  }
}

W(`JOIN_WH|unique=${whUnique}|multi=${whMulti}|none=${whNone}`);
W(`JOIN_DATE|unique=${dateUnique}|multi=${dateMulti}|none=${dateNone}`);
W(`JOIN_WH+DATE|unique=${whDateUnique}|multi=${whDateMulti}|none=${whDateNone}`);
W(`JOIN_WH+DATE+WEIGHT+HS|unique=${rowMatchUnique}|multi=${rowMatchMulti}|none=${rowMatchNone}`);
W(`RIAL_WHEN_ROW_MATCHED|same=${rialSameWhenMatched}|differ=${rialDifferWhenMatched}`);
W('SUCCESS_EX');
successExamples.forEach((e) => W(`  ${JSON.stringify(e)}`));
W('NONE_EX');
noneExamples.forEach((e) => W(`  ${JSON.stringify(e)}`));
W('MULTI_WHDATE_EX');
multiExamples.forEach((e) => W(`  ${JSON.stringify(e)}`));

// How many F2 rows correspond to F1 kootajs via wh+date
const f2KootajsViaJoin = new Set();
const f2OnlyGroups = new Map();
for (const r of f2) {
  const wh = cellStr(r['شماره قبض انبار']);
  const dt = normDateTime(r['زمان کوتاژ']);
  const sWd = byWhDate.get(`${wh}||${dt}`) || new Set();
  if (sWd.size === 1) {
    f2KootajsViaJoin.add([...sWd][0]);
  } else if (sWd.size === 0) {
    const key = `${wh}||${dt}`;
    if (!f2OnlyGroups.has(key)) f2OnlyGroups.set(key, []);
    f2OnlyGroups.get(key).push(r);
  }
}
W(`F2_KOOTAJ_RESOLVED_VIA_WH_DATE=${f2KootajsViaJoin.size}`);
W(`F2_UNRESOLVED_GROUPS=${f2OnlyGroups.size}`);
// sample unresolved
let i = 0;
for (const [key, rows] of f2OnlyGroups) {
  if (i++ >= 15) break;
  const r = rows[0];
  W(`  UNRES|${key}|rows=${rows.length}|owner=${cellStr(r['نام صاحب کالا'])}|goods=${cellStr(r['نام کالا'])}|rial=${cellStr(r['ارزش ریالی اظهارنامه'])}|lic=${cellStr(r['شماره مجوز بارگيري'])}`);
}

// Check if F1 dates normalize equal to F2 زمان کوتاژ for known overlaps
let dateExact = 0, dateFail = 0;
const f1ByK = new Map();
for (const r of all1) {
  const k = normKootaj(r['شماره کوتاژ']);
  if (!f1ByK.has(k)) f1ByK.set(k, r);
}
// Compare for kootajs present in both via wh join
for (const k of f2KootajsViaJoin) {
  const f1r = f1ByK.get(k);
  // find an f2 row with same wh
  const wh = cellStr(f1r['شماره قبض انبار']);
  const f2r = f2.find((r) => cellStr(r['شماره قبض انبار']) === wh);
  if (!f2r) continue;
  if (normDateTime(f1r['تاریخ کوتاژ']) === normDateTime(f2r['زمان کوتاژ'])) dateExact++;
  else {
    dateFail++;
    if (dateFail <= 5) W(`DATE_MISMATCH|k=${k}|f1=${cellStr(f1r['تاریخ کوتاژ'])}|f2=${cellStr(f2r['زمان کوتاژ'])}|n1=${normDateTime(f1r['تاریخ کوتاژ'])}|n2=${normDateTime(f2r['زمان کوتاژ'])}`);
  }
}
W(`DATE_COMPARE_ON_JOINED|exact=${dateExact}|fail=${dateFail}`);

// File1 sheet1 duplicate analysis without partition noise
const groups = new Map();
for (const r of all1) {
  const k = normKootaj(r['شماره کوتاژ']);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const multi = [...groups.entries()].filter(([, a]) => a.length > 1);
W(`F1_MASTER|rows=${all1.length}|unique=${groups.size}|multiKootaj=${multi.length}`);
W('F1_MULTI_EXAMPLES');
multi.slice(0, 8).forEach(([k, rows]) => {
  W(`KOOTAJ|${k}|count=${rows.length}|whs=${[...new Set(rows.map((r) => cellStr(r['شماره قبض انبار'])))].join(',')}`);
  rows.forEach((r, idx) => W(`  R${idx + 1}|tariff=${cellStr(r['کد تعرفه'])}|desc=${cellStr(r['شرح کالا'])}|w=${cellStr(r['وزن ناخالص'])}|rial=${cellStr(r['ارزش ریالی کالا'])}|rights=${cellStr(r['حقوق استنباطی گمرک'])}`));
});

// Aggregation validation: for multi-item kootajs, does SUM(weight) make sense vs any total? 
// Values are repeated - so SUM(rial) would be WRONG
W('AGG_VALIDATION');
for (const [k, rows] of multi.slice(0, 5)) {
  const weights = rows.map((r) => toNum(r['وزن ناخالص']));
  const rials = rows.map((r) => toNum(r['ارزش ریالی کالا']));
  const rights = rows.map((r) => toNum(r['حقوق استنباطی گمرک']));
  W(`  K=${k}|weightSum=${weights.reduce((a, b) => a + (b || 0), 0)}|weightDistinct=${[...new Set(weights)].join(',')}|rialDistinct=${[...new Set(rials)].join(',')}|rightsDistinct=${[...new Set(rights)].join(',')}|rialSame=${new Set(rials).size === 1}|rightsSame=${new Set(rights.filter((x) => x != null)).size <= 1}`);
}

// File2 multi-row aggregation same check using resolved kootaj via wh+date
W('F2_AGG_BY_RESOLVED_KOOTAJ');
const f2byK = new Map();
for (const r of f2) {
  const wh = cellStr(r['شماره قبض انبار']);
  const dt = normDateTime(r['زمان کوتاژ']);
  const sWd = byWhDate.get(`${wh}||${dt}`) || new Set();
  const key = sWd.size === 1 ? [...sWd][0] : `UNRES:${wh}||${dt}`;
  if (!f2byK.has(key)) f2byK.set(key, []);
  f2byK.get(key).push(r);
}
const f2multi = [...f2byK.entries()].filter(([, a]) => a.length > 1);
W(`F2_GROUPED|groups=${f2byK.size}|multi=${f2multi.length}`);
for (const [k, rows] of f2multi.slice(0, 6)) {
  const fieldCheck = (col) => {
    const vals = rows.map((r) => cellStr(r[col]));
    const u = [...new Set(vals)];
    return { col, same: u.length === 1, values: u.slice(0, 6) };
  };
  W(`GROUP|${k}|n=${rows.length}`);
  for (const col of ['ارزش ریالی اظهارنامه', 'ارزش ارزی اظهارنامه', 'وزن ناخالص', 'وزن خالص', 'تعداد بسته', 'نام کالا', 'کد اچ اس کالا', 'شماره قبض انبار', 'بیمه', 'کرایه', 'نرخ ارز', 'نام صاحب کالا', 'شماره مجوز بارگيري']) {
    const c = fieldCheck(col);
    W(`  ${c.col}|same=${c.same}|vals=${c.values.join(' ;; ')}`);
  }
}

// File3 letter fields deeper
W();
W('=== FILE3 LETTER FIELD ANALYSIS ===');
const letterCandidates = ['شناسه نامه', 'شماره نامه وارده', 'شماره ثبت', 'تاریخ تهیه', 'تاریخ ثبت', 'تاریخ نامه وارده', 'توضیحات'];
for (const col of letterCandidates) {
  let filled = 0;
  const samples = [];
  for (const r of f3) {
    const v = cellStr(r[col]);
    if (!v) continue;
    filled++;
    if (samples.length < 5) samples.push(v);
  }
  W(`COL|${col}|filled=${filled}/${f3.length}|samples=${samples.join(' || ')}`);
}

// Multiple automation rows per kootaj
const byExtracted = new Map();
for (const r of f3) {
  const d = cellStr(r['توضیحات']);
  const m = normDigits(d).match(/شماره\s*کوتاژ\s*[:：]?\s*(\d{4,10})/);
  const k = m ? m[1] : 'NOEXTRACT';
  if (!byExtracted.has(k)) byExtracted.set(k, []);
  byExtracted.get(k).push(r);
}
const multiLetter = [...byExtracted.entries()].filter(([, a]) => a.length > 1);
W(`F3_PER_KOOTAJ|uniqueExtracted=${[...byExtracted.keys()].filter((k) => k !== 'NOEXTRACT').length}|kootajsWithMultipleRows=${multiLetter.length}`);
for (const [k, rows] of multiLetter.slice(0, 15)) {
  W(`MULTI_F3|k=${k}|n=${rows.length}`);
  rows.forEach((r, idx) => {
    W(`  R${idx + 1}|id=${cellStr(r['شناسه نامه'])}|reg=${cellStr(r['شماره ثبت'])}|prep=${cellStr(r['تاریخ تهیه'])}|regDate=${cellStr(r['تاریخ ثبت'])}|registrar=${cellStr(r['ثبت كننده'])}`);
  });
}

// Unmatched kootajs in F3 vs F1
const f1ks = new Set([...groups.keys()]);
const unmatched = [];
const matched = [];
for (const k of byExtracted.keys()) {
  if (k === 'NOEXTRACT') continue;
  if (f1ks.has(k)) matched.push(k);
  else unmatched.push(k);
}
W(`F3_MATCH_F1|matched=${matched.length}|unmatched=${unmatched.length}|unmatchedList=${unmatched.join(',')}`);

// Check if unmatched exist in F2 via any means - F2 has no kootaj; skip
// Rights column in F2?
W(`F2_HAS_RIGHTS_COL=false`);
W(`F1_HAS_QTY_COL=false`);
W(`F2_HAS_QTY_COL=تعداد بسته`);

fs.writeFileSync(path.join(outDir, 'join_and_letter_analysis.txt'), lines.join('\n'), 'utf8');
console.log('WROTE join_and_letter_analysis.txt lines=', lines.length);
