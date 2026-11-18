'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const relay = require('./netlify/functions/sync.js');

function event(method, body) {
  return {
    httpMethod: method,
    body: body == null ? '' : JSON.stringify(body),
    headers: {},
  };
}

test('中转：GET 健康检查与 OPTIONS 预检', async () => {
  const get = await relay.handler(event('GET'));
  assert.equal(get.statusCode, 200);
  assert.equal(JSON.parse(get.body).ok, true);

  const options = await relay.handler(event('OPTIONS'));
  assert.equal(options.statusCode, 204);
  assert.equal(options.headers['Access-Control-Allow-Origin'], '*');
});

test('中转：非法请求被拒绝', async () => {
  assert.equal((await relay.handler(event('PUT'))).statusCode, 405);
  assert.equal((await relay.handler({ httpMethod: 'POST', body: '{' })).statusCode, 400);
  assert.equal(
    (await relay.handler(event('POST', { action: 'get', code: 'short' }))).statusCode,
    400
  );
  assert.equal(
    (await relay.handler(event('POST', { action: 'bad', code: 'abcdefghijklmnop' }))).statusCode,
    400
  );
  assert.equal(
    (await relay.handler(event('POST', { action: 'put', code: 'abcdefghijklmnop', payload: [] }))).statusCode,
    400
  );
});

test('中转：转发 get/put 到 Supabase RPC', async () => {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return {
      status: 200,
      text: async () => JSON.stringify({ payload: { students: ['张三'] }, revision: 3 }),
    };
  };
  try {
    const got = await relay.handler(
      event('POST', { action: 'get', code: 'abcdefghijklmnopqrst' })
    );
    assert.equal(got.statusCode, 200);
    assert.equal(calls[0].url.endsWith('/rpc/vocab_sync_get'), true);
    assert.deepEqual(calls[0].body, { p_code: 'abcdefghijklmnopqrst' });

    const put = await relay.handler(
      event('POST', {
        action: 'put',
        code: 'abcdefghijklmnopqrst',
        payload: { students: [] },
        revision: 3,
      })
    );
    assert.equal(put.statusCode, 200);
    assert.equal(calls[1].url.endsWith('/rpc/vocab_sync_put'), true);
    assert.equal(calls[1].body.p_revision, 3);
  } finally {
    global.fetch = original;
  }
});

test('中转：上游不可用时返回 502', async () => {
  const original = global.fetch;
  global.fetch = async () => {
    throw new Error('network');
  };
  try {
    const res = await relay.handler(
      event('POST', { action: 'get', code: 'abcdefghijklmnopqrst' })
    );
    assert.equal(res.statusCode, 502);
  } finally {
    global.fetch = original;
  }
});
