// Netlify Function：Supabase 同步中转
// 路由：POST /.netlify/functions/sync
// 只使用 publishable（公开）key，数据访问由长同步码保护。

const SUPABASE_URL = 'https://ruscbaukapxxlzwburre.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XSUF6UfFcymamNqBdJwWkQ_YPieFolG';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(statusCode, data) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod === 'GET') {
    return json(200, { ok: true, service: 'vocab-drill-sync' });
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method not allowed' });
  }

  const raw = event.body || '';
  if (raw.length > 2 * 1024 * 1024) return json(413, { error: 'payload too large' });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (code.length < 16 || code.length > 128) {
    return json(400, { error: 'invalid sync code' });
  }

  let rpc;
  let payload;
  if (body.action === 'get') {
    rpc = 'vocab_sync_get';
    payload = { p_code: code };
  } else if (body.action === 'put') {
    if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      return json(400, { error: 'invalid payload' });
    }
    if (body.revision !== null && !Number.isInteger(body.revision)) {
      return json(400, { error: 'invalid revision' });
    }
    rpc = 'vocab_sync_put';
    payload = { p_code: code, p_payload: body.payload, p_revision: body.revision };
  } else {
    return json(400, { error: 'invalid action' });
  }

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return json(502, { error: 'upstream unavailable' });
  }

  const text = await res.text();
  return {
    statusCode: res.status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
    body: text || 'null',
  };
};
