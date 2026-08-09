import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeKootaj,
  kootajEquals,
  foldDigits,
  extractKootajFromDescription,
  normalizeLetterNumber,
  normalizeLetterDate,
} from '../src/normalize.js';
import { processFile2 } from '../src/file2.js';
import { processFile3 } from '../src/file3.js';
import { processFile1 } from '../src/file1.js';
import { computeSafeAggregates } from '../src/aggregate.js';

describe('Kootaj normalization', () => {
  it('maps Persian, Arabic-Indic, and Latin digits to the same value', () => {
    const a = normalizeKootaj('123456');
    const b = normalizeKootaj('۱۲۳۴۵۶');
    const c = normalizeKootaj('١٢٣٤٥٦');
    const d = normalizeKootaj(123456);
    assert.equal(a.normalized_value, '123456');
    assert.equal(b.normalized_value, '123456');
    assert.equal(c.normalized_value, '123456');
    assert.equal(d.normalized_value, '123456');
    assert.equal(a.original_value, '123456');
    assert.equal(b.original_value, '۱۲۳۴۵۶');
  });

  it('trims whitespace and strips punctuation without mutating originals', () => {
    const r = normalizeKootaj('  128-710  ');
    assert.equal(r.normalized_value, '128710');
    assert.equal(r.original_value, '  128-710  ');
  });

  it('strips leading zeros', () => {
    assert.equal(normalizeKootaj('012345').normalized_value, '12345');
    assert.equal(normalizeKootaj('000').normalized_value, '0');
  });

  it('kootajEquals works across digit scripts', () => {
    assert.equal(kootajEquals('202062', '۲۰۲۰۶۲'), true);
    assert.equal(kootajEquals('202062', '202063'), false);
  });

  it('foldDigits converts mixed scripts', () => {
    assert.equal(foldDigits('۱۴۰۵/۱۷۵۱۳۶'), '1405/175136');
  });
});

describe('Kootaj matching & File2 NEW vs EXISTING', () => {
  function fakeWb(rows) {
    return { sheetNames: ['گزارش اکسل'], sheets: { 'گزارش اکسل': rows } };
  }

  it('classifies EXISTING as SKIPPED and NEW correctly', () => {
    const file1Set = new Map([
      ['83334', {}],
      ['128710', {}],
    ]);
    const wb = fakeWb([
      { 'شماره مجوز بارگيري': '83334', 'نام کالا': 'سرور', 'وزن ناخالص': '30', 'ارزش ریالی اظهارنامه': '21000000' },
      { 'شماره مجوز بارگيري': '۲۰۸۸۵۶', 'نام کالا': 'جدید', 'وزن ناخالص': '10', 'ارزش ریالی اظهارنامه': '100' },
      { 'شماره مجوز بارگیری': '128710', 'نام کالا': 'کویل', 'وزن ناخالص': '824', 'ارزش ریالی اظهارنامه': '22936452000' },
      { 'شماره مجوز بارگیری': '128710', 'نام کالا': 'هولدر', 'وزن ناخالص': '160', 'ارزش ریالی اظهارنامه': '22936452000' },
    ]);
    const result = processFile2(wb, file1Set);
    assert.equal(result.existing_kootajs, 2);
    assert.equal(result.new_kootajs, 1);
    assert.equal(result.new[0].normalized_kootaj, '208856');
    assert.equal(result.existing.find((k) => k.normalized_kootaj === '128710').row_count, 2);
    assert.ok(result.existing.every((k) => k.classification === 'EXISTING_SKIPPED'));
  });
});

