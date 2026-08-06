/* WordSplit — Play.
 *
 * Three games over the same word data the study modes use. They are scored and
 * timed rather than scheduled: the point is a reason to go fast and come back,
 * not another spaced-repetition queue. Answers still count toward progress, so
 * playing is real study.
 *
 * Rush     60 seconds, rapid questions, a combo multiplier for a clean run.
 * Build    assemble the word from prefix / root / suffix tiles.
 * Survival three lives, no clock, questions widen as you climb.
 *
 * app.js hands in everything shared through mount(); this file owns its own
 * state and is responsible for clearing its timer when the view goes away.
 */
(function () {
  const GAMES = [
    {
      id: "rush",
      icon: "⚡",
      name: "Word Rush",
      desc: "60 seconds. Answer fast, keep the combo alive.",
      best: "Best score"
    },
    {
      id: "build",
      icon: "🧱",
      name: "Build It",
      desc: "Assemble the word from its prefix, root, and suffix.",
      best: "Best build"
    },
    {
      id: "survival",
      icon: "❤️",
      name: "Survival",
      desc: "Three lives. It gets harder the longer you last.",
      best: "Best streak"
    }
  ];

  const ROUND_SECONDS = 60;
  const BUILD_ROUNDS = 10;
  const COMBO_CAP = 5;
  const WRONG_PENALTY_MS = 3000;

  let ctx = null;
  let state = null;
  let ticker = null;

  function mount(context) {
    ctx = context;
  }

  /* Any navigation away must kill the clock, or a finished game keeps
   * counting down in the background and fires into the next view. */
  function stop() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    state = null;
  }

  function render(view) {
    if (!state) return renderMenu(view);
    if (state.over) return renderOver(view);
    return renderRound(view);
  }

  /* ---------- menu ---------- */

  function renderMenu(view) {
    const esc = ctx.esc;
    const scores = ctx.Store.getGameStats();

    view.innerHTML =
      '<p class="muted" style="margin-top:0">Same words as Study, played against ' +
      "a clock. Everything you answer still counts toward your progress.</p>" +
      GAMES.map(g => {
        const s = scores[g.id] || { best: 0, played: 0 };
        return (
          '<button class="modeCard" data-game="' + g.id + '">' +
          '<span class="mIcon">' + g.icon + "</span>" +
          '<span><span class="mName">' + esc(g.name) + "</span>" +
          '<span class="mDesc">' + esc(g.desc) + "</span>" +
          '<span class="mBest">' + esc(g.best) + ": <b>" + (s.best || 0) + "</b>" +
          (s.played ? '<span class="muted"> · played ' + s.played + "</span>" : "") +
          "</span></span></button>"
        );
      }).join("");

    view.querySelectorAll("[data-game]").forEach(btn => {
      btn.addEventListener("click", () => start(btn.dataset.game, view));
    });
  }

  /* ---------- shared question generation ---------- */

  function pickWord(pool, needParts) {
    for (let tries = 0; tries < 40; tries++) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      if (!needParts) return w;
      const parts = ctx.Splitter.split(w).parts.filter(p => p.entry);
      if (parts.length >= 2) return w;
    }
    return null;
  }

  /* Rush and Survival alternate between the two multiple-choice directions so
   * the same card never feels like the last one. */
  function makeQuestion(pool, choiceCount) {
    const word = pickWord(pool);
    const rec = ctx.ALL_WORDS.get(word);
    if (!rec) return null;
    const wrong = ctx.sample(pool.filter(w => w !== word), choiceCount - 1);
    const options = ctx.shuffle([word].concat(wrong));
    return {
      kind: Math.random() < 0.5 ? "meaning" : "word",
      word,
      rec,
      options
    };
  }

  /* A build puzzle is only fair if the tiles genuinely spell the word: every
   * piece has to be a real morpheme, they must join back to the word exactly,
   * and a one-letter tile is a guess rather than a decision. */
  function buildable(word) {
    const parts = ctx.Splitter.split(word).parts;
    if (parts.length < 2) return null;
    if (parts.some(p => !p.entry)) return null;
    const answer = parts.map(p => p.text);
    if (answer.join("") !== word) return null;
    if (answer.some(t => t.length < 2)) return null;
    return { parts, answer };
  }

  function makeBuild(pool) {
    let word = null;
    let built = null;
    for (let tries = 0; tries < 60 && !built; tries++) {
      word = pool[Math.floor(Math.random() * pool.length)];
      built = buildable(word);
    }
    if (!built) return null;
    const parts = built.parts;
    const answer = built.answer;
    const decoys = [];
    parts.forEach(p => {
      const same = ctx.MORPHEMES[p.entry.kind].filter(m => m.id !== p.entry.id);
      ctx.sample(same, 2).forEach(m => {
        if (answer.indexOf(m.key) === -1 && decoys.indexOf(m.key) === -1) {
          decoys.push(m.key);
        }
      });
    });

    return {
      word,
      rec: ctx.ALL_WORDS.get(word),
      answer,
      parts,
      tiles: ctx.shuffle(answer.concat(decoys.slice(0, 4)))
    };
  }

  /* ---------- game lifecycle ---------- */

  function start(id, view) {
    stop();
    const pool = ctx.activeWords();
    if (pool.length < 6) {
      ctx.toast("Turn on a word list first");
      return renderMenu(view);
    }

    state = {
      id,
      pool,
      view,
      score: 0,
      combo: 0,
      bestCombo: 0,
      right: 0,
      wrong: 0,
      round: 0,
      lives: id === "survival" ? 3 : 0,
      level: 1,
      missed: [],
      answered: false,
      endsAt: id === "rush" ? Date.now() + ROUND_SECONDS * 1000 : 0,
      over: false
    };
    nextQuestion();

    if (id === "rush") {
      ticker = setInterval(() => {
        if (!state || state.over) return;
        if (Date.now() >= state.endsAt) return finish();
        const bar = document.getElementById("timeBar");
        const label = document.getElementById("timeLeft");
        const left = Math.max(0, state.endsAt - Date.now());
        if (bar) bar.style.width = (100 * left) / (ROUND_SECONDS * 1000) + "%";
        if (label) label.textContent = Math.ceil(left / 1000) + "s";
      }, 100);
    }
    render(view);
  }

  function nextQuestion() {
    state.answered = false;
    state.round += 1;
    if (state.id === "build") {
      state.q = makeBuild(state.pool);
      state.placed = [];
    } else {
      /* Survival widens the field as the streak climbs, so later questions
       * genuinely ask more than the first ones. */
      const choices = state.id === "survival" ? Math.min(3 + Math.floor(state.level / 4), 6) : 4;
      state.q = makeQuestion(state.pool, choices);
    }
    if (!state.q) finish();
  }

  function scoreCorrect() {
    state.right += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const mult = Math.min(state.combo, COMBO_CAP);
    state.score += 10 * mult;
    if (state.id === "survival") state.level += 1;
  }

  function scoreWrong(word) {
    state.wrong += 1;
    state.combo = 0;
    if (word && state.missed.indexOf(word) === -1) state.missed.push(word);
    if (state.id === "rush") state.endsAt -= WRONG_PENALTY_MS;
    if (state.id === "survival") {
      state.lives -= 1;
      if (state.lives <= 0) return true;
    }
    return false;
  }

  function finish() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    if (!state) return;
    state.over = true;
    const value =
      state.id === "survival" ? state.right :
      state.id === "build" ? state.score : state.score;
    state.record = ctx.Store.recordGame(state.id, value);
    render(state.view);
  }

  /* ---------- round rendering ---------- */

  function statusBar() {
    const esc = ctx.esc;
    let left = "";
    if (state.id === "rush") {
      left =
        '<span id="timeLeft">' + Math.ceil(Math.max(0, state.endsAt - Date.now()) / 1000) +
        "s</span>";
    } else if (state.id === "survival") {
      left = '<span class="lives">' + "❤️".repeat(Math.max(0, state.lives)) + "</span>";
    } else {
      left = "<span>" + Math.min(state.round, BUILD_ROUNDS) + " / " + BUILD_ROUNDS + "</span>";
    }

    const combo =
      state.combo > 1
        ? '<span class="combo">×' + Math.min(state.combo, COMBO_CAP) + " combo</span>"
        : "";

    return (
      (state.id === "rush"
        ? '<div class="timeTrack"><i id="timeBar" style="width:' +
          (100 * Math.max(0, state.endsAt - Date.now())) / (ROUND_SECONDS * 1000) +
          '%"></i></div>'
        : "") +
      '<div class="gameBar">' + left +
      '<span class="score">' + state.score + "</span>" +
      combo + "</div>"
    );
  }

  function renderRound(view) {
    const esc = ctx.esc;
    const body = state.id === "build" ? buildHTML() : choiceHTML();
    view.innerHTML =
      statusBar() + body +
      '<button class="btn wide" id="quitGame" style="margin-top:14px">End game</button>';

    document.getElementById("quitGame").addEventListener("click", finish);
    if (state.id === "build") bindBuild();
    else bindChoice();
  }

  function choiceHTML() {
    const esc = ctx.esc;
    const q = state.q;
    if (q.kind === "meaning") {
      return (
        '<div class="card"><div class="prompt">What does it mean?</div>' +
        '<div class="bigWord">' + esc(q.word) + "</div></div>" +
        '<div class="choices">' +
        q.options.map(w => {
          const r = ctx.ALL_WORDS.get(w);
          return '<button class="choice" data-answer="' + esc(w) + '">' +
            esc(r ? r.def : w) + "</button>";
        }).join("") +
        "</div>"
      );
    }
    return (
      '<div class="card"><div class="prompt">Which word means this?</div>' +
      '<div class="bigDef">' + esc(q.rec.def) + "</div></div>" +
      '<div class="choices">' +
      q.options.map(w =>
        '<button class="choice" data-answer="' + esc(w) + '"><b>' + esc(w) + "</b></button>"
      ).join("") +
      "</div>"
    );
  }

  function bindChoice() {
    const view = state.view;
    view.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.answered) return;
        state.answered = true;
        const correct = btn.dataset.answer === state.q.word;

        view.querySelectorAll(".choice").forEach(b => {
          b.disabled = true;
          if (b.dataset.answer === state.q.word) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });

        ctx.Store.record(state.q.word, correct);
        let dead = false;
        if (correct) scoreCorrect();
        else dead = scoreWrong(state.q.word);

        flash(correct);
        /* Rush stays quick — a short beat, then on. Survival pauses so the
         * word that cost a life can actually be read. */
        const pause = correct ? 420 : state.id === "rush" ? 900 : 1500;
        if (!correct) showMiss();
        setTimeout(() => {
          if (!state || state.over) return;
          if (dead) return finish();
          if (state.id === "rush" && Date.now() >= state.endsAt) return finish();
          nextQuestion();
          if (!state.over) render(view);
        }, pause);
      });
    });
  }

  function showMiss() {
    const esc = ctx.esc;
    const panel = document.createElement("div");
    panel.className = "missCard";
    panel.innerHTML =
      "<b>" + esc(state.q.word) + "</b> — " + esc(state.q.rec.def);
    const quit = document.getElementById("quitGame");
    if (quit) quit.parentNode.insertBefore(panel, quit);
  }

  function flash(ok) {
    const el = document.createElement("div");
    el.className = "flash " + (ok ? "ok" : "no");
    el.textContent = ok
      ? ["Nice", "Yes", "Got it", "Sharp"][Math.floor(Math.random() * 4)] +
        (state.combo > 2 ? " ×" + Math.min(state.combo, COMBO_CAP) : "")
      : "Missed";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  /* ---------- Build It ---------- */

  function buildHTML() {
    const esc = ctx.esc;
    const q = state.q;
    const placed = state.placed;

    return (
      '<div class="card"><div class="prompt">Build the word that means:</div>' +
      '<div class="bigDef">' + esc(q.rec ? q.rec.def : "") + "</div>" +
      '<p class="small muted">' + q.answer.length + " parts · starts with <b>" +
      esc(q.word[0].toUpperCase()) + "</b></p>" +
      '<div class="slotRow">' +
      (placed.length
        ? placed.map((t, i) =>
            '<button class="tile placed" data-remove="' + i + '">' + esc(t) + "</button>"
          ).join('<span class="joiner">+</span>')
        : '<span class="slotHint">tap the parts below, in order</span>') +
      "</div></div>" +
      '<div class="tileTray">' +
      q.tiles.map((t, i) =>
        '<button class="tile" data-tile="' + i + '"' +
        (usedTile(i) ? " disabled" : "") + ">" + esc(t) + "</button>"
      ).join("") +
      "</div>" +
      '<button class="btn primary wide" id="checkBuild" style="margin-top:14px"' +
      (placed.length ? "" : " disabled") + ">Check</button>"
    );
  }

  /* Tiles are tracked by index so a repeated spelling is not double-spent. */
  function usedTile(i) {
    return state.usedIdx ? state.usedIdx.indexOf(i) !== -1 : false;
  }

  function bindBuild() {
    const view = state.view;
    if (!state.usedIdx) state.usedIdx = [];

    view.querySelectorAll("[data-tile]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.answered) return;
        const i = parseInt(btn.dataset.tile, 10);
        if (usedTile(i)) return;
        state.usedIdx.push(i);
        state.placed.push(state.q.tiles[i]);
        render(view);
      });
    });

    view.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.answered) return;
        const at = parseInt(btn.dataset.remove, 10);
        state.placed.splice(at, 1);
        state.usedIdx.splice(at, 1);
        render(view);
      });
    });

    const check = document.getElementById("checkBuild");
    if (check) {
      check.addEventListener("click", () => {
        if (state.answered) return;
        state.answered = true;
        const correct = state.placed.join("") === state.q.answer.join("");

        ctx.Store.record(state.q.word, correct);
        if (correct) scoreCorrect();
        else scoreWrong(state.q.word);
        flash(correct);

        const panel = document.createElement("div");
        panel.className = "card";
        panel.innerHTML =
          '<div class="feedback ' + (correct ? "ok" : "no") + '">' +
          (correct ? "Correct" : "It was " + ctx.esc(state.q.word)) + "</div>" +
          ctx.splitHTML(state.q.word, { showExamples: false, allowTeach: false });
        view.insertBefore(panel, document.getElementById("quitGame"));
        check.disabled = true;

        setTimeout(() => {
          if (!state || state.over) return;
          if (state.round >= BUILD_ROUNDS) return finish();
          state.usedIdx = [];
          nextQuestion();
          if (!state.over) render(view);
        }, correct ? 1100 : 2200);
      });
    }
  }

  /* ---------- results ---------- */

  function renderOver(view) {
    const esc = ctx.esc;
    const total = state.right + state.wrong;
    const pct = total ? Math.round((state.right / total) * 100) : 0;
    const game = GAMES.find(g => g.id === state.id);
    const rec = state.record || {};

    view.innerHTML =
      '<div class="card center">' +
      '<div style="font-size:46px">' + (rec.isBest ? "🏆" : pct >= 70 ? "🎉" : "💪") + "</div>" +
      '<h2 style="margin:6px 0 2px">' +
      (state.id === "survival" ? state.right + " in a row" : state.score + " points") +
      "</h2>" +
      (rec.isBest
        ? '<p class="bestTag">New best</p>'
        : '<p class="muted">Best: ' + (rec.best || 0) + "</p>") +
      "</div>" +
      '<div class="statGrid">' +
      ctx.stat(state.right, "correct") +
      ctx.stat(state.wrong, "missed") +
      ctx.stat(pct + "%", "accuracy") +
      ctx.stat("×" + Math.min(state.bestCombo, COMBO_CAP), "best combo") +
      "</div>" +
      (state.missed.length
        ? '<div class="sectionTitle">Worth another look</div><div class="list">' +
          state.missed.slice(0, 8).map(w => {
            const r = ctx.ALL_WORDS.get(w);
            return '<button class="listItem" data-word="' + esc(w) + '"><span>' +
              '<span class="lw">' + esc(w) + '</span><span class="ld">' +
              esc(r ? r.def : "") + "</span></span></button>";
          }).join("") + "</div>"
        : "") +
      '<button class="btn primary wide" id="againGame" style="margin-top:14px">' +
      "Play " + esc(game.name) + " again</button>" +
      '<button class="btn wide" id="menuGame" style="margin-top:10px">All games</button>';

    document.getElementById("againGame").addEventListener("click", () => start(state.id, view));
    document.getElementById("menuGame").addEventListener("click", () => {
      stop();
      renderMenu(view);
    });
    view.querySelectorAll(".listItem[data-word]").forEach(btn => {
      btn.addEventListener("click", () => ctx.showWordDetail(btn.dataset.word));
    });
  }

  window.WordGames = { mount, render, stop };
})();
