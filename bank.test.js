'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const bank = require('./words.js');

test('内置词库包含 6 册 48 个单元', () => {
  assert.equal(bank.books.length, 6);
  assert.equal(bank.units.length, 48);
  assert.deepEqual(
    bank.books.map((b) => b.name),
    ['六上', '六下', '七上', '七下', '八上', '九全']
  );
});

test('词条总数为 2168，且单元 id 唯一', () => {
  const total = bank.units.reduce((n, u) => n + u.words.length, 0);
  assert.equal(total, 2168);
  assert.equal(new Set(bank.units.map((u) => u.id)).size, bank.units.length);
});

test('每个词条都有英文和中文', () => {
  const bad = [];
  bank.units.forEach((u) => {
    u.words.forEach((word) => {
      const [en, zh] = word;
      if (!en || !/[A-Za-z]/.test(en)) bad.push([u.id, en, zh]);
      if (!zh || !/[\u4e00-\u9fff]/.test(zh)) bad.push([u.id, en, zh]);
      if (word.length > 3) bad.push([u.id, '词条格式过长', word]);
    });
  });
  assert.deepEqual(bad, []);
});

test('多写法词条带有可选答案', () => {
  const multi = [];
  bank.units.forEach((u) => {
    u.words.forEach((word) => {
      if (word.length === 3) multi.push({ unit: u.id, en: word[0], answers: word[2] });
    });
  });
  assert.equal(multi.length, 10);
  multi.forEach((item) => {
    assert.ok(Array.isArray(item.answers) && item.answers.length >= 2, item.en);
    assert.equal(new Set(item.answers.map((a) => a.toLowerCase())).size, item.answers.length);
    item.answers.forEach((a) => assert.match(a, /[A-Za-z]/));
  });
  const lot = multi.find((m) => m.en === 'a lot of / lots of');
  assert.deepEqual(lot.answers, ['a lot of', 'lots of']);
});

test('每个单元的册别都能在 books 中找到', () => {
  const names = new Set(bank.books.map((b) => b.name));
  bank.units.forEach((u) => {
    assert.ok(names.has(u.book), u.id + ' 的册别无效：' + u.book);
  });
});

test('词条按英文不区分大小写判分', () => {
  const Parser = require('./parser.js');
  const unit = bank.units[0];
  const [en, zh] = unit.words[0];
  assert.equal(Parser.checkAnswer(en.toUpperCase(), { en, zh, answers: [en] }), true);
});
