/**
 * Map File3 processed rows → letters insert shapes.
 * File3 never creates Kootaj parents.
 */

import type { File3ProcessedRow } from '../types.js';

export interface File3LetterInsert {
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
}

/** Map a File3 row with a valid letter number into a letters insert payload. */
export function mapFile3Letter(row: File3ProcessedRow): File3LetterInsert {
  if (!row.letter_number) {
    throw new Error('mapFile3Letter requires a valid letter_number');
  }

  return {
    letterNumber: row.letter_number,
    letterNumberOriginal: row.letter_number_original || null,
    letterDate: row.letter_date,
    letterDateOriginal: row.letter_date_original || null,
    letterDateSource: row.letter_date_source,
    description: row.description || null,
    letterSystemId: row.letter_system_id || null,
    registrar: row.registrar || null,
    extractionMethod: row.extraction.method,
    extractedKootajRaw: row.extraction.extracted_raw,
  };
}
