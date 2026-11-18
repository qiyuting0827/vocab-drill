/* 单词表解析与答案比对。
 * 浏览器：window.VocabParser；Node：module.exports。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VocabParser = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  var CJK_G = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

  // 词性标记：n. / v. / adj. / phr. ...
  var POS = 'n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|int|abbr|phr|pl';
  var POS_HEAD_RE = new RegExp('^(?:(?:' + POS + ')\\.\\s*)+', 'i');
  var POS_TAIL_RE = new RegExp('\\s+(?:' + POS + ')\\.$', 'i');
  var POS_MID_RE = new RegExp('\\s+(?:' + POS + ')\\.\\s+', 'gi');

  // 中文侧的词性括注，如 【动】/（名）/ [形容词]，必须带括号才剥离
  var ZH_POS_HEAD_RE =
    /^[\s\[【(（]\s*(?:名词|动词|形容词|副词|介词|连词|代词|数词|量词|叹词|助词|词组|短语|名|动|形|副|介|连|代|数|量|叹|助)\s*[\s\]】)）]+/;

  var EDGE_HEAD_RE = /^[\s\-–—:：,，.。;；/、=|·•*_（(【\[]+/;
  var EDGE_TAIL_RE = /[\s\-–—:：,，.。;；/、=|·•*_）)】\]]+$/;

  function trimEdges(s) {
    return s.replace(EDGE_HEAD_RE, '').replace(EDGE_TAIL_RE, '');
  }

  function cleanEn(raw) {
    var en = String(raw || '')
      // 音标：/əˈbændən/、[əˈbændən]
      .replace(/\/[^\/]*\//g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      // 英文侧括注：(v.)、(formal)；位于开头的括注保留内容，兼容“苹果（apple）”
      .replace(/[\(（]([^()（）]*)[\)）]/g, function (all, inner, offset) {
        return offset > 0 ? ' ' : inner;
      })
      .replace(/[^A-Za-z0-9'’.\-\/&\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    en = en.replace(POS_TAIL_RE, '').replace(POS_TAIL_RE, '');
    en = en
      .replace(/^[\s.\-\/&]+/, '')
      .replace(/[\s.\-\/&]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return /[A-Za-z]/.test(en) ? en : '';
  }

  function cleanZh(raw) {
    var zh = String(raw || '')
      .replace(/\/[^\/]*\//g, ' ')
      .replace(/[\(（]([^()（）]*)[\)）]/g, function (all, inner) {
        return CJK_RE.test(inner) ? all : ' ';
      })
      .replace(/\[[^\]]*\]/g, function (all) {
        return CJK_RE.test(all) ? all : ' ';
      });

    for (var i = 0; i < 4; i++) {
      zh = trimEdges(zh.replace(POS_HEAD_RE, '').replace(ZH_POS_HEAD_RE, ''));
    }
    zh = zh.replace(POS_MID_RE, ' ');
    return zh.replace(/\s+/g, ' ').trim();
  }

  function parseLine(raw) {
    if (typeof raw !== 'string') return null;

    var line = raw
      .replace(/\u00a0/g, ' ')
      .replace(/\u3000/g, ' ')
      .trim()
      .replace(/^[\s\-*•·]+/, '')
      .replace(/^\d+\s*[.、)）:：]\s*/, '');
    if (!line || !CJK_RE.test(line)) return null;

    var first = line.search(CJK_RE);
    // 让紧贴在汉字前的括号归到中文一侧，如 abandon [动] 放弃
    while (first > 0 && /[\[【(（]/.test(line.charAt(first - 1))) first -= 1;
    var before = line.slice(0, first);
    var enRaw;
    var zhRaw;

    if (/[A-Za-z]/.test(before)) {
      // 英文在前：apple 苹果
      enRaw = before;
      zhRaw = line.slice(first);
    } else {
      // 中文在前：苹果 apple
      var lastEnd = -1;
      var m;
      var re = new RegExp(CJK_G.source, 'g');
      while ((m = re.exec(line)) !== null) lastEnd = m.index + m[0].length;
      zhRaw = line.slice(0, lastEnd);
      enRaw = line.slice(lastEnd);
    }

    var en = cleanEn(enRaw);
    var zh = cleanZh(zhRaw);
    if (!en || !zh || !CJK_RE.test(zh)) return null;

    var answers = en
      .split(/\s*\/\s*|\s*;\s*/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (!answers.length) return null;

    var seen = Object.create(null);
    answers = answers.filter(function (a) {
      var key = a.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    return { en: en, zh: zh, answers: answers };
  }

  function parseWordList(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var items = [];
    var skipped = [];
    var seen = Object.create(null);

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parsed = parseLine(line);
      if (!parsed) {
        skipped.push({ lineNo: i + 1, text: line });
        continue;
      }
      var key = parsed.en.toLowerCase() + '\u0000' + parsed.zh;
      if (seen[key]) continue;
      seen[key] = true;
      items.push(parsed);
    }

    return { items: items, skipped: skipped };
  }

  // 全角字母/数字转半角，方便中文输入法下的输入
  function toHalfWidth(s) {
    return String(s || '')
      .replace(/[\uFF01-\uFF5E]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
      })
      .replace(/\u3000/g, ' ');
  }

  function normalizeAnswer(s) {
    var out = toHalfWidth(s);
    if (typeof out.normalize === 'function') out = out.normalize('NFC');
    return out
      .replace(/[’‘`´]/g, "'")
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/^[\s.,!?;:'"]+/, '')
      .replace(/[\s.,!?;:'"]+$/, '');
  }

  function checkAnswer(given, item) {
    var norm = normalizeAnswer(given);
    if (!norm || !item) return false;
    var answers = item.answers && item.answers.length ? item.answers : [item.en];
    return answers.some(function (a) {
      return normalizeAnswer(a) === norm;
    });
  }

  return {
    parseLine: parseLine,
    parseWordList: parseWordList,
    normalizeAnswer: normalizeAnswer,
    checkAnswer: checkAnswer,
  };
});
