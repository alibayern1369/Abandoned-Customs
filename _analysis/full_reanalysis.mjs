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
  const xls = full.filter((f) => f.ext === '.xls').sort((a, b) => b.size - a.size);
  const byName = (pred) => full.find(pred);
  return {
    file1:
      byName((f) => f.ext === '.xlsx' && f.name.includes('کیش') && f.size > 100000)?.path ||
      xlsx[0]?.path,
    file2:
      byName((f) => f.ext === '.xlsx' && f.name.includes('سامانه'))?.path ||
      xlsx.find((f) => f.path !== (byName((x) => x.ext === '.xlsx' && x.name.includes('کیش') && x.size > 100000)?.path || xlsx[0]?.path) && f.size > 50000)?.path,
    file3: byName((f) => f.ext === '.xls' && f.name.includes('اتوماسیون'))?.path || xls[0]?.path,
  };
}

function normDigits(s) {
  return String(s ?? '').replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - '٠'.charCodeAt(0)));
}

function normKootaj(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  let s = normDigits(String(v)).trim();
  s = s.replace(/[^\d]/g, '');
  if (!s) return '';
  if (/^0+$/.test(s)) return '0';
  return s.replace(/^0+/, '');
}

function cellStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = normDigits(String(v)).replace(/,/g, '').replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function findCol(headers, candidates) {
  for (const cand of candidates) {
    const exact = headers.find((h) => h === cand);
    if (exact) return exact;
    const partial = headers.find((h) => h && h.includes(cand));
    if (partial) return partial;
  }
  return null;
}

function readWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    if (!rows.length) return { name, headers: [], data: [] };
    const headers = (rows[0] || []).map((h, i) => (h == null || String(h).trim() === '' ? `BLANK_${i + 1}` : String(h).trim()));
    const data = [];
    for (let r = 1; r < rows.length; r++) {
      const arr = rows[r] || [];
      const obj = {};
      let empty = true;
      for (let c = 0; c < headers.length; c++) {
        const v = arr[c] ?? null;
        obj[headers[c]] = v;
        if (v != null && String(v).trim() !== '') empty = false;
      }
      if (!empty) {
        obj._sheet = name;
        data.push(obj);
      }
    }
    return { name, headers, data };
  });
  return sheets;
}

function analyzeDuplicates(rows, keyCol, compareCols) {
  const groups = new Map();
  for (const row of rows) {
    const k = normKootaj(row[keyCol]);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(row);
  }
  const multi = [...groups.entries()].filter(([, list]) => list.length > 1).sort((a, b) => b[1].length - a[1].length);
  const fieldBehavior = {};
  for (const col of compareCols) {
    fieldBehavior[col] = {
      sameAcrossDupRows: 0,
      differAcrossDupRows: 0,
      differExamples: [],
    };
  }
  const examples = [];
  for (const [k, list] of multi) {
    if (examples.length < 8) {
      examples.push({
        kootaj: k,
        count: list.length,
        rows: list.map((r) => {
          const snap = {};
          for (const c of compareCols) snap[c] = cellStr(r[c]);
          return snap;
        }),
      });
    }
    for (const col of compareCols) {
      const vals = [...new Set(list.map((r) => cellStr(r[col])))];
      if (vals.length <= 1) fieldBehavior[col].sameAcrossDupRows++;
      else {
        fieldBehavior[col].differAcrossDupRows++;
        if (fieldBehavior[col].differExamples.length < 3) {
          fieldBehavior[col].differExamples.push({ kootaj: k, values: vals });
        }
      }
    }
  }
  return {
    totalRows: rows.length,
    uniqueKeys: groups.size,
    dupKeyCount: multi.length,
    examples,
    fieldBehavior,
  };
}

