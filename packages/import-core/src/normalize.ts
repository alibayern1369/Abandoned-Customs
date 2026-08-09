/**
 * Deterministic normalization helpers.
 * Ported from @metrookeh/validator — behavior must stay identical.
 * Never mutate source values — callers keep original + normalized.
 */

import type { ExtractionResult, NormalizeKootajResult } from './types.js';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const DIGIT_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = Object.create(null);
  for (let i = 0; i < 10; i++) {
    map[PERSIAN_DIGITS[i]] = String(i);
    map[ARABIC_DIGITS[i]] = String(i);
    map[String(i)] = String(i);
  }
  return map;
})();

/** Fold Persian / Arabic-Indic / Latin digits to Latin digits. */
export function foldDigits(value: unknown): string {
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
export function normalizeKootaj(raw: unknown): NormalizeKootajResult {
  if (raw == null || raw === '') {
    return { original_value: raw == null ? null : String(raw), normalized_value: null };
  }

  let original: string;
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
export function kootajEquals(a: unknown, b: unknown): boolean {
  const na = normalizeKootaj(a).normalized_value;
  const nb = normalizeKootaj(b).normalized_value;
  return na != null && nb != null && na === nb;
}

/**
 * Normalize a numeric display value for parsing (commas, digits).
 * Returns null if empty / non-numeric.
 */
export function normalizeNumber(raw: unknown): number | null {
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
export function normalizeLetterNumber(raw: unknown): string | null {
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
export function normalizeLetterDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  let s = foldDigits(String(raw));
  s = s.replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u00A0]/g, '').trim();
  if (!s) return null;
  return s;
}

/**
 * True when value looks like a registration number (سال/سریال), not a calendar date.
 * Serial must have ≥4 digits so `1403/09/20` is never treated as a letter.
 */
export function isLetterRegistrationNumber(raw: unknown): boolean {
  const n = normalizeLetterNumber(raw);
  return n != null && /^\d{2,4}\/\d{4,}$/.test(n);
}

export type AnnouncedToTamlikParse = {
  original: string;
  letterNumber: string | null;
  letterNumberOriginal: string | null;
  letterDate: string | null;
  letterDateOriginal: string | null;
  hasValidLetterNumber: boolean;
};

/**
 * Parse File1 column «تاریخ اعلام به اموال تملیکی».
 * Examples:
 * - `1403/1386642 ‪1403/09/20ش 12:33` → letter + date (has letter)
 * - `1401/175788` → letter only (has letter)
 * - `1403/09/20ش 12:33` or incomplete text without serial → no letter
 */
export function parseAnnouncedToTamlik(raw: unknown): AnnouncedToTamlikParse {
  const original = raw == null || raw === '' ? '' : String(raw).trim();
  if (!original) {
    return {
      original: '',
      letterNumber: null,
      letterNumberOriginal: null,
      letterDate: null,
      letterDateOriginal: null,
      hasValidLetterNumber: false,
    };
  }

  let cleaned = foldDigits(original);
  cleaned = cleaned.replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u00A0]/g, '');
  cleaned = cleaned.replace(/[\u00AD\u009D]/g, '/');
  cleaned = cleaned.replace(/\/{2,}/g, '/').trim();

  // Registration: year/serial with serial ≥4 digits (not month 01–12).
  const letterMatch = cleaned.match(/(\d{2,4}\/\d{4,})/);
  let letterNumber: string | null = null;
  let letterNumberOriginal: string | null = null;
  if (letterMatch && isLetterRegistrationNumber(letterMatch[1])) {
    letterNumber = normalizeLetterNumber(letterMatch[1]);
    letterNumberOriginal = letterMatch[1];
  }

  // Shamsi date optionally with «ش» and time.
  const dateMatch = cleaned.match(
    /(\d{2,4}\/\d{1,2}\/\d{1,2}(?:ش)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/,
  );
  let letterDate: string | null = null;
  let letterDateOriginal: string | null = null;
  if (dateMatch) {
    letterDate = normalizeLetterDate(dateMatch[1]);
    letterDateOriginal = dateMatch[1];
  }

  return {
    original,
    letterNumber,
    letterNumberOriginal,
    letterDate,
    letterDateOriginal,
    hasValidLetterNumber: letterNumber != null,
  };
}

/**
 * Extract Kootaj from File 3 Description using confirmed deterministic regex.
 * Primary: شماره کوتاژ <digits>
 * Fallback: کوتاژ <digits>
 */
export function extractKootajFromDescription(description: unknown): ExtractionResult {
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
export function cellToString(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? String(raw) : String(raw);
  }
  return String(raw).trim();
}
