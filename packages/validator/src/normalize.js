/**
 * Deterministic normalization helpers.
 * Never mutate source values — callers keep original + normalized.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const DIGIT_MAP = (() => {
  const map = Object.create(null);
  for (let i = 0; i < 10; i++) {
    map[PERSIAN_DIGITS[i]] = String(i);
    map[ARABIC_DIGITS[i]] = String(i);
    map[String(i)] = String(i);
  }
  return map;
})();

/** Fold Persian / Arabic-Indic / Latin digits to Latin digits. */
export function foldDigits(value) {
  if (value == null) return '';
  const s = String(value);
  let out = '';
  for (const ch of s) {
    out += DIGIT_MAP[ch] ?? ch;
  }
  return out;
}

/**
 * Normalize a Kootaj identifier for matching.
 * - fold digits
 * - trim whitespace
 * - strip irrelevant punctuation / non-digits
 * - strip leading zeros (but keep a single "0" if all zeros)
 * Does NOT modify the original caller-held value.
 */
export function normalizeKootaj(raw) {
  if (raw == null || raw === '') {
    return { original_value: raw == null ? null : String(raw), normalized_value: null };
  }

  let original;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return { original_value: String(raw), normalized_value: null };
    }
    original = Number.isInteger(raw) ? String(raw) : String(Math.trunc(raw));
  } else {
    original = String(raw);
  }

  let s = foldDigits(original).trim();
  // Remove thousands separators and common punctuation, keep digits only for Kootaj compare
  s = s.replace(/[,\u066C\u200E\u200F\u202A-\u202E\uFEFF]/g, '');
  s = s.replace(/[^\d]/g, '');

  if (!s) {
    return { original_value: original, normalized_value: null };
  }

  // Strip leading zeros; keep "0" if empty after strip
  s = s.replace(/^0+/, '') || '0';

  return { original_value: original, normalized_value: s };
}

/** True if two raw Kootaj values match after normalization. */
export function kootajEquals(a, b) {
  const na = normalizeKootaj(a).normalized_value;
  const nb = normalizeKootaj(b).normalized_value;
  return na != null && nb != null && na === nb;
}

/**
 * Normalize a numeric display value for parsing (commas, digits).
 * Returns null if empty / non-numeric.
 */
export function normalizeNumber(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  let s = foldDigits(String(raw)).trim();
  s = s.replace(/[,\u066C\u200E\u200F\u202A-\u202E\uFEFF\s]/g, '');
  if (!s || s === '-' || s === '—') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Clean letter registration number: fold digits, strip invisible chars,
 * keep year/number shape when present.
 */
export function normalizeLetterNumber(raw) {
  if (raw == null || raw === '') return null;
  let s = foldDigits(String(raw));
  s = s.replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u00A0]/g, '');
  // Soft hyphen / C1 junk between year and number — treat as slash then collapse
  s = s.replace(/[\u00AD\u009D]/g, '/');
  s = s.replace(/\/{2,}/g, '/');
  s = s.trim();
  if (!s) return null;
  return s;
}

/**
 * Parse / clean letter date string (Shamsi text as stored).
 * Returns cleaned string or null if empty.
 */
export function normalizeLetterDate(raw) {
  if (raw == null || raw === '') return null;
  let s = foldDigits(String(raw));
  s = s.replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u00A0]/g, '').trim();
  // Drop leading LTR/RTL marks leftovers and trailing "ش" marker noise for display consistency
  if (!s) return null;
  return s;
}

/**
 * Extract Kootaj from File 3 Description using confirmed deterministic regex.
 * Primary: شماره کوتاژ <digits>
 * Fallback: کوتاژ <digits>
 */
export function extractKootajFromDescription(description) {
  const original = description == null ? '' : String(description);
  if (!original.trim()) {
    return {
      original_description: original,
      extracted_raw: null,
      normalized_value: null,
      method: null,
      ok: false,
      reason: 'empty_description',
    };
  }

  const folded = foldDigits(original);
  const primary = folded.match(/شماره\s*کوتاژ\s*[:：]?\s*([0-9]{4,10})/);
  if (primary) {
    const norm = normalizeKootaj(primary[1]);
    return {
      original_description: original,
      extracted_raw: primary[1],
      normalized_value: norm.normalized_value,
      method: 'labeled_shomare_kootaj',
      ok: true,
      reason: null,
    };
  }

  const fallback = folded.match(/کوتاژ\s*[:：]?\s*([0-9]{4,10})/);
  if (fallback) {
    const norm = normalizeKootaj(fallback[1]);
    return {
      original_description: original,
      extracted_raw: fallback[1],
      normalized_value: norm.normalized_value,
      method: 'fallback_kootaj',
      ok: true,
      reason: null,
    };
  }

  return {
    original_description: original,
    extracted_raw: null,
    normalized_value: null,
    method: null,
    ok: false,
    reason: 'no_pattern_match',
  };
}

/** Cell → trimmed string without mutating Excel. */
export function cellToString(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? String(raw) : String(raw);
  }
  return String(raw).trim();
}