function analyzeNumericLevel(rows, keyCol, numCol) {
  const groups = new Map();
  for (const row of rows) {
    const k = normKootaj(row[keyCol]);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(row);
  }
  const multi = [...groups.entries()].filter(([, list]) => list.length > 1);
  const stats = {
    multiGroups: multi.length,
    allRowsSameValue: 0,
    rowsDiffer: 0,
    pattern_repeated_total: 0,
    pattern_row_specific: 0,
    pattern_mixed_empty: 0,
    examples_same: [],
    examples_differ: [],
    sumCheck: { groupsWhereSumEqualsMax: 0, groupsWhereValuesVary: 0, avgRatioSumToFirst: [] },
  };
  for (const [k, list] of multi) {
    const raws = list.map((r) => cellStr(r[numCol]));
    const empties = raws.filter((x) => x === '').length;
    const nonEmpty = [...new Set(raws.filter((x) => x !== ''))];
    if (empties > 0 && empties < list.length) stats.pattern_mixed_empty++;
    if (nonEmpty.length <= 1) {
      stats.allRowsSameValue++;
      stats.pattern_repeated_total++;
      if (stats.examples_same.length < 5) stats.examples_same.push({ kootaj: k, count: list.length, value: nonEmpty[0] ?? '' });
    } else {
      stats.rowsDiffer++;
      stats.pattern_row_specific++;
      if (stats.examples_differ.length < 5) stats.examples_differ.push({ kootaj: k, count: list.length, values: nonEmpty });
      const nums = list.map((r) => toNum(r[numCol])).filter((n) => n != null);
      if (nums.length === list.length) {
        stats.sumCheck.groupsWhereValuesVary++;
        const first = nums[0];
        const sum = nums.reduce((a, b) => a + b, 0);
        if (first !== 0) stats.sumCheck.avgRatioSumToFirst.push(sum / first);
      }
    }
  }
  return stats;
}

function extractKootajPatterns(text) {
  const t = normDigits(text);
  const regexes = [
    { name: 'شماره_کوتاژ', rx: /شماره\s*کوتاژ\s*[:：]?\s*(\d{4,10})/g },
    { name: 'کوتاژ_digit', rx: /کوتاژ\s*[:：]?\s*(\d{4,10})/g },
    { name: 'کوتاج_digit', rx: /کوتاج\s*[:：]?\s*(\d{4,10})/g },
    { name: 'کوتاز_digit', rx: /کوتاز\s*[:：]?\s*(\d{4,10})/g },
    { name: 'cotage_digit', rx: /cotage\s*[:：]?\s*(\d{4,10})/gi },
    { name: 'kootaj_digit', rx: /kootaj\s*[:：]?\s*(\d{4,10})/gi },
    { name: 'اظهارنامه_digit', rx: /اظهارنامه\s*(?:شماره)?\s*[:：]?\s*(\d{4,10})/g },
    { name: 'standalone_5to7', rx: /(?<!\d)(\d{5,7})(?!\d)/g },
  ];
  const matches = [];
  for (const { name, rx } of regexes) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(t)) !== null) {
      matches.push({ pattern: name, value: m[1], full: m[0] });
    }
  }
  return { raw: text, normalized: t, matches };
}

const lines = [];
const W = (s = '') => lines.push(s);

const srcDir = findSourceDir();
const files = findFiles(srcDir);
W(`SOURCE_DIR=${srcDir}`);
W(`FILE1=${files.file1}`);
W(`FILE2=${files.file2}`);
W(`FILE3=${files.file3}`);
W();

