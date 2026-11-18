/* 学员名单与错题本的数据处理。
 * 浏览器：window.StudentBook；Node：module.exports。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudentBook = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function cleanName(value) {
    return String(value == null ? '' : value)
      .replace(/\u00a0/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function parseNames(text) {
    var parts = String(text == null ? '' : text).split(/[\n\r,，、;；\t]+/);
    var out = [];
    var seen = {};
    parts.forEach(function (part) {
      var name = cleanName(part);
      if (!name) return;
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(name);
    });
    return out;
  }

  function addNames(list, text) {
    var current = Array.isArray(list) ? list.slice() : [];
    var seen = {};
    current.forEach(function (name) {
      var clean = cleanName(name);
      if (clean) seen[clean.toLowerCase()] = true;
    });
    var added = [];
    parseNames(text).forEach(function (name) {
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      current.push(name);
      added.push(name);
    });
    return { list: current, added: added };
  }

  function removeName(list, name) {
    var key = cleanName(name).toLowerCase();
    return (Array.isArray(list) ? list : []).filter(function (item) {
      return cleanName(item).toLowerCase() !== key;
    });
  }

  function wordKey(en, zh) {
    return String(en == null ? '' : en).toLowerCase() + '\u0000' + String(zh == null ? '' : zh);
  }

  function cloneEntry(entry) {
    return {
      en: entry.en,
      zh: entry.zh,
      answers: (entry.answers && entry.answers.slice()) || [entry.en],
      wrong: entry.wrong || 0,
      right: entry.right || 0,
      streak: entry.streak || 0,
      lastAt: entry.lastAt || '',
      lastStatus: entry.lastStatus || '',
    };
  }

  function cloneBook(book) {
    var out = {};
    Object.keys(book || {}).forEach(function (name) {
      out[name] = (book[name] || []).map(cloneEntry);
    });
    return out;
  }

  function listMistakes(book, student) {
    var name = cleanName(student);
    var arr = (book && book[name]) || [];
    return arr
      .map(cloneEntry)
      .sort(function (a, b) {
        return (
          (b.wrong || 0) - (a.wrong || 0) ||
          String(b.lastAt || '').localeCompare(String(a.lastAt || ''))
        );
      });
  }

  function countMistakes(book, student) {
    return listMistakes(book, student).length;
  }

  function reviewItems(book, student) {
    return listMistakes(book, student).map(function (entry) {
      return { en: entry.en, zh: entry.zh, answers: entry.answers };
    });
  }

  function recordResults(book, student, results, options) {
    var opts = options || {};
    var name = cleanName(student);
    var out = cloneBook(book);
    if (!name) return out;

    var list = out[name] || (out[name] = []);
    var review = !!opts.review;
    var now = opts.now || new Date().toISOString();

    (results || []).forEach(function (result) {
      if (!result || !result.zh) return;
      var key = wordKey(result.en, result.zh);
      var index = -1;
      for (var i = 0; i < list.length; i++) {
        if (wordKey(list[i].en, list[i].zh) === key) {
          index = i;
          break;
        }
      }

      if (result.status === 'wrong' || result.status === 'skipped') {
        var entry =
          index >= 0
            ? list[index]
            : {
                en: result.en,
                zh: result.zh,
                answers: (result.answers && result.answers.slice()) || [result.en],
                wrong: 0,
                right: 0,
                streak: 0,
                lastAt: '',
                lastStatus: '',
              };
        entry.wrong += 1;
        entry.streak = 0;
        entry.lastAt = now;
        entry.lastStatus = result.status;
        if (index < 0) list.push(entry);
        return;
      }

      if (result.status === 'correct' && index >= 0) {
        var known = list[index];
        known.right += 1;
        known.lastAt = now;
        if (review) {
          known.streak += 1;
          if (known.streak >= 2) list.splice(index, 1);
        }
      }
    });

    if (!list.length) delete out[name];
    return out;
  }

  function removeMistake(book, student, en, zh) {
    var name = cleanName(student);
    var out = cloneBook(book);
    if (!out[name]) return out;
    var key = wordKey(en, zh);
    out[name] = out[name].filter(function (entry) {
      return wordKey(entry.en, entry.zh) !== key;
    });
    if (!out[name].length) delete out[name];
    return out;
  }

  function clearStudent(book, student) {
    var name = cleanName(student);
    var out = cloneBook(book);
    delete out[name];
    return out;
  }

  return {
    cleanName: cleanName,
    parseNames: parseNames,
    addNames: addNames,
    removeName: removeName,
    listMistakes: listMistakes,
    countMistakes: countMistakes,
    reviewItems: reviewItems,
    recordResults: recordResults,
    removeMistake: removeMistake,
    clearStudent: clearStudent,
  };
});
