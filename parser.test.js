const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./parser.js');

function one(line) {
  const { items, skipped } = P.parseWordList(line);
  assert.equal(skipped.length, 0, '不应有无法识别的行: ' + line);
  assert.equal(items.length, 1, '应解析出 1 个单词: ' + line);
  return items[0];
}

test('常见分隔符：空格 / Tab / 逗号 / 全角逗号 / 短横线 / 冒号', () => {
  const cases = [
    ['apple 苹果', 'apple', '苹果'],
    ['apple\t苹果', 'apple', '苹果'],
    ['apple,苹果', 'apple', '苹果'],
    ['apple，苹果', 'apple', '苹果'],
    ['apple - 苹果', 'apple', '苹果'],
    ['apple: 苹果', 'apple', '苹果'],
    ['apple — 苹果', 'apple', '苹果'],
    ['apple=苹果', 'apple', '苹果'],
  ];
  for (const [line, en, zh] of cases) {
    const item = one(line);
    assert.equal(item.en, en, line);
    assert.equal(item.zh, zh, line);
  }
});

test('中文在前也能识别', () => {
  const item = one('苹果 apple');
  assert.equal(item.en, 'apple');
  assert.equal(item.zh, '苹果');
});

test('去掉序号、项目符号与词性标记', () => {
  assert.equal(one('1. apple 苹果').en, 'apple');
  assert.equal(one('2) apple 苹果').en, 'apple');
  assert.equal(one('- apple 苹果').en, 'apple');
  const item = one('apple n. 苹果');
  assert.equal(item.en, 'apple');
  assert.equal(item.zh, '苹果');
});

test('英文短语与中文多义项', () => {
  const item = one('take off 起飞；脱下');
  assert.equal(item.en, 'take off');
  assert.equal(item.zh, '起飞；脱下');
});

test('英文括注与中文括注', () => {
  const item = one('apple（苹果）');
  assert.equal(item.en, 'apple');
  assert.equal(item.zh, '苹果');

  const item2 = one('苹果（apple）');
  assert.equal(item2.en, 'apple');
  assert.equal(item2.zh, '苹果');
});

test('斜杠分隔的多个英文答案都接受', () => {
  const item = one('look after / take care of 照顾');
  assert.deepEqual(item.answers, ['look after', 'take care of']);
  assert.ok(P.checkAnswer('look after', item));
  assert.ok(P.checkAnswer('take care of', item));
  assert.ok(P.checkAnswer('  TAKE   CARE OF  ', item));
  assert.ok(!P.checkAnswer('take care', item));
});

test('大小写、空格、全角与弯引号都能接受', () => {
  const item = one("don't 不要");
  assert.ok(P.checkAnswer("DON'T", item));
  assert.ok(P.checkAnswer('don’t', item));
  assert.ok(P.checkAnswer('ｄｏｎ＇ｔ', item));
  assert.ok(P.checkAnswer('  don\'t  ', item));
  assert.ok(!P.checkAnswer('do not', item));
});

test('带音标、词性括注的单词表', () => {
  const a = one('abandon /əˈbændən/ v. 放弃');
  assert.equal(a.en, 'abandon');
  assert.equal(a.zh, '放弃');

  const b = one('abandon [动] 放弃');
  assert.equal(b.en, 'abandon');
  assert.equal(b.zh, '放弃');

  const c = one('abandon 放弃 /əˈbændən/');
  assert.equal(c.zh, '放弃');

  const d = one('abandon (v.) 放弃');
  assert.equal(d.en, 'abandon');
  assert.equal(d.zh, '放弃');
});

test('无法识别的行会被跳过', () => {
  const result = P.parseWordList('apple 苹果\n\n只是一句中文\nEnglish only\nbanana 香蕉');
  assert.equal(result.items.length, 2);
  assert.deepEqual(
    result.skipped.map((s) => s.lineNo),
    [3, 4],
  );
});

test('重复条目会去重', () => {
  const result = P.parseWordList('apple 苹果\napple 苹果\nbanana 香蕉');
  assert.equal(result.items.length, 2);
});

test('空输入返回空结果', () => {
  assert.deepEqual(P.parseWordList(''), { items: [], skipped: [] });
});