describe('Duplicate detection & multiple-row grouping', () => {
  it('groups File1 multi-item rows under one Kootaj', () => {
    const rows = [
      {
        'شماره کوتاژ': '128710',
        'تاریخ کوتاژ': '1401/2/5',
        'کد تعرفه': '85113090',
        'شرح کالا': 'کویل',
        'وزن ناخالص': '824',
        'ارزش ریالی کالا': '22936452000',
        'ارزش ارزی اظهارنامه': '506100',
        'شماره قبض انبار': '144381',
        'حقوق استنباطی گمرک': '21112951200',
        'محل ارزیابی': 'گمرک کیش',
        'مرحله اظهارنامه': 'درب خروج',
        'واریزی اموال تملیکی': '0',
        'وضعیت کالا': 'خارج نشده',
        'تاریخ اعلام به اموال تملیکی': '',
        'تاریخ خروج کالا  از گمرک توسط اموال تملیکی': '',
      },
      {
        'شماره کوتاژ': '128710',
        'تاریخ کوتاژ': '1401/2/5',
        'کد تعرفه': '73251000',
        'شرح کالا': 'هولدر',
        'وزن ناخالص': '160',
        'ارزش ریالی کالا': '22936452000',
        'ارزش ارزی اظهارنامه': '506100',
        'شماره قبض انبار': '144381',
        'حقوق استنباطی گمرک': '21112951200',
        'محل ارزیابی': 'گمرک کیش',
        'مرحله اظهارنامه': 'درب خروج',
        'واریزی اموال تملیکی': '0',
        'وضعیت کالا': 'خارج نشده',
        'تاریخ اعلام به اموال تملیکی': '',
        'تاریخ خروج کالا  از گمرک توسط اموال تملیکی': '',
      },
      {
        'شماره کوتاژ': '83334',
        'تاریخ کوتاژ': '1401/3/1',
        'کد تعرفه': '84715020',
        'شرح کالا': 'سرور',
        'وزن ناخالص': '30',
        'ارزش ریالی کالا': '21000000',
        'ارزش ارزی اظهارنامه': '500',
        'شماره قبض انبار': '106620',
        'حقوق استنباطی گمرک': '',
        'محل ارزیابی': 'گمرک کیش',
        'مرحله اظهارنامه': 'درب خروج',
        'واریزی اموال تملیکی': '0',
        'وضعیت کالا': 'خارج نشده',
        'تاریخ اعلام به اموال تملیکی': '',
        'تاریخ خروج کالا  از گمرک توسط اموال تملیکی': '',
      },
    ];
    const wb = { sheetNames: ['متروکه کلی'], sheets: { 'متروکه کلی': rows } };
    const result = processFile1(wb);
    assert.equal(result.physical_rows, 3);
    assert.equal(result.unique_kootajs, 2);
    assert.equal(result.kootajs_with_multiple_rows, 1);
    const multi = result.kootajSet.get('128710');
    assert.equal(multi.row_count, 2);
    assert.equal(multi.warehouse_receipt_count, 1);
    assert.equal(multi.items.length, 2);
    // value never summed
    assert.equal(multi.aggregates['ارزش ریالی کالا'].value, 22936452000);
    assert.equal(multi.aggregates['ارزش ریالی کالا'].would_be_wrong_sum, 22936452000 * 2);
    assert.equal(multi.aggregates['وزن ناخالص'].sum, 984);
  });

  it('does not SUM declaration totals', () => {
    const rows = [
      { 'ارزش ریالی اظهارنامه': '1000', 'وزن ناخالص': '10', 'تعداد بسته': '2' },
      { 'ارزش ریالی اظهارنامه': '1000', 'وزن ناخالص': '20', 'تعداد بسته': '3' },
    ];
    const agg = computeSafeAggregates(rows, {
      weightFields: ['وزن ناخالص'],
      packageFields: ['تعداد بسته'],
      valueFields: ['ارزش ریالی اظهارنامه'],
    });
    assert.equal(agg['ارزش ریالی اظهارنامه'].value, 1000);
    assert.equal(agg['ارزش ریالی اظهارنامه'].would_be_wrong_sum, 2000);
    assert.equal(agg['وزن ناخالص'].sum, 30);
    assert.equal(agg['تعداد بسته'].sum, 5);
  });
});

