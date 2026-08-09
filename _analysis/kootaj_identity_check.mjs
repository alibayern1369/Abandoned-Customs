import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const amarRoot = String.raw`d:\Files\Amar\1405`;
function findSourceDir() {
  for (const name of fs.readdirSync(amarRoot)) if (name.includes('آپدیت')) return path.join(amarRoot, name);
}
function findFiles(dir) {
  const full = fs.readdirSync(dir).filter((f) => !f.startsWith('~$')).map((f) => {
    const p = path.join(dir, f);
    return { name: f, path: p, size: fs.statSync(p).size, ext: path.extname(f).toLowerCase() };
  });
  const xlsx = full.filter((f) => f.ext === '.xlsx').sort((a, b) => b.size - a.size);
  return {
    file1: full.find((f) => f.ext === '.xlsx' && f.name.includes('کیش') && f.size > 100000)?.path || xlsx[0].path,
    file2: full.find((f) => f.ext === '.xlsx' && f.name.includes('سامانه'))?.path,
    file3: full.find((f) => f.ext === '.xls' && f.name.includes('اتوماسیون'))?.path,
  };
}
function cellStr(v) { return v == null ? '' : String(v).trim(); }
function normDigits(s) {
  return String(s ?? '').replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - '٠'.charCodeAt(0)));
}
function normKootaj(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  let s = normDigits(String(v)).trim().replace(/[^\d]/g, '');
  if (!s) return '';
  return /^0+$/.test(s) ? '0' : s.replace(/^0+/, '');
}
function normDateTime(v) {
  const s = normDigits(cellStr(v));
  const m = s.match(/(\d{3,4})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return s.replace(/\s+/g, ' ');
  const pad = (x) => String(Number(x)).padStart(2, '0');
  return `${m[1]}/${pad(m[2])}/${pad(m[3])} ${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`;
}
function normWh(v) {
  const s = cellStr(v);
  // keep digits, strip leading zeros for compare, but preserve non-numeric markers
  if (!s || s === '-') return s;
  const d = normDigits(s).replace(/[^\dA-Za-z]/g, '');
  if (/^\d+$/.test(d)) return d.replace(/^0+/, '') || '0';
  return d;
}
function readWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
  return wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
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
const W = (s='') => lines.push(s);
const files = findFiles(findSourceDir());
const f1 = readWorkbook(files.file1);
const master = (f1.find((s) => s.name.includes('کلی')) || f1[0]).data;
const f2 = readWorkbook(files.file2)[0].data;

// Build F1 maps
const f1ByK = new Map();
for (const r of master) {
  const k = normKootaj(r['شماره کوتاژ']);
  if (!f1ByK.has(k)) f1ByK.set(k, []);
  f1ByK.get(k).push(r);
}

// Test: does شماره مجوز بارگيري equal kootaj when license exists in F1?
let licEq = 0, licNeq = 0, licMissingInF1 = 0, licEmpty = 0;
const neqEx = [];
const groupsByLic = new Map();
for (const r of f2) {
  const lic = normKootaj(r['شماره مجوز بارگيري']);
  if (!lic) { licEmpty++; continue; }
  if (!groupsByLic.has(lic)) groupsByLic.set(lic, []);
  groupsByLic.get(lic).push(r);
  if (f1ByK.has(lic)) {
    // compare date/wh consistency
    const f1rows = f1ByK.get(lic);
    const f1wh = new Set(f1rows.map((x) => normWh(x['شماره قبض انبار'])));
    const f2wh = normWh(r['شماره قبض انبار']);
    const f1dt = new Set(f1rows.map((x) => normDateTime(x['تاریخ کوتاژ'])));
    const f2dt = normDateTime(r['زمان کوتاژ']);
    const whOk = f1wh.has(f2wh);
    const dtOk = f1dt.has(f2dt);
    if (whOk || dtOk) licEq++;
    else {
      licNeq++;
      if (neqEx.length < 10) neqEx.push({ lic, f2wh, f2dt, f1wh: [...f1wh].join(','), f1dt: [...f1dt].join(','), goods: cellStr(r['نام کالا']) });
    }
  } else licMissingInF1++;
}
W(`LICENSE_VS_KOOTAJ|rowsWithLic=${f2.length - licEmpty}|licEmpty=${licEmpty}|licInF1_consistent=${licEq}|licInF1_inconsistent=${licNeq}|licNotInF1=${licMissingInF1}`);
W(`UNIQUE_LICENSE_GROUPS=${groupsByLic.size}`);
neqEx.forEach((e) => W(`NEQ|${JSON.stringify(e)}`));

// For licenses not in F1, are they new kootaj candidates?
const newLicenses = [...groupsByLic.keys()].filter((k) => !f1ByK.has(k));
W(`NEW_LICENSE_NOT_IN_F1=${newLicenses.length}`);
W(`NEW_EX=${newLicenses.slice(0, 40).join(',')}`);

// Validate: within a license group, is license constant and equal across item rows?
let multiLic = 0;
for (const [lic, rows] of groupsByLic) {
  if (rows.length > 1) {
    multiLic++;
    if (multiLic <= 3) {
      W(`MULTI_LIC|${lic}|n=${rows.length}|whs=${[...new Set(rows.map((r) => cellStr(r['شماره قبض انبار'])))].join(',')}|goods=${rows.map((r) => cellStr(r['نام کالا'])).join(' ;; ')}`);
    }
  }
}
W(`MULTI_ROW_LICENSE_GROUPS=${multiLic}`);

// Compare using license as kootaj key for new import logic counts
const existing = [...groupsByLic.keys()].filter((k) => f1ByK.has(k)).length;
const novel = newLicenses.length;
W(`IMPORT_PREVIEW|wouldSkip=${existing}|wouldInsert=${novel}`);

// Check warehouse multiplicity per license in F2
let multiWhLic = 0;
for (const [lic, rows] of groupsByLic) {
  const whs = new Set(rows.map((r) => cellStr(r['شماره قبض انبار'])));
  if (whs.size > 1) {
    multiWhLic++;
    if (multiWhLic <= 10) W(`MULTI_WH_LIC|${lic}|whs=${[...whs].join(',')}|n=${rows.length}`);
  }
}
W(`LICENSE_WITH_MULTI_WH=${multiWhLic}`);

// Electronic warehouse receipts - often comma separated?
let eWhFilled = 0, eWhMulti = 0;
for (const r of f2) {
  const e = cellStr(r['شماره قبض انبار الکترونیکی']);
  if (!e || e === '0') continue;
  eWhFilled++;
  if (e.includes(',')) eWhMulti++;
}
W(`EWH|filled=${eWhFilled}|commaMulti=${eWhMulti}`);

// File1: multi warehouse per kootaj?
let f1MultiWh = 0;
for (const [k, rows] of f1ByK) {
  const whs = new Set(rows.map((r) => cellStr(r['شماره قبض انبار'])));
  if (whs.size > 1) {
    f1MultiWh++;
    W(`F1_MULTI_WH|${k}|whs=${[...whs].join(',')}`);
  }
}
W(`F1_MULTI_WH_COUNT=${f1MultiWh}`);

// Rights in F1: empty rate for new-ish records
let rightsEmpty = 0, rightsFilled = 0;
for (const r of master) {
  if (cellStr(r['حقوق استنباطی گمرک']) === '') rightsEmpty++;
  else rightsFilled++;
}
W(`F1_RIGHTS|filled=${rightsFilled}|empty=${rightsEmpty}`);

// File3: recommend letter number field - compare شناسه نامه uniqueness vs شماره ثبت
const f3 = readWorkbook(files.file3)[0].data;
const byK = new Map();
for (const r of f3) {
  const d = cellStr(r['توضیحات']);
  const m = normDigits(d).match(/شماره\s*کوتاژ\s*[:：]?\s*(\d{4,10})/);
  const k = m ? m[1] : null;
  if (!k) continue;
  if (!byK.has(k)) byK.set(k, []);
  byK.get(k).push(r);
}
W('F3_LETTER_CHOICE_ANALYSIS');
for (const [k, rows] of [...byK.entries()].filter(([, a]) => a.length > 1)) {
  const withReg = rows.filter((r) => cellStr(r['شماره ثبت']));
  const withoutReg = rows.filter((r) => !cellStr(r['شماره ثبت']));
  W(`K=${k}|total=${rows.length}|withShomareSabt=${withReg.length}|without=${withoutReg.length}|ids=${rows.map((r) => cellStr(r['شناسه نامه'])).join(',')}|sabt=${rows.map((r) => cellStr(r['شماره ثبت'])).join(',')}`);
}

// Is شماره ثبت unique across file?
const sabt = new Map();
for (const r of f3) {
  const s = cellStr(r['شماره ثبت']).replace(/[^\d]/g, '');
  if (!s) continue;
  sabt.set(s, (sabt.get(s) || 0) + 1);
}
const sabtDups = [...sabt.entries()].filter(([, c]) => c > 1);
W(`SHOmare_SABT|unique=${sabt.size}|dups=${sabtDups.length}`);

const ids = new Map();
for (const r of f3) {
  const s = cellStr(r['شناسه نامه']);
  ids.set(s, (ids.get(s) || 0) + 1);
}
W(`SHENASE_NAMEH|unique=${ids.size}|dups=${[...ids.values()].filter((c) => c > 1).length}`);

fs.writeFileSync(String.raw`D:\نرم افزار متروکه\_analysis\kootaj_identity_check.txt`, lines.join('\n'), 'utf8');
console.log('done', lines.length);
