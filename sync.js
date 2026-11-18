/*
 * 单词默写 · 云同步客户端
 * 前端只与 Cloudflare Pages Function (/api/sync) 通信，由它转发到 Supabase。
 * 同步码是唯一凭据，长度 26 位，随机生成。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VocabSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_ENDPOINT = 'https://vocab-drill-sync.netlify.app/.netlify/functions/sync';
  var ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
  var MAX_HISTORY = 50;

  function resolveEndpoint() {
    var g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (g && g.VOCAB_SYNC_ENDPOINT) return g.VOCAB_SYNC_ENDPOINT;
    try {
      if (typeof location !== 'undefined' && /(^|\.)netlify\.app$/.test(location.hostname)) {
        return '/.netlify/functions/sync';
      }
    } catch (e) {
      /* ignore */
    }
    return DEFAULT_ENDPOINT;
  }

  function generateCode(len) {
    var size = len || 25;
    var out = '';
    var i;
    var cryptoObj =
      typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto : null;
    if (cryptoObj) {
      var buf = new Uint8Array(size);
      cryptoObj.getRandomValues(buf);
      for (i = 0; i < size; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
    } else {
      for (i = 0; i < size; i += 1) {
        out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      }
    }
    return out;
  }

  function normalizeCode(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function formatCode(code) {
    var raw = normalizeCode(code);
    var parts = [];
    for (var i = 0; i < raw.length; i += 5) parts.push(raw.slice(i, i + 5));
    return parts.join(' ');
  }

  function cleanName(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function badKey(key) {
    return key === '__proto__' || key === 'prototype' || key === 'constructor';
  }

  function normalizePayload(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    var students = [];
    var seen = Object.create(null);
    (Array.isArray(raw.students) ? raw.students : []).forEach(function (name) {
      var clean = cleanName(name);
      var key = clean.toLowerCase();
      if (!clean || seen[key]) return;
      seen[key] = true;
      students.push(clean);
    });

    var history = (Array.isArray(raw.history) ? raw.history : [])
      .filter(function (rec) {
        return rec && typeof rec === 'object' && !Array.isArray(rec);
      })
      .slice(0, MAX_HISTORY)
      .map(function (rec) {
        var copy = {};
        Object.keys(rec).forEach(function (key) {
          if (!badKey(key)) copy[key] = rec[key];
        });
        return copy;
      });

    var mistakes = {};
    if (raw.mistakes && typeof raw.mistakes === 'object' && !Array.isArray(raw.mistakes)) {
      Object.keys(raw.mistakes).forEach(function (name) {
        if (badKey(name)) return;
        var list = raw.mistakes[name];
        if (!Array.isArray(list)) return;
        var out = list
          .filter(function (m) {
            return m && typeof m === 'object';
          })
          .map(function (m) {
            var en = String(m.en == null ? '' : m.en);
            var zh = String(m.zh == null ? '' : m.zh);
            var answers =
              Array.isArray(m.answers) && m.answers.length
                ? m.answers.map(String)
                : [en];
            return {
              en: en,
              zh: zh,
              answers: answers,
              wrong: Math.max(0, parseInt(m.wrong, 10) || 0),
              right: Math.max(0, parseInt(m.right, 10) || 0),
              streak: Math.max(0, parseInt(m.streak, 10) || 0),
              lastAt: typeof m.lastAt === 'string' ? m.lastAt : '',
              lastStatus: typeof m.lastStatus === 'string' ? m.lastStatus : '',
            };
          })
          .filter(function (m) {
            return m.en || m.zh;
          });
        var clean = cleanName(name);
        if (clean && out.length) mistakes[clean] = out;
      });
    }

    return {
      v: 1,
      students: students,
      history: history,
      mistakes: mistakes,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    };
  }

  function buildPayload(state) {
    return {
      v: 1,
      students: Array.isArray(state && state.students) ? state.students : [],
      history: Array.isArray(state && state.history) ? state.history : [],
      mistakes: state && state.mistakes ? state.mistakes : {},
      updatedAt: new Date().toISOString(),
    };
  }

  function historyKey(rec) {
    return [
      rec.at || '',
      cleanName(rec.student),
      rec.mode || '',
      rec.total == null ? '' : rec.total,
      rec.correct == null ? '' : rec.correct,
      rec.wrong == null ? '' : rec.wrong,
      rec.skipped == null ? '' : rec.skipped,
    ].join('\u0000');
  }

  function timeOf(value) {
    var t = Date.parse(value || '');
    return isNaN(t) ? 0 : t;
  }

  function mistakeKey(m) {
    return String(m.en || '').toLowerCase() + '\u0000' + String(m.zh || '');
  }

  function pickMistake(a, b) {
    var ta = timeOf(a.lastAt);
    var tb = timeOf(b.lastAt);
    if (ta !== tb) return ta > tb ? a : b;
    return {
      en: a.en || b.en,
      zh: a.zh || b.zh,
      answers: a.answers && a.answers.length ? a.answers : b.answers,
      wrong: Math.max(a.wrong || 0, b.wrong || 0),
      right: Math.max(a.right || 0, b.right || 0),
      streak: Math.max(a.streak || 0, b.streak || 0),
      lastAt: a.lastAt || b.lastAt,
      lastStatus: a.lastStatus || b.lastStatus,
    };
  }

  function mergeMistakes(a, b) {
    var out = {};
    var names = Object.keys(a || {});
    Object.keys(b || {}).forEach(function (name) {
      if (names.indexOf(name) < 0) names.push(name);
    });
    names.forEach(function (name) {
      if (badKey(name)) return;
      var left = a && Array.isArray(a[name]) ? a[name] : [];
      var right = b && Array.isArray(b[name]) ? b[name] : [];
      var map = Object.create(null);
      left.concat(right).forEach(function (m) {
        var key = mistakeKey(m);
        map[key] = map[key] ? pickMistake(map[key], m) : m;
      });
      var list = Object.keys(map).map(function (key) {
        return map[key];
      });
      if (list.length) out[name] = list;
    });
    return out;
  }

  function mergePayload(localRaw, remoteRaw) {
    var local = normalizePayload(localRaw) || { students: [], history: [], mistakes: {} };
    var remote = normalizePayload(remoteRaw) || { students: [], history: [], mistakes: {} };

    var students = local.students.slice();
    var seen = Object.create(null);
    students.forEach(function (name) {
      seen[name.toLowerCase()] = true;
    });
    remote.students.forEach(function (name) {
      if (seen[name.toLowerCase()]) return;
      seen[name.toLowerCase()] = true;
      students.push(name);
    });

    var records = Object.create(null);
    local.history.concat(remote.history).forEach(function (rec) {
      records[historyKey(rec)] = rec;
    });
    var history = Object.keys(records)
      .map(function (key) {
        return records[key];
      })
      .sort(function (a, b) {
        return timeOf(b.at) - timeOf(a.at);
      })
      .slice(0, MAX_HISTORY);

    return {
      v: 1,
      students: students,
      history: history,
      mistakes: mergeMistakes(local.mistakes, remote.mistakes),
      updatedAt: new Date().toISOString(),
    };
  }

  function request(body, fetchImpl) {
    var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) return Promise.reject(new Error('浏览器不支持联网'));
    var controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, 15000)
      : null;

    return f(resolveEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    }).then(
      function (res) {
        if (timer) clearTimeout(timer);
        return res.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            data = text;
          }
          if (!res.ok) {
            var message =
              (data && data.message) ||
              (typeof data === 'string' && data) ||
              '请求失败（' + res.status + '）';
            var err = new Error(message);
            err.status = res.status;
            err.body = data;
            throw err;
          }
          return data;
        });
      },
      function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      }
    );
  }

  function pull(code, fetchImpl) {
    var clean = normalizeCode(code);
    return request({ action: 'get', code: clean }, fetchImpl).then(function (data) {
      if (!data || !data.payload) return null;
      return {
        payload: normalizePayload(data.payload),
        revision: parseInt(data.revision, 10) || 1,
        updatedAt: data.updatedAt || '',
      };
    });
  }

  function push(code, payload, revision, fetchImpl) {
    var clean = normalizeCode(code);
    return request(
      { action: 'put', code: clean, payload: payload, revision: revision },
      fetchImpl
    ).then(function (data) {
      return {
        payload: normalizePayload(data && data.payload),
        revision: parseInt(data && data.revision, 10) || 1,
        updatedAt: (data && data.updatedAt) || '',
      };
    });
  }

  function isConflict(err) {
    if (!err) return false;
    if (err.body && String(err.body.code) === '40001') return true;
    return /revision conflict/i.test(String(err.message || ''));
  }

  return {
    generateCode: generateCode,
    normalizeCode: normalizeCode,
    formatCode: formatCode,
    normalizePayload: normalizePayload,
    buildPayload: buildPayload,
    mergePayload: mergePayload,
    pull: pull,
    push: push,
    isConflict: isConflict,
  };
});