describe('File 3 Kootaj extraction from Description', () => {
  it('extracts from the confirmed labeled pattern (real examples)', () => {
    const samples = [
      'اظهارنامه متروکه به شماره کوتاژ 202062',
      'اظهارنامه متروکه به شماره کوتاژ 202071',
      'اظهارنامه متروکه به شماره کوتاژ 184402',
      'اظهارنامه متروکه به شماره کوتاژ ۲۰۲۷۷۰',
    ];
    for (const s of samples) {
      const r = extractKootajFromDescription(s);
      assert.equal(r.ok, true);
      assert.ok(r.normalized_value);
      assert.equal(r.method, 'labeled_shomare_kootaj');
    }
    assert.equal(extractKootajFromDescription(samples[0]).normalized_value, '202062');
    assert.equal(extractKootajFromDescription(samples[3]).normalized_value, '202770');
  });

  it('fails cleanly on empty / unmatched text', () => {
    assert.equal(extractKootajFromDescription('').ok, false);
    assert.equal(extractKootajFromDescription('بدون الگو').ok, false);
  });
});

describe('Letter number & date parsing', () => {
  it('normalizes شماره ثبت with invisible junk (real-shaped samples)', () => {
    const n = normalizeLetterNumber('1405\u009d/\u009d175136');
    assert.ok(n.includes('1405'));
    assert.ok(n.includes('175136'));
    assert.equal(normalizeLetterNumber(''), null);
    assert.equal(normalizeLetterNumber(null), null);
  });

  it('normalizes letter dates and strips bidi marks', () => {
    const d = normalizeLetterDate('\u202A1405/02/16ش 14:38');
    assert.ok(d.startsWith('1405'));
    assert.equal(normalizeLetterDate(''), null);
  });
});

describe('Multiple-letter conflict detection', () => {
  function fakeF3(rows) {
    return { sheetNames: ['List'], sheets: { List: rows } };
  }

  it('ignores draft rows and accepts exactly one valid letter', () => {
    const unified = new Set(['202062']);
    const wb = fakeF3([
      {
        'شناسه نامه': '19383241',
        'شماره ثبت': '',
        'تاریخ ثبت': '',
        'تاریخ تهیه': '1405/02/13ش 11:04',
        'توضیحات': 'اظهارنامه متروکه به شماره کوتاژ 202062',
      },
      {
        'شناسه نامه': '19409686',
        'شماره ثبت': '1405/175136',
        'تاریخ ثبت': '1405/02/16ش 14:38',
        'تاریخ تهیه': '1405/02/16ش 13:51',
        'توضیحات': 'اظهارنامه متروکه به شماره کوتاژ 202062',
      },
    ]);
    const result = processFile3(wb, unified);
    assert.equal(result.conflicts_count, 0);
    assert.equal(result.kootajs_with_valid_letters, 1);
    assert.equal(result.valid_letters[0].letter_number, '1405/175136');
    assert.equal(result.valid_letters[0].draft_rows_ignored, 1);
  });

  it('flags CONFLICT when two distinct valid letters exist', () => {
    const unified = new Set(['202062']);
    const wb = fakeF3([
      {
        'شناسه نامه': '1',
        'شماره ثبت': '1405/111',
        'تاریخ ثبت': '1405/01/01',
        'تاریخ تهیه': '',
        'توضیحات': 'اظهارنامه متروکه به شماره کوتاژ 202062',
      },
      {
        'شناسه نامه': '2',
        'شماره ثبت': '1405/222',
        'تاریخ ثبت': '1405/01/02',
        'تاریخ تهیه': '',
        'توضیحات': 'اظهارنامه متروکه به شماره کوتاژ 202062',
      },
    ]);
    const result = processFile3(wb, unified);
    assert.equal(result.conflicts_count, 1);
    assert.equal(result.conflicts[0].candidate_count, 2);
  });

  it('marks UNMATCHED when Kootaj is not in unified set (no auto-create)', () => {
    const unified = new Set(['100']);
    const wb = fakeF3([
      {
        'شناسه نامه': '9',
        'شماره ثبت': '1405/1',
        'تاریخ ثبت': '1405/01/01',
        'تاریخ تهیه': '',
        'توضیحات': 'اظهارنامه متروکه به شماره کوتاژ 999999',
      },
    ]);
    const result = processFile3(wb, unified);
    assert.equal(result.unmatched_rows, 1);
    assert.equal(result.matched_rows, 0);
  });
});
