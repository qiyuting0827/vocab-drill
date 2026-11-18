import {
  onRequestGet,
  onRequestOptions,
  onRequestPost,
} from './functions/api/sync.js';

// Cloudflare Pages 高级模式：
// - /api/sync 交给同步中转
// - 其他路径按静态资源返回
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/sync') {
      if (request.method === 'OPTIONS') return onRequestOptions();
      if (request.method === 'GET') return onRequestGet();
      if (request.method === 'POST') return onRequestPost({ request });
      return new Response(JSON.stringify({ error: 'method not allowed' }), {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