// ========== FILE 1 ==========
W('========== FILE1 ==========');
const f1Sheets = readWorkbook(files.file1);
W(`sheetCount=${f1Sheets.length}`);
const all1 = [];
for (const sh of f1Sheets) {
  W(`SHEET|${sh.name}|rows=${sh.data.length}|cols=${sh.headers.length}`);
  W(`HEADERS|${sh.headers.join('||')}`);
  all1.push(...sh.data);
}
const h1 = f1Sheets[0].headers;
const k1 = findCol(h1, ['شماره کوتاژ', 'کوتاژ']);
const wh1 = findCol(h1, ['شماره قبض انبار', 'قبض انبار']);
const tariff1 = findCol(h1, ['کد تعرفه']);
const desc1 = findCol(h1, ['شرح کالا']);
const weight1 = findCol(h1, ['وزن ناخالص', 'وزن']);
const rial1 = findCol(h1, ['ارزش ریالی']);
const cur1 = findCol(h1, ['ارزش ارزی']);
const rights1 = findCol(h1, ['حقوق استنباطی']);
const status1 = findCol(h1, ['وضعیت کالا']);
const ann1 = findCol(h1, ['تاریخ اعلام']);
const exit1 = findCol(h1, ['تاریخ خروج']);
const date1 = findCol(h1, ['تاریخ کوتاژ']);
const eval1 = findCol(h1, ['محل ارزیابی']);
const stage1 = findCol(h1, ['مرحله اظهارنامه']);
const varizi1 = findCol(h1, ['واریزی']);
const radif1 = findCol(h1, ['ردیف']);
W(`KOOTAJ_COL=${k1}|WH=${wh1}|TARIFF=${tariff1}|WEIGHT=${weight1}|RIAL=${rial1}|RIGHTS=${rights1}`);

const cmp1 = [k1, date1, tariff1, desc1, weight1, rial1, cur1, wh1, eval1, stage1, rights1, varizi1, status1, ann1, exit1].filter(Boolean);
const dup1 = analyzeDuplicates(all1, k1, cmp1);
W(`FILE1_DUP|total=${dup1.totalRows}|unique=${dup1.uniqueKeys}|dupKeys=${dup1.dupKeyCount}`);
for (const ex of dup1.examples) {
  W(`DUP_EX|kootaj=${ex.kootaj}|count=${ex.count}`);
  ex.rows.forEach((r, i) => {
    W(`  R${i + 1}|${Object.entries(r).map(([a, b]) => `${a}=${b}`).join(' || ')}`);
  });
}
for (const col of cmp1) {
  const fb = dup1.fieldBehavior[col];
  W(`FIELD_BEHAVIOR|${col}|sameGroups=${fb.sameAcrossDupRows}|differGroups=${fb.differAcrossDupRows}`);
  for (const d of fb.differExamples) W(`  DIFFER|${d.kootaj}|values=${d.values.join(' ;; ')}`);
}
for (const numCol of [weight1, rial1, cur1, rights1]) {
  if (!numCol) continue;
  const ns = analyzeNumericLevel(all1, k1, numCol);
  W(`NUM_LEVEL|${numCol}|multi=${ns.multiGroups}|same=${ns.allRowsSameValue}|differ=${ns.rowsDiffer}|repeatedTotal=${ns.pattern_repeated_total}|rowSpecific=${ns.pattern_row_specific}|mixedEmpty=${ns.pattern_mixed_empty}`);
  for (const e of ns.examples_same) W(`  SAME_EX|${e.kootaj}|n=${e.count}|v=${e.value}`);
  for (const e of ns.examples_differ) W(`  DIFF_EX|${e.kootaj}|n=${e.count}|v=${e.values.join(' ;; ')}`);
}

// multi warehouse per kootaj
const kw = new Map();
for (const r of all1) {
  const k = normKootaj(r[k1]);
  const w = cellStr(r[wh1]);
  if (!k) continue;
  if (!kw.has(k)) kw.set(k, new Set());
  if (w) kw.get(k).add(w);
}
const multiWh = [...kw.entries()].filter(([, s]) => s.size > 1).sort((a, b) => b[1].size - a[1].size);
W(`MULTI_WH_PER_KOOTAJ=${multiWh.length}`);
multiWh.slice(0, 10).forEach(([k, s]) => W(`MULTI_WH|${k}|whCount=${s.size}|whs=${[...s].join(',')}`));

