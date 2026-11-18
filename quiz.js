/* 默写会话：出题顺序、判定、统计。
 * 浏览器：window.VocabQuiz；Node：module.exports。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./parser.js'));
  } else {
    root.VocabQuiz = factory(root.VocabParser);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Parser) {
  'use strict';

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function createSession(items, options) {
    var opts = options || {};
    var queue = (items || []).map(function (item) {
      return {
        en: item.en,
        zh: item.zh,
        answers: (item.answers && item.answers.slice()) || [item.en],
      };
    });
    if (opts.shuffle !== false) shuffle(queue);
    return {
      queue: queue,
      index: 0,
      phase: 'answering', // answering | feedback | done
      results: [],
    };
  }

  function current(session) {
    if (!session || session.index >= session.queue.length) return null;
    return session.queue[session.index];
  }

  function submit(session, raw) {
    var item = current(session);
    var given = String(raw == null ? '' : raw).trim();
    if (!item || session.phase !== 'answering') return null;
    if (!given) return { status: 'empty' };

    var ok = Parser.checkAnswer(given, item);
    var rec = {
      en: item.en,
      zh: item.zh,
      answers: item.answers,
      given: given,
      status: ok ? 'correct' : 'wrong',
    };
    session.results.push(rec);
    session.phase = 'feedback';
    return rec;
  }

  function skip(session, raw) {
    var item = current(session);
    if (!item || session.phase !== 'answering') return null;
    var rec = {
      en: item.en,
      zh: item.zh,
      answers: item.answers,
      given: String(raw == null ? '' : raw).trim(),
      status: 'skipped',
    };
    session.results.push(rec);
    session.phase = 'feedback';
    return rec;
  }

  function next(session) {
    if (session.phase !== 'feedback') return false;
    session.index += 1;
    session.phase = session.index >= session.queue.length ? 'done' : 'answering';
    return session.phase !== 'done';
  }

  function isFinished(session) {
    return session.index >= session.queue.length;
  }

  function summary(session) {
    var total = session.queue.length;
    var correct = 0;
    var wrong = 0;
    var skipped = 0;
    var mistakes = [];

    session.results.forEach(function (r) {
      if (r.status === 'correct') {
        correct += 1;
      } else {
        if (r.status === 'wrong') wrong += 1;
        else skipped += 1;
        mistakes.push(r);
      }
    });

    return {
      total: total,
      correct: correct,
      wrong: wrong,
      skipped: skipped,
      accuracy: total ? correct / total : 0,
      mistakes: mistakes,
    };
  }

  return {
    createSession: createSession,
    current: current,
    submit: submit,
    skip: skip,
    next: next,
    isFinished: isFinished,
    summary: summary,
    shuffle: shuffle,
  };
});
