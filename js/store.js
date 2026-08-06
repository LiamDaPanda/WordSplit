/* WordSplit — settings and progress, persisted to localStorage.
 * Progress uses a Leitner box schedule: a correct answer promotes a word to
 * the next box and pushes its due date out; a miss sends it back to box 0.
 */
(function () {
  const SETTINGS_KEY = "wordsplit.settings.v1";
  const PROGRESS_KEY = "wordsplit.progress.v1";
  const STATS_KEY = "wordsplit.stats.v1";
  const GAMES_KEY = "wordsplit.games.v1";

  const DEFAULT_SETTINGS = {
    sessionLength: 20,
    theme: "system",
    showHints: true,
    speakWords: false,
    autoAdvanceMs: 0,
    hardestFirst: false,
    adaptiveSplit: true
  };

  /* days until a word in each box comes back around */
  const BOX_INTERVALS = [0, 1, 2, 4, 8, 16, 32];
  const DAY = 86400000;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  let settings = Object.assign({}, DEFAULT_SETTINGS, read(SETTINGS_KEY, {}));
  let progress = read(PROGRESS_KEY, {});
  let stats = Object.assign(
    { studied: 0, correct: 0, streak: 0, lastDay: null, days: [] },
    read(STATS_KEY, {})
  );
  let games = read(GAMES_KEY, {});

  function getSettings() {
    return Object.assign({}, settings);
  }

  function setSetting(key, value) {
    settings[key] = value;
    write(SETTINGS_KEY, settings);
  }

  function entry(word) {
    return progress[word] || { box: 0, due: 0, seen: 0, right: 0, wrong: 0 };
  }

  function isDue(word, now) {
    const e = progress[word];
    if (!e) return true;
    return e.due <= (now || Date.now());
  }

  /* Words never seen count as new; everything else is scheduled. */
  function record(word, correct) {
    const e = entry(word);
    e.seen += 1;
    if (correct) {
      e.right += 1;
      e.box = Math.min(e.box + 1, BOX_INTERVALS.length - 1);
    } else {
      e.wrong += 1;
      e.box = 0;
    }
    e.due = Date.now() + BOX_INTERVALS[e.box] * DAY;
    e.last = Date.now();
    progress[word] = e;
    write(PROGRESS_KEY, progress);

    stats.studied += 1;
    if (correct) stats.correct += 1;
    touchDay();
    write(STATS_KEY, stats);
  }

  function touchDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (stats.lastDay === today) return;
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    stats.streak = stats.lastDay === yesterday ? (stats.streak || 0) + 1 : 1;
    stats.lastDay = today;
    stats.days = (stats.days || []).concat([today]).slice(-120);
  }

  function getStats() {
    return Object.assign({}, stats);
  }

  /* Per-game high scores. Returns whether this run beat the record so the
   * results screen can say so. */
  function getGameStats() {
    return Object.assign({}, games);
  }

  function recordGame(id, value) {
    const prev = games[id] || { best: 0, played: 0, last: 0 };
    const isBest = value > prev.best;
    games[id] = {
      best: Math.max(prev.best, value),
      played: prev.played + 1,
      last: value
    };
    write(GAMES_KEY, games);
    return { best: games[id].best, isBest, played: games[id].played };
  }

  function getProgress() {
    return progress;
  }

  /* Rough mastery bands used by the browser and stats views. */
  function level(word) {
    const e = progress[word];
    if (!e || !e.seen) return "new";
    if (e.box >= 5) return "mastered";
    if (e.box >= 2) return "learning";
    return "shaky";
  }

  function summary(words) {
    const out = { new: 0, shaky: 0, learning: 0, mastered: 0, due: 0 };
    const now = Date.now();
    words.forEach(w => {
      out[level(w)] += 1;
      if (progress[w] && progress[w].due <= now) out.due += 1;
    });
    return out;
  }

  function resetProgress() {
    progress = {};
    stats = { studied: 0, correct: 0, streak: 0, lastDay: null, days: [] };
    games = {};
    write(PROGRESS_KEY, progress);
    write(STATS_KEY, stats);
    write(GAMES_KEY, games);
  }

  window.WordStore = {
    getSettings,
    setSetting,
    entry,
    isDue,
    record,
    getStats,
    getGameStats,
    recordGame,
    getProgress,
    level,
    summary,
    resetProgress,
    DEFAULT_SETTINGS
  };
})();