// format stats
let excelNum = 0, latinText = 0, persianDigits = 0, arabicIndic = 0, withSpace = 0;
for (const r of all1) {
  const v = r[k1];
  if (typeof v === 'number') { excelNum++; continue; }
  const s = String(v ?? '');
  if (s !== s.trim() || /\s/.test(s)) withSpace++;
  if (/[۰-۹]/.test(s)) persianDigits++;
  else if (/[٠-٩]/.test(s)) arabicIndic++;
  else if (/[0-9]/.test(s)) latinText++;
}
W(`KOOTAJ_FORMAT|excelNum=${excelNum}|latinText=${latinText}|persianDigits=${persianDigits}|arabicIndic=${arabicIndic}|withSpace=${withSpace}`);

const st = {};
for (const r of all1) {
  const s = cellStr(r[status1]);
  st[s] = (st[s] || 0) + 1;
}
W('STATUS_VALUES');
for (const [k, v] of Object.entries(st).sort((a, b) => b[1] - a[1])) W(`  STATUS|${k}=${v}`);

// sheet partition check
const bySheet = {};
for (const r of all1) {
  const s = r._sheet;
  bySheet[s] = bySheet[s] || { rows: 0, unique: new Set() };
  bySheet[s].rows++;
  bySheet[s].unique.add(normKootaj(r[k1]));
}
W('SHEET_PARTITION');
for (const [name, info] of Object.entries(bySheet)) W(`  ${name}|rows=${info.rows}|uniqueKootaj=${info.unique.size}`);

// ========== FILE 2 ==========
W();
W('========== FILE2 ==========');
const f2Sheets = readWorkbook(files.file2);
W(`sheetCount=${f2Sheets.length}`);
const all2 = [];
for (const sh of f2Sheets) {
  W(`SHEET|${sh.name}|rows=${sh.data.length}|cols=${sh.headers.length}`);
  W(`HEADERS|${sh.headers.join('||')}`);
  all2.push(...sh.data);
}
const h2 = f2Sheets[0].headers;
W('FILE2_SAMPLE_ROWS');
for (let i = 0; i < Math.min(3, all2.length); i++) {
  W(`ROW${i}|${Object.entries(all2[i]).map(([a, b]) => `${a}=${b}`).join(' || ')}`);
}

const k2 = findCol(h2, ['شماره کوتاژ', 'کوتاژ', 'شماره اظهارنامه', 'شماره اظهار']);
const wh2 = findCol(h2, ['شماره قبض انبار', 'قبض انبار', 'قبض']);
const tariff2 = findCol(h2, ['کد تعرفه', 'تعرفه']);
const desc2 = findCol(h2, ['شرح کالا', 'شرح']);
const weight2 = findCol(h2, ['وزن ناخالص', 'وزن']);
const qty2 = findCol(h2, ['تعداد', 'مقدار', 'تعداد کالا']);
const rial2 = findCol(h2, ['ارزش ریالی کالا', 'ارزش ریالی', 'ارزش']);
const cur2 = findCol(h2, ['ارزش ارزی']);
const rights2 = findCol(h2, ['حقوق استنباطی', 'حقوق']);
const radif2 = findCol(h2, ['ردیف']);
const date2 = findCol(h2, ['تاریخ کوتاژ', 'تاریخ اظهار']);
W(`FILE2_KEYCOLS|kootaj=${k2}|wh=${wh2}|tariff=${tariff2}|weight=${weight2}|qty=${qty2}|rial=${rial2}|rights=${rights2}|radif=${radif2}|desc=${desc2}|date=${date2}`);

