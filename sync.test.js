'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./sync.js');

function reply(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    text: () => Promise.resolve(data === undefined ? '' : JSON.stringify(data)),
  });
}

test('同步码：长度、字符集、格式化与归一化', () => {
  const code = S.generateCode();
  assert.equal(code.length, 25);
  assert.match(code, /^[a-z2-9]+$/);
  assert.equal(S.normalizeCode(' ABCD-EFGH 2345 '), 'abcdefgh2345');
  assert.equal(S.formatCode('abcdefghij'), 'abcde fghij');
});

test('负载：清洗姓名、历史与错题，限制历史条数', () => {
  const history = Array.from({ length: 60 }, (_, i) => ({ at: '2026-01-01T00:00:0' + (i % 10) + 'Z', n: i }));
  const payload = S.normalizePayload({
    students: [' 张三 ', '张三', '', '李四'],
    history,
    mistakes: {
      张三: [
        { en: 'apple', zh: '苹果', wrong: '2', answers: [] },
        { en: '', zh: '' },
      ],
      __proto__: [{ en: 'x', zh: '坏' }],
    },
  });
  assert.deepEqual(payload.students, ['张三', '李四']);
  assert.equal(payload.history.length, 50);
  assert.equal(payload.mistakes['张三'].length, 1);
  assert.equal(payload.mistakes['张三'][0].wrong, 2);
  assert.deepEqual(payload.mistakes['张三'][0].answers, ['apple']);
  assert.equal(Object.prototype.hasOwnProperty.call(payload.mistakes, '__proto__'), false);
});

test('合并：名单取并集、历史去重按时间倒序', () => {
  const local = {
    students: ['张三'],
    history: [
      { at: '2026-01-01T10:00:00Z', student: '张三', mode: 'a', total: 1 },
      { at: '2026-01-01T09:00:00Z', student: '张三', mode: 'b', total: 1 },
    ],
    mistakes: {},
  };
  const remote = {
    students: ['张三', '李四'],
    history: [
      { at: '2026-01-01T10:00:00Z', student: '张三', mode: 'a', total: 1 },
      { at: '2026-01-01T11:00:00Z', student: '李四', mode: 'c', total: 2 },
    ],
    mistakes: {},
  };
  const merged = S.mergePayload(local, remote);
  assert.deepEqual(merged.students, ['张三', '李四']);
  assert.equal(merged.history.length, 3);
  assert.equal(merged.history[0].student, '李四');
});

test('合并错题：同一词以较新的 lastAt 为准，时间相同取较大计数', () => {
  const merged = S.mergePayload(
    {
      students: [],
      history: [],
      mistakes: {
        张三: [
          { en: 'apple', zh: '苹果', wrong: 3, right: 0, streak: 0, lastAt: '2026-01-02T00:00:00Z' },
          { en: 'pear', zh: '梨', wrong: 1, right: 2, streak: 1, lastAt: '2026-01-02T00:00:00Z' },
        ],
      },
    },
    {
      students: [],
      history: [],
      mistakes: {
        张三: [
          { en: 'APPLE', zh: '苹果', wrong: 1, right: 1, streak: 0, lastAt: '2026-01-01T00:00:00Z' },
          { en: 'pear', zh: '梨', wrong: 2, right: 0, streak: 0, lastAt: '2026-01-02T00:00:00Z' },
        ],
      },
    }
  );
  const list = merged.mistakes['张三'];
  assert.equal(list.length, 2);
  const apple = list.find((m) => m.en === 'apple');
  const pear = list.find((m) => m.en === 'pear');
  assert.equal(apple.wrong, 3);
  assert.equal(pear.wrong, 2);
  assert.equal(pear.right, 2);
  assert.equal(pear.streak, 1);
});

test('拉取：返回负载与版本；空响应返回 null', async () => {
  const calls = [];
  const fetchImpl = (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    return reply({ payload: { students: ['张三'] }, revision: 2, updatedAt: 'now' });
  };
  const result = await S.pull('abcdefghijklmnop', fetchImpl);
  assert.equal(result.revision, 2);
  assert.deepEqual(result.payload.students, ['张三']);
  assert.match(calls[0].url, /\/\?p=%2Frest%2Fv1%2Frpc%2Fvocab_sync_get$/);
  assert.match(calls[0].headers.apikey, /^sb_publishable_/);
  assert.equal(
    calls[0].headers.Authorization,
    'Bearer ' + calls[0].headers.apikey
  );
  assert.deepEqual(calls[0].body, { p_code: 'abcdefghijklmnop' });

  const empty = await S.pull('abcdefghijklmnop', () => reply(null));
  assert.equal(empty, null);
});

test('上传：提交 revision，冲突可识别', async () => {
  const fetchImpl = (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.match(url, /vocab_sync_put$/);
    assert.deepEqual(body, {
      p_code: 'abcdefghijklmnop',
      p_payload: { students: [] },
      p_revision: 3,
    });
    return reply({ payload: body.p_payload, revision: 4, updatedAt: 'now' });
  };
  const result = await S.push('abcdefghijklmnop', { students: [] }, 3, fetchImpl);
  assert.equal(result.revision, 4);

  const conflictFetch = () =>
    reply({ code: '40001', message: 'revision conflict' }, false, 400);
  await assert.rejects(
    () => S.push('abcdefghijklmnop', { students: [] }, 1, conflictFetch),
    (err) => S.isConflict(err)
  );
});
