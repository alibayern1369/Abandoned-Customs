/**
 * Parity tests: import-core must match @metrookeh/validator on the same fixtures.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import {
  normalizeKootaj,
  foldDigits,
  extractKootajFromDescription,
  normalizeLetterNumber,
  processFile1,
  processFile2,
  processFile3,
  computeSafeAggregates,
} from '../src/index.js';

const validatorRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../validator/src',
);

async function loadValidator(name: string) {
  return import(pathToFileURL(path.join(validatorRoot, name)).href);
}

const vNormalize = await loadValidator('normalize.js');
const vFile1 = await loadValidator('file1.js');
const vFile2 = await loadValidator('file2.js');
const vFile3 = await loadValidator('file3.js');
const vAggregate = await loadValidator('aggregate.js');

describe('Parity with @metrookeh/validator', () => {
  it('normalizeKootaj matches on mixed scripts and punctuation', () => {
    const samples = ['123456', '۱۲۳۴۵۶', '١٢٣٤٥٦', '  128-710  ', '012345', '000', 123456, null, ''];
    for (const s of samples) {
      assert.deepEqual(normalizeKootaj(s), vNormalize.normalizeKootaj(s));
    }
  });

  it('foldDigits / letter number / extraction match', () => {
    assert.equal(foldDigits('۱۴۰۵/۱۷۵۱۳۶'), vNormalize.foldDigits('۱۴۰۵/۱۷۵۱۳۶'));
    assert.equal(
      normalizeLetterNumber('1405\u009d/\u009d175136'),
      vNormalize.normalizeLetterNumber('1405\u009d/\u009d175136'),
    );
    const desc = 'اظهارنامه متروکه به شماره کوتاژ ۲۰۲۷۷۰';
    assert.deepEqual(
      extractKootajFromDescription(desc),
      vNormalize.extractKootajFromDescription(desc),
    );
  });

  it('computeSafeAggregates matches', () => {
    const rows = [
      { 'ارزش ریالی اظهارنامه': '1000', 'وزن ناخالص': '10', 'تعداد بسته': '2' },
      { 'ارزش ریالی اظهارنامه': '1000', 'وزن ناخالص': '20', 'تعداد بسته': '3' },
    ];
    const opts = {
      weightFields: ['وزن ناخالص'],
      packageFields: ['تعداد بسته'],
      valueFields: ['ارزش ریالی اظهارنامه'],
    };
    assert.deepEqual(computeSafeAggregates(rows, opts), vAggregate.computeSafeAggregates(rows, opts));
  });

  it('processFile1 matches on multi-row fixture', () => {
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
    ];
    const wb = { sheetNames: ['متروکه کلی'], sheets: { 'متروکه کلی': rows } };
    const ours = processFile1(wb);
    const theirs = vFile1.processFile1(wb);
    assert.equal(ours.unique_kootajs, theirs.unique_kootajs);
    assert.equal(ours.physical_rows, theirs.physical_rows);
    assert.deepEqual(ours.kootajs[0].aggregates, theirs.kootajs[0].aggregates);
    assert.deepEqual(ours.kootajs[0].items, theirs.kootajs[0].items);
  });

  it('processFile2 NEW/SKIP counts match', () => {
    const file1Set = new Map([
      ['83334', {}],
      ['128710', {}],
    ]);
    const wb = {
      sheetNames: ['گزارش اکسل'],
      sheets: {
        'گزارش اکسل': [
          {
            'شماره مجوز بارگيري': '83334',
            'نام کالا': 'سرور',
            'وزن ناخالص': '30',
            'ارزش ریالی اظهارنامه': '21000000',
          },
          {
            'شماره مجوز بارگيري': '۲۰۸۸۵۶',
            'نام کالا': 'جدید',
            'وزن ناخالص': '10',
            'ارزش ریالی اظهارنامه': '100',
          },
          {
            'شماره مجوز بارگیری': '128710',
            'نام کالا': 'کویل',
            'وزن ناخالص': '824',
            'ارزش ریالی اظهارنامه': '22936452000',
          },
        ],
      },
    };
    const ours = processFile2(wb, file1Set);
    const theirs = vFile2.processFile2(wb, file1Set);
    assert.equal(ours.existing_kootajs, theirs.existing_kootajs);
    assert.equal(ours.new_kootajs, theirs.new_kootajs);
    assert.equal(ours.new[0].normalized_kootaj, theirs.new[0].normalized_kootaj);
  });

  it('processFile3 conflict/match outcomes match', () => {
    const unified = new Set(['202062']);
    const wb = {
      sheetNames: ['List'],
      sheets: {
        List: [
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
        ],
      },
    };
    const ours = processFile3(wb, unified);
    const theirs = vFile3.processFile3(wb, unified);
    assert.equal(ours.conflicts_count, theirs.conflicts_count);
    assert.equal(ours.matched_rows, theirs.matched_rows);
    assert.equal(ours.kootajs_with_valid_letters, theirs.kootajs_with_valid_letters);
  });
});