if (!k2) {
  W('FILE2_NO_KOOTAJ_COL_FOUND');
  for (const col of h2) {
    const set = new Set();
    for (const r of all2) {
      const v = normKootaj(r[col]) || cellStr(r[col]);
      if (v) set.add(v);
    }
    W(`COL_UNIQ|${col}|unique=${set.size}|rows=${all2.length}`);
  }
} else {
  const dup2 = analyzeDuplicates(all2, k2, h2);
  W(`FILE2_DUP|total=${dup2.totalRows}|unique=${dup2.uniqueKeys}|dupKeys=${dup2.dupKeyCount}`);
  for (const ex of dup2.examples) {
    W(`DUP_EX|kootaj=${ex.kootaj}|count=${ex.count}`);
    ex.rows.forEach((r, i) => {
      const parts = [];
      for (const c of [radif2, wh2, tariff2, desc2, weight2, qty2, rial2, cur2, rights2, date2]) {
        if (c) parts.push(`${c}=${r[c]}`);
      }
      W(`  R${i + 1}|${parts.join(' || ')}`);
    });
  }
  for (const col of h2) {
    const fb = dup2.fieldBehavior[col];
    if (!fb) continue;
    W(`FIELD_BEHAVIOR|${col}|sameGroups=${fb.sameAcrossDupRows}|differGroups=${fb.differAcrossDupRows}`);
    for (const d of fb.differExamples) W(`  DIFFER|${d.kootaj}|values=${d.values.join(' ;; ')}`);
  }
  for (const numCol of [weight2, qty2, rial2, cur2, rights2]) {
    if (!numCol) continue;
    const ns = analyzeNumericLevel(all2, k2, numCol);
    W(`NUM_LEVEL|${numCol}|multi=${ns.multiGroups}|same=${ns.allRowsSameValue}|differ=${ns.rowsDiffer}|repeatedTotal=${ns.pattern_repeated_total}|rowSpecific=${ns.pattern_row_specific}|mixedEmpty=${ns.pattern_mixed_empty}`);
    for (const e of ns.examples_same) W(`  SAME_EX|${e.kootaj}|n=${e.count}|v=${e.value}`);
    for (const e of ns.examples_differ) W(`  DIFF_EX|${e.kootaj}|n=${e.count}|v=${e.values.join(' ;; ')}`);
  }

  // Cross with file1
  const set1 = new Set(all1.map((r) => normKootaj(r[k1])).filter(Boolean));
  const set2 = new Set(all2.map((r) => normKootaj(r[k2])).filter(Boolean));
  let inBoth = 0, only2 = 0;
  const only2Ex = [];
  for (const k of set2) {
    if (set1.has(k)) inBoth++;
    else {
      only2++;
      if (only2Ex.length < 30) only2Ex.push(k);
    }
  }
  W(`CROSS_F1_F2|file1Unique=${set1.size}|file2Unique=${set2.size}|inBoth=${inBoth}|onlyInFile2=${only2}`);
  W(`ONLY2_EX|${only2Ex.join(',')}`);

  // Also check if file2 has quantity-like columns we missed - dump all numeric-ish headers stats
  W('FILE2_ALL_COL_STATS');
  for (const col of h2) {
    let empty = 0, num = 0, text = 0;
    const samples = [];
    for (const r of all2) {
      const v = r[col];
      if (v == null || String(v).trim() === '') { empty++; continue; }
      if (typeof v === 'number' || toNum(v) != null) num++;
      else text++;
      if (samples.length < 2) samples.push(cellStr(v).slice(0, 80));
    }
    W(`  COLSTAT|${col}|empty=${empty}|num=${num}|text=${text}|samples=${samples.join(' ;; ')}`);
  }
}

// ========== FILE 3 ==========
W();
W('========== FILE3 ==========');
const f3Sheets = readWorkbook(files.file3);
W(`sheetCount=${f3Sheets.length}`);
const all3 = [];
for (const sh of f3Sheets) {
  W(`SHEET|${sh.name}|rows=${sh.data.length}|cols=${sh.headers.length}`);
  W(`HEADERS|${sh.headers.join('||')}`);
  all3.push(...sh.data);
}
W('FILE3_SAMPLE_ROWS');
for (let i = 0; i < Math.min(8, all3.length); i++) {
  W(`ROW${i}|${Object.entries(all3[i]).map(([a, b]) => `${a}=${String(b ?? '').slice(0, 150)}`).join(' || ')}`);
}
const h3 = f3Sheets[0].headers;
const letterNo = findCol(h3, ['شماره نامه']);
const letterDate = findCol(h3, ['تاریخ نامه']);
const desc3 = findCol(h3, ['توضیحات', 'شرح', 'موضوع']);
const k3 = findCol(h3, ['شماره کوتاژ', 'کوتاژ']);
W(`LETTER_COLS|number=${letterNo}|date=${letterDate}|desc=${desc3}|kootaj=${k3}`);

