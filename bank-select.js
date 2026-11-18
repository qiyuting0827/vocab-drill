(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BankSelect = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clampInt(value, lo, hi) {
    var n = parseInt(value, 10);
    if (!isFinite(n)) return null;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  /* start / end 都是 0 起的闭区间下标 */
  function normalizeRange(len, start, end) {
    if (!(len > 0)) return { start: 0, end: -1 };
    var s = clampInt(start, 0, len - 1);
    var e = clampInt(end, 0, len - 1);
    if (s === null) s = 0;
    if (e === null) e = len - 1;
    if (s > e) {
      var swap = s;
      s = e;
      e = swap;
    }
    return { start: s, end: e };
  }

  /* 兼容旧数据：true / [start, end] / {start, end} 都视为整单元 */
  function readRange(len, sel) {
    if (Array.isArray(sel)) return normalizeRange(len, sel[0], sel[1]);
    if (sel && typeof sel === 'object') return normalizeRange(len, sel.start, sel.end);
    return normalizeRange(len, 0, len - 1);
  }

  function isFull(unit, sel) {
    if (!unit || !unit.words || !unit.words.length) return false;
    var r = readRange(unit.words.length, sel);
    return r.start === 0 && r.end === unit.words.length - 1;
  }

  function collectItems(units, selection) {
    var seen = Object.create(null);
    var items = [];
    (units || []).forEach(function (unit) {
      var sel = selection && selection[unit.id];
      if (sel == null) return;
      var r = readRange(unit.words.length, sel);
      for (var i = r.start; i <= r.end; i += 1) {
        var w = unit.words[i];
        if (!w) continue;
        var key = String(w[0]).toLowerCase() + '\u0000' + w[1];
        if (seen[key]) continue;
        seen[key] = true;
        items.push({
          en: w[0],
          zh: w[1],
          answers: Array.isArray(w[2]) && w[2].length ? w[2].slice() : [w[0]],
        });
      }
    });
    return items;
  }

  return {
    normalizeRange: normalizeRange,
    readRange: readRange,
    isFull: isFull,
    collectItems: collectItems,
  };
});
