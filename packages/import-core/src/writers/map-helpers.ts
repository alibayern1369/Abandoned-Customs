/**
 * Helpers for mapping analysis values into Drizzle numeric/text columns.
 */

import { normalizeNumber, cellToString } from '../normalize.js';
import type { FieldValue } from '../types.js';

/** Extract string from File1 FieldValue map or flat string map (File2). */
export function levelText(
  level: Record<string, FieldValue> | Record<string, string>,
  field: string,
): string | null {
  const raw = level[field];
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s === '' ? null : s;
  }
  const s = cellToString(raw.value);
  return s === '' ? null : s;
}

/** Parse a level field to a numeric string suitable for Drizzle `numeric` columns. */
export function levelNumeric(
  level: Record<string, FieldValue> | Record<string, string>,
  field: string,
): string | null {
  const raw = level[field];
  if (raw == null) return null;
  const source = typeof raw === 'string' ? raw : raw.value;
  const n = normalizeNumber(source);
  return n == null ? null : String(n);
}

export function itemText(item: Record<string, unknown>, field: string): string | null {
  const s = cellToString(item[field]);
  return s === '' ? null : s;
}

export function itemNumeric(item: Record<string, unknown>, field: string): string | null {
  const n = normalizeNumber(item[field]);
  return n == null ? null : String(n);
}

export function stripInternalKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}