W('FILE3_COL_CANDIDATES');
for (const col of h3) {
  let nonEmpty = 0;
  const samples = [];
  for (const r of all3) {
    const v = cellStr(r[col]);
    if (!v) continue;
    nonEmpty++;
    if (samples.length < 3) samples.push(v.slice(0, 120));
  }
  W(`COL|${col}|nonEmpty=${nonEmpty}|samples=${samples.join(' ;; ')}`);
}

const set1b = new Set(all1.map((r) => normKootaj(r[k1])).filter(Boolean));
const set2b = k2 ? new Set(all2.map((r) => normKootaj(r[k2])).filter(Boolean)) : new Set();

if (desc3) {
  const extractStats = {
    total: all3.length,
    emptyDesc: 0,
    extracted: 0,
    noExtract: 0,
    multiCandidate: 0,
    patternCounts: {},
    matchedInFile1: 0,
    matchedInFile2: 0,
    unmatched: 0,
    failExamples: [],
    successExamples: [],
    multiExamples: [],
    labeledExtract: 0,
    standaloneOnly: 0,
  };

  for (const r of all3) {
    const desc = cellStr(r[desc3]);
    if (!desc) { extractStats.emptyDesc++; continue; }
    const ex = extractKootajPatterns(desc);
    const labeled = ex.matches.filter((m) => m.pattern !== 'standalone_5to7');
    const standalone = ex.matches.filter((m) => m.pattern === 'standalone_5to7');
    let chosen = [];
    if (labeled.length) {
      chosen = [...new Set(labeled.map((m) => m.value))];
      extractStats.labeledExtract++;
      for (const m of labeled) extractStats.patternCounts[m.pattern] = (extractStats.patternCounts[m.pattern] || 0) + 1;
    } else if (standalone.length) {
      chosen = [...new Set(standalone.map((m) => m.value))];
      extractStats.standaloneOnly++;
      extractStats.patternCounts.standalone_5to7 = (extractStats.patternCounts.standalone_5to7 || 0) + 1;
    }

    if (!chosen.length) {
      extractStats.noExtract++;
      if (extractStats.failExamples.length < 20) {
        extractStats.failExamples.push({
          letter: letterNo ? cellStr(r[letterNo]) : '',
          date: letterDate ? cellStr(r[letterDate]) : '',
          desc: desc.slice(0, 250),
        });
      }
    } else {
      extractStats.extracted++;
      if (chosen.length > 1) {
        extractStats.multiCandidate++;
        if (extractStats.multiExamples.length < 15) {
          extractStats.multiExamples.push({ candidates: chosen.join(','), desc: desc.slice(0, 250) });
        }
      }
      const norms = chosen.map(normKootaj);
      const in1 = norms.some((n) => set1b.has(n));
      const in2 = norms.some((n) => set2b.has(n));
      if (in1) extractStats.matchedInFile1++;
      if (in2) extractStats.matchedInFile2++;
      if (!in1 && !in2) extractStats.unmatched++;
      if (extractStats.successExamples.length < 20) {
        extractStats.successExamples.push({
          kootaj: norms[0],
          all: norms.join(','),
          letter: letterNo ? cellStr(r[letterNo]) : '',
          date: letterDate ? cellStr(r[letterDate]) : '',
          desc: desc.slice(0, 200),
          inF1: in1,
          inF2: in2,
          via: labeled.length ? 'labeled' : 'standalone',
        });
      }
    }
  }

  W(`EXTRACT_STATS|total=${extractStats.total}|empty=${extractStats.emptyDesc}|extracted=${extractStats.extracted}|noExtract=${extractStats.noExtract}|multi=${extractStats.multiCandidate}|labeled=${extractStats.labeledExtract}|standaloneOnly=${extractStats.standaloneOnly}|matchedF1=${extractStats.matchedInFile1}|matchedF2=${extractStats.matchedInFile2}|unmatched=${extractStats.unmatched}`);
  for (const [p, c] of Object.entries(extractStats.patternCounts)) W(`PATTERN|${p}=${c}`);
  W('EXTRACT_SUCCESS_EX');
  for (const e of extractStats.successExamples) W(`  OK|k=${e.kootaj}|all=${e.all}|via=${e.via}|letter=${e.letter}|date=${e.date}|inF1=${e.inF1}|inF2=${e.inF2}|desc=${e.desc}`);
  W('EXTRACT_FAIL_EX');
  for (const e of extractStats.failExamples) W(`  FAIL|letter=${e.letter}|date=${e.date}|desc=${e.desc}`);
  W('EXTRACT_MULTI_EX');
  for (const e of extractStats.multiExamples) W(`  MULTI|cands=${e.candidates}|desc=${e.desc}`);

  // Frequency of description templates
  W('DESC_TEMPLATE_SAMPLES');
  const templates = {};
  for (const r of all3) {
    const d = cellStr(r[desc3]);
    if (!d) continue;
    // generalize digits
    const t = normDigits(d).replace(/\d+/g, '#').slice(0, 120);
    templates[t] = (templates[t] || 0) + 1;
  }
  Object.entries(templates).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t, c]) => W(`  TPL|${c}|${t}`));
}

