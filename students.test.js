const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./students.js');

test('parseNames 支持换行、逗号、顿号并去重', () => {
  const names = S.parseNames(' 张三 \n李四,王五，张三、赵六;李四\n\n');
  assert.deepEqual(names, ['张三', '李四', '王五', '赵六']);
});

test('addNames 保留原名单并只返回新增项', () => {
  const result = S.addNames(['张三'], '李四\n张三\n王五');
  assert.deepEqual(result.list, ['张三', '李四', '王五']);
  assert.deepEqual(result.added, ['李四', '王五']);
});

test('removeName 忽略首尾空白与大小写', () => {
  assert.deepEqual(S.removeName(['Amy', '张三'], ' amy '), ['张三']);
});

test('recordResults 记录错词并累加次数', () => {
  const wrong = [{ en: 'apple', zh: '苹果', answers: ['apple'], status: 'wrong' }];
  let book = S.recordResults({}, '张三', wrong, { now: '2026-01-01T00:00:00Z' });
  book = S.recordResults(book, '张三', wrong, { now: '2026-01-02T00:00:00Z' });
  const list = S.listMistakes(book, '张三');
  assert.equal(list.length, 1);
  assert.equal(list[0].wrong, 2);
  assert.equal(list[0].streak, 0);
  assert.equal(list[0].lastAt, '2026-01-02T00:00:00Z');
});

test('错题复习连续答对两次后移出错题本', () => {
  const wrong = [{ en: 'apple', zh: '苹果', answers: ['apple'], status: 'wrong' }];
  let book = S.recordResults({}, '张三', wrong, { now: '2026-01-01T00:00:00Z' });
  const right = [{ en: 'apple', zh: '苹果', answers: ['apple'], status: 'correct' }];

  book = S.recordResults(book, '张三', right, { review: true, now: '2026-01-02T00:00:00Z' });
  assert.equal(S.countMistakes(book, '张三'), 1);
  assert.equal(S.listMistakes(book, '张三')[0].streak, 1);

  book = S.recordResults(book, '张三', right, { review: true, now: '2026-01-03T00:00:00Z' });
  assert.equal(S.countMistakes(book, '张三'), 0);
  assert.equal(book['张三'], undefined);
});

test('普通练习答对不会移除错题，复习答错会重置连对', () => {
  const wrong = [{ en: 'apple', zh: '苹果', answers: ['apple'], status: 'wrong' }];
  const right = [{ en: 'apple', zh: '苹果', answers: ['apple'], status: 'correct' }];
  let book = S.recordResults({}, '张三', wrong);
  book = S.recordResults(book, '张三', right, { review: true });
  book = S.recordResults(book, '张三', right);
  assert.equal(S.listMistakes(book, '张三')[0].streak, 1);
  book = S.recordResults(book, '张三', wrong, { review: true });
  assert.equal(S.listMistakes(book, '张三')[0].streak, 0);
});

test('不同学员的错题本互相隔离，且不修改原对象', () => {
  const wrong = [{ en: 'apple', zh: '苹果', answers: ['apple'], status: 'wrong' }];
  const original = {};
  const book = S.recordResults(original, '张三', wrong);
  assert.deepEqual(original, {});
  assert.equal(S.countMistakes(book, '张三'), 1);
  assert.equal(S.countMistakes(book, '李四'), 0);
});

test('reviewItems 返回可用于出题的单词', () => {
  const wrong = [{ en: 'apple', zh: '苹果', answers: ['apple', 'apples'], status: 'wrong' }];
  const book = S.recordResults({}, '张三', wrong);
  assert.deepEqual(S.reviewItems(book, '张三'), [
    { en: 'apple', zh: '苹果', answers: ['apple', 'apples'] },
  ]);
});

test('removeMistake 与 clearStudent 删除指定记录', () => {
  const wrong = [
    { en: 'apple', zh: '苹果', answers: ['apple'], status: 'wrong' },
    { en: 'pear', zh: '梨', answers: ['pear'], status: 'skipped' },
  ];
  let book = S.recordResults({}, '张三', wrong);
  book = S.removeMistake(book, '张三', 'apple', '苹果');
  assert.deepEqual(
    S.listMistakes(book, '张三').map((e) => e.en),
    ['pear'],
  );
  book = S.clearStudent(book, '张三');
  assert.equal(S.countMistakes(book, '张三'), 0);
});
