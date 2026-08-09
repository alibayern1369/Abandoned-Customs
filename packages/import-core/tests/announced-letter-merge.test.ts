/**
 * File1 announced-to-tamlik → letter attach via upload merge.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideLetterAttach } from '@metrookeh/domain';
import { parseAnnouncedToTamlik } from '../src/index.js';

describe('announced letter merge decisions', () => {
  it('ATTACH when kootaj has no letter and cell has serial', () => {
    const parsed = parseAnnouncedToTamlik('1403/1386642 1403/09/20ش 12:33');
    const decision = decideLetterAttach({
      kootajExists: true,
      hasValidLetterNumber: parsed.hasValidLetterNumber,
      existingLetterNumber: null,
      incomingLetterNumber: parsed.letterNumber,
    });
    assert.equal(decision.action, 'ATTACH');
  });

  it('IDEMPOTENT_SKIP when same serial already attached', () => {
    const parsed = parseAnnouncedToTamlik('1401/175788');
    const decision = decideLetterAttach({
      kootajExists: true,
      hasValidLetterNumber: true,
      existingLetterNumber: '1401/175788',
      incomingLetterNumber: parsed.letterNumber,
    });
    assert.equal(decision.action, 'IDEMPOTENT_SKIP');
  });

  it('CONFLICT when a different serial arrives later', () => {
    const parsed = parseAnnouncedToTamlik('1403/999999');
    const decision = decideLetterAttach({
      kootajExists: true,
      hasValidLetterNumber: true,
      existingLetterNumber: '1401/175788',
      incomingLetterNumber: parsed.letterNumber,
    });
    assert.equal(decision.action, 'CONFLICT_REVIEW');
  });

  it('does not attach when cell is date-only (without letter)', () => {
    const parsed = parseAnnouncedToTamlik('1403/09/20ش 12:33');
    assert.equal(parsed.hasValidLetterNumber, false);
    const decision = decideLetterAttach({
      kootajExists: true,
      hasValidLetterNumber: parsed.hasValidLetterNumber,
      existingLetterNumber: null,
      incomingLetterNumber: parsed.letterNumber,
    });
    assert.equal(decision.action, 'DRAFT_IGNORE');
  });
});