if (letterNo) {
  const letterSet = new Map();
  let dupOcc = 0;
  for (const r of all3) {
    const ln = cellStr(r[letterNo]);
    if (!ln) continue;
    if (letterSet.has(ln)) dupOcc++;
    else letterSet.set(ln, 1);
  }
  W(`LETTER_NUM|unique=${letterSet.size}|duplicateOccurrences=${dupOcc}`);
}

if (letterNo && desc3) {
  let letterInDesc = 0, letterNotInDesc = 0, dateInDesc = 0;
  for (const r of all3) {
    const ln = cellStr(r[letterNo]);
    const ld = letterDate ? cellStr(r[letterDate]) : '';
    const d = cellStr(r[desc3]);
    if (ln) {
      if (d.includes(ln)) letterInDesc++;
      else letterNotInDesc++;
    }
    if (ld && d.includes(ld)) dateInDesc++;
  }
  W(`LETTER_IN_DESC|numberAlsoInDesc=${letterInDesc}|numberNotInDesc=${letterNotInDesc}|dateAlsoInDesc=${dateInDesc}`);
}

// One letter per kootaj check among successfully extracted
if (desc3 && letterNo) {
  const byK = new Map();
  for (const r of all3) {
    const desc = cellStr(r[desc3]);
    const ex = extractKootajPatterns(desc);
    const labeled = ex.matches.filter((m) => m.pattern !== 'standalone_5to7');
    const chosen = labeled.length
      ? [...new Set(labeled.map((m) => normKootaj(m.value)))]
      : [...new Set(ex.matches.filter((m) => m.pattern === 'standalone_5to7').map((m) => normKootaj(m.value)))];
    if (chosen.length !== 1) continue;
    const k = chosen[0];
    const ln = cellStr(r[letterNo]);
    if (!byK.has(k)) byK.set(k, new Set());
    if (ln) byK.get(k).add(ln);
  }
  const multiLetter = [...byK.entries()].filter(([, s]) => s.size > 1);
  W(`KOOTAJ_MULTI_LETTER|kootajsWithExtract=${byK.size}|withMultipleLetters=${multiLetter.length}`);
  multiLetter.slice(0, 10).forEach(([k, s]) => W(`  MULTI_LETTER|${k}|letters=${[...s].join(',')}`));
}

const outPath = path.join(outDir, 'full_reanalysis.txt');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('WROTE', outPath);
console.log('LINES', lines.length);
