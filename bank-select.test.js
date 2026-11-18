'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./bank-select.js');

const units = [
  {
    id: 'u1',
    name: 'Unit 1',
    book: '六上',
    words: [
      ['one', '一'],
      ['two', '二'],
      ['three', '三'],
      ['four', '四'],
      ['five', '五'],
    ],
  },
  {
    id: 'u2',
    name: 'Unit 2',
    book: '六上',
    words: [
      ['three', '三'],
      ['six', '六'],
    ],
  },
];

test('normalizeRange 夹取越界并交换颠倒的起止', () => {
  assert.deepEqual(S.normalizeRange(5, 1, 3), { start: 1, end: 3 });
  assert.deepEqual(S.normalizeRange(5, -4, 99), { start: 0, end: 4 });
  assert.deepEqual(S.normalizeRange(5, 4, 2), { start: 2, end: 4 });
  assert.deepEqual(S.normalizeRange(5, NaN, NaN), { start: 0, end: 4 });
  assert.deepEqual(S.normalizeRange(0, 0, 0), { start: 0, end: -1 });
});

test('collectItems 只取单元内指定范围', () => {
  const items = S.collectItems(units, { u1: { start: 1, end: 3 } });
  assert.deepEqual(items.map((i) => i.en), ['two', 'three', 'four']);
});

test('整单元等价于全范围，且跨单元重叠词只保留一次', () => {
  const items = S.collectItems(units, { u1: true, u2: { start: 0, end: 1 } });
  assert.deepEqual(items.map((i) => i.en), ['one', 'two', 'three', 'four', 'five', 'six']);
});

test('isFull 识别整单元与部分范围', () => {
  assert.equal(S.isFull(units[0], true), true);
  assert.equal(S.isFull(units[0], [0, 4]), true);
  assert.equal(S.isFull(units[0], { start: 0, end: 3 }), false);
  assert.equal(S.isFull(units[1], { start: 0, end: 1 }), true);
});

test('未选中的单元不会进入结果', () => {
  assert.deepEqual(S.collectItems(units, {}), []);
});
