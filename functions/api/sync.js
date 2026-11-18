// Cloudflare Pages Function：Supabase 同步中转
// 路由：POST /api/sync
// 作用：国内网络无法直连 *.supabase.co，由 Cloudflare 边缘转发两个 RPC。
// 这里只使用 publishable（公开）key，数据访问仍由长同步码保护。

const SUPABASE_URL = 'https://ruscbaukapxxlzwburre.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XSUF6UfFcymamNqBdJwWkQ_YPieFolG';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet() {
  return json({ ok: true, service: 'vocab-drill-sync' });
}

export async function onRequestPost({ request }) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 2 * 1024 * 1024) return json({ error: 'payload too large' }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (code.length < 16 || code.length > 128) return json({ error: 'invalid sync code' }, 400);

  let rpc;
  let payload;
  if (body.action === 'get') {
    rpc = 'vocab_sync_get';
    payload = { p_code: code };
  } else if (body.action === 'put') {
    if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      return json({ error: 'invalid payload' }, 400);
    }
    if (body.revision !== null && !Number.isInteger(body.revision)) {
      return json({ error: 'invalid revision' }, 400);
    }
    rpc = 'vocab_sync_put';
    payload = { p_code: code, p_payload: body.payload, p_revision: body.revision };
  } else {
    return json({ error: 'invalid action' }, 400);
  }

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    return json({ error: 'upstream unavailable' }, 502);
  }

  const text = await res.text();
  return new Response(text || 'null', {
    status: res.status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
