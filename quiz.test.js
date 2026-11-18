const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWordList } = require('./parser.js');
const Q = require('./quiz.js');

const ITEMS = parseWordList('apple 苹果\nbanana 香蕉\ncherry 樱桃').items;

test('顺序模式按原顺序出题', () => {
  const s = Q.createSession(ITEMS, { shuffle: false });
  assert.equal(Q.current(s).en, 'apple');
  assert.equal(s.queue.length, 3);
});

test('答对 / 答错 / 跳过 都进入结果', () => {
  const s = Q.createSession(ITEMS, { shuffle: false });

  const r1 = Q.submit(s, 'apple');
  assert.equal(r1.status, 'correct');
  assert.equal(s.phase, 'feedback');
  assert.equal(Q.submit(s, 'apple'), null, '反馈阶段不能重复提交');

  Q.next(s);
  const r2 = Q.submit(s, 'bananna');
  assert.equal(r2.status, 'wrong');
  assert.equal(r2.answers[0], 'banana');

  Q.next(s);
  const r3 = Q.skip(s, '');
  assert.equal(r3.status, 'skipped');
  assert.equal(Q.next(s), false);

  assert.ok(Q.isFinished(s));
  const sum = Q.summary(s);
  assert.deepEqual(
    { total: sum.total, correct: sum.correct, wrong: sum.wrong, skipped: sum.skipped },
    { total: 3, correct: 1, wrong: 1, skipped: 1 },
  );
  assert.equal(sum.mistakes.length, 2);
});

test('空答案不算提交', () => {
  const s = Q.createSession(ITEMS, { shuffle: false });
  assert.deepEqual(Q.submit(s, '   '), { status: 'empty' });
  assert.equal(s.phase, 'answering');
  assert.equal(s.results.length, 0);
});

test('错词重练：只用错词建新会话', () => {
  const s = Q.createSession(ITEMS, { shuffle: false });
  Q.submit(s, 'apple');
  Q.next(s);
  Q.submit(s, 'wrong');
  Q.next(s);
  Q.submit(s, 'cherry');
  Q.next(s);

  const sum = Q.summary(s);
  const retryItems = sum.mistakes.map((m) => ({ en: m.en, zh: m.zh, answers: m.answers }));
  const retry = Q.createSession(retryItems, { shuffle: false });
  assert.equal(retry.queue.length, 1);
  assert.equal(Q.current(retry).en, 'banana');
});

test('正确率按总题数计算', () => {
  const s = Q.createSession(ITEMS, { shuffle: false });
  Q.submit(s, 'apple');
  Q.next(s);
  Q.skip(s, '');
  Q.next(s);
  Q.submit(s, 'banana');
  Q.next(s);
  assert.equal(Q.summary(s).accuracy, 1 / 3);
});

test('会话记录学员姓名', () => {
  const s = Q.createSession(ITEMS, { shuffle: false, student: '  张三  ' });
  assert.equal(s.student, '张三');
  assert.equal(Q.summary(s).student, '张三');
  assert.equal(Q.createSession(ITEMS, { shuffle: false }).student, '');
});
