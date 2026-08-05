/* WordSplit — views, navigation, and the study modes. */
(function () {
  const Store = window.WordStore;
  const Splitter = window.WordSplitter;
  const MORPHEMES = window.WS_MORPHEMES;
  const ORIGIN_NAMES = window.WS_ORIGIN_NAMES;

  const LISTS = {
    ssat: { name: "Upper Level SSAT", raw: window.WS_LIST_SSAT || [] },
    sat: { name: "SAT", raw: window.WS_LIST_SAT || [] }
  };

  const POS_NAMES = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };

  /* word -> {word, pos, def, lists[]} across every list, built once */
  const ALL_WORDS = new Map();
  Object.keys(LISTS).forEach(key => {
    LISTS[key].words = [];
    LISTS[key].raw.forEach(line => {
      const [word, pos, def] = line.split("|");
      if (!word) return;
      let rec = ALL_WORDS.get(word);
      if (!rec) {
        rec = { word, pos, def, lists: [] };
        ALL_WORDS.set(word, rec);
      }
      if (rec.lists.indexOf(key) === -1) rec.lists.push(key);
      LISTS[key].words.push(word);
    });
  });

  Splitter.registerWords([...ALL_WORDS.keys()]);

  const view = document.getElementById("view");
  const viewTitle = document.getElementById("viewTitle");
  const streakChip = document.getElementById("streakChip");
  const tabbar = document.getElementById("tabbar");

  let state = { view: "split", session: null, browseFilter: "all", rootFilter: "prefix" };

  /* ---------- helpers ---------- */

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function activeWords() {
    const lists = Store.getSettings().lists;
    const seen = new Set();
    const out = [];
    lists.forEach(key => {
      (LISTS[key] ? LISTS[key].words : []).forEach(w => {
        if (seen.has(w)) return;
        seen.add(w);
        out.push(w);
      });
    });
    return out.length ? out : [...ALL_WORDS.keys()];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sample(arr, n, exclude) {
    const pool = exclude ? arr.filter(x => x !== exclude) : arr;
    return shuffle(pool).slice(0, n);
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  function speak(word) {
    if (!Store.getSettings().speakWords) return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (err) {
      /* speech is a nicety; never let it break a session */
    }
  }

  /* ---------- split rendering ---------- */

  function pieceHTML(part) {
    const kindLabel = part.kind === "link" ? "joins" : part.kind;
    const meaning = part.kind === "base" && !part.meaning ? "base word" : part.meaning;
    return (
      '<button class="piece ' + part.kind + '" data-morpheme="' +
      esc(part.entry ? part.entry.kind + ":" + part.text : "") + '">' +
      '<span class="pieceKind">' + esc(kindLabel) + "</span>" +
      '<span class="pieceText">' + esc(part.text) + "</span>" +
      (meaning ? '<span class="pieceMeaning">' + esc(meaning) + "</span>" : "") +
      "</button>"
    );
  }

  function splitHTML(word, opts) {
    const options = opts || {};
    const result = Splitter.split(word);
    const rec = ALL_WORDS.get(word);
    let html = "";

    if (options.showWord !== false) {
      html += '<div class="wordHead"><span class="word">' + esc(word) + "</span>";
      if (rec && rec.pos) {
        html += '<span class="pos">' + esc(POS_NAMES[rec.pos] || rec.pos) + "</span>";
      }
      html += "</div>";
      if (rec && options.showDefinition !== false) {
        html += '<p class="definition">' + esc(rec.def) + "</p>";
      }
    }

    if (result.parts.length > 1) {
      html += '<div class="pieces">';
      result.parts.forEach((part, i) => {
        if (i) html += '<span class="joiner">+</span>';
        html += pieceHTML(part);
      });
      html += "</div>";

      if (result.inflection) {
        html +=
          '<p class="small muted">Ending <b>' + esc(result.inflection.label) +
          "</b> — " + esc(result.inflection.note) + ", removed to show the base.</p>";
      }

      const literal = Splitter.literalReading(result);
      if (literal) {
        html +=
          '<div class="literal">Read the parts: <b>' + esc(literal) + "</b></div>";
      }
    } else {
      html +=
        '<p class="small muted" style="margin-top:12px">' +
        (result.confidence === "whole"
          ? "This one is a single unit — it has no prefix or suffix to peel off."
          : "No classical prefix or root found for this word. Learn it as a whole.") +
        "</p>";
    }

    if (options.showExamples !== false) {
      const shared = relatedWords(word, result);
      if (shared.length) {
        html +=
          '<p class="examples"><b>Same roots:</b> ' +
          shared.map(w => esc(w)).join(", ") + "</p>";
      }
    }
    return html;
  }

  /* morpheme id -> words containing it. Splitting the whole corpus costs a
   * beat, so build it once on first use instead of on every card render. */
  let morphemeIndex = null;
  function getMorphemeIndex() {
    if (morphemeIndex) return morphemeIndex;
    morphemeIndex = new Map();
    ALL_WORDS.forEach((rec, word) => {
      Splitter.split(word).parts.forEach(part => {
        if (!part.entry) return;
        let bucket = morphemeIndex.get(part.entry.id);
        if (!bucket) {
          bucket = [];
          morphemeIndex.set(part.entry.id, bucket);
        }
        if (bucket.indexOf(word) === -1) bucket.push(word);
      });
    });
    return morphemeIndex;
  }

  function wordsWithMorpheme(entryId) {
    return getMorphemeIndex().get(entryId) || [];
  }

  /* Other study words that share this word's root, so the parts pay off. */
  function relatedWords(word, result) {
    const roots = result.parts.filter(p => p.kind === "root" && p.entry);
    if (!roots.length) return [];
    const out = [];
    roots.forEach(p => {
      wordsWithMorpheme(p.entry.id).forEach(other => {
        if (other !== word && out.indexOf(other) === -1 && out.length < 6) out.push(other);
      });
    });
    return out;
  }

  /* ---------- view: split ---------- */

  function renderSplit() {
    viewTitle.textContent = "WordSplit";
    const words = activeWords();
    const daily = words[Math.floor(dayNumber() % words.length)];

    view.innerHTML =
      '<input class="field" id="splitInput" type="search" autocapitalize="none" ' +
      'autocorrect="off" spellcheck="false" placeholder="Type any word to break apart…">' +
      '<div id="splitResult"></div>' +
      '<div class="sectionTitle">Word of the day</div>' +
      '<div class="card" id="dailyCard">' + splitHTML(daily) + "</div>" +
      '<button class="btn wide" id="randomBtn">🎲 Split a random word</button>';

    const input = document.getElementById("splitInput");
    const result = document.getElementById("splitResult");

    const run = () => {
      const value = input.value.trim().toLowerCase();
      if (!value) {
        result.innerHTML = "";
        return;
      }
      result.innerHTML = '<div class="card">' + splitHTML(value) + "</div>";
      if (!ALL_WORDS.has(value)) {
        result.innerHTML +=
          '<p class="small muted center">Not in your word lists — split from the ' +
          "morpheme database.</p>";
      }
    };

    input.addEventListener("input", run);
    input.addEventListener("search", run);
    document.getElementById("randomBtn").addEventListener("click", () => {
      const w = words[Math.floor(Math.random() * words.length)];
      input.value = w;
      run();
      speak(w);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function dayNumber() {
    return Math.floor(Date.now() / 86400000);
  }

  /* ---------- view: study ---------- */

  const MODES = [
    { id: "flashcards", icon: "🃏", name: "Flashcards", desc: "See the word, recall the meaning, grade yourself." },
    { id: "meaning", icon: "🎯", name: "Pick the meaning", desc: "Multiple choice from the word to its definition." },
    { id: "word", icon: "🔤", name: "Pick the word", desc: "Multiple choice from the definition back to the word." },
    { id: "parts", icon: "🧩", name: "Parts quiz", desc: "Identify what a prefix, root, or suffix means." },
    { id: "spell", icon: "⌨️", name: "Spell it", desc: "Read the definition and type the word." },
    { id: "review", icon: "🔁", name: "Due review", desc: "Only the words your schedule says are due." }
  ];

  function renderStudy() {
    viewTitle.textContent = "Study";
    if (state.session) return renderSession();

    const words = activeWords();
    const sum = Store.summary(words);
    const stats = Store.getStats();
    const settings = Store.getSettings();

    view.innerHTML =
      '<div class="statGrid">' +
      stat(sum.due, "due now") +
      stat(sum.mastered, "mastered") +
      stat(words.length, "words in rotation") +
      stat(stats.streak || 0, "day streak") +
      "</div>" +
      '<div class="sectionTitle">Study modes</div>' +
      MODES.map(m =>
        '<button class="modeCard" data-mode="' + m.id + '">' +
        '<span class="mIcon">' + m.icon + "</span><span><span class=\"mName\">" +
        esc(m.name) + '</span><span class="mDesc">' + esc(m.desc) + "</span></span></button>"
      ).join("") +
      '<p class="small muted center">Sessions are ' + settings.sessionLength +
      " words — change that in Settings.</p>";

    view.querySelectorAll(".modeCard").forEach(btn => {
      btn.addEventListener("click", () => startSession(btn.dataset.mode));
    });
  }

  function stat(value, label) {
    return '<div class="stat"><div class="sv">' + esc(value) + '</div><div class="sl">' +
      esc(label) + "</div></div>";
  }

  function startSession(mode) {
    const settings = Store.getSettings();
    const words = activeWords();
    let pool;

    if (mode === "review") {
      pool = words.filter(w => {
        const e = Store.entry(w);
        return e.seen > 0 && e.due <= Date.now();
      });
      if (!pool.length) {
        toast("Nothing is due yet — try another mode");
        return;
      }
    } else if (mode === "parts") {
      /* only words the splitter can actually break apart */
      pool = words.filter(w => Splitter.split(w).parts.some(p => p.entry));
    } else {
      pool = words.slice();
    }

    if (settings.hardestFirst) {
      pool.sort((a, b) => {
        const ea = Store.entry(a);
        const eb = Store.entry(b);
        return (ea.box - eb.box) || (eb.wrong - ea.wrong);
      });
      pool = pool.slice(0, settings.sessionLength);
    } else {
      pool = shuffle(pool).slice(0, settings.sessionLength);
    }

    if (!pool.length) {
      toast("No words available for that mode");
      return;
    }

    state.session = {
      mode,
      queue: pool,
      index: 0,
      right: 0,
      wrong: 0,
      answered: false,
      flipped: false
    };
    renderSession();
  }

  function endSession() {
    state.session = null;
    renderStudy();
  }

  function renderSession() {
    const s = state.session;
    if (s.index >= s.queue.length) return renderSessionDone();

    const word = s.queue[s.index];
    const pct = Math.round((s.index / s.queue.length) * 100);
    const header =
      '<div class="progressbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="spread small muted" style="margin-bottom:10px">' +
      "<span>" + (s.index + 1) + " of " + s.queue.length + "</span>" +
      "<span>✅ " + s.right + " &nbsp; ❌ " + s.wrong + "</span></div>";

    let body = "";
    if (s.mode === "flashcards" || s.mode === "review") body = flashcardHTML(word);
    else if (s.mode === "meaning") body = choiceHTML(word, "meaning");
    else if (s.mode === "word") body = choiceHTML(word, "word");
    else if (s.mode === "parts") body = partsHTML(word);
    else if (s.mode === "spell") body = spellHTML(word);

    view.innerHTML =
      header + body +
      '<button class="btn wide" id="quitBtn" style="margin-top:14px">End session</button>';

    document.getElementById("quitBtn").addEventListener("click", endSession);

    if (s.mode === "flashcards" || s.mode === "review") bindFlashcard(word);
    else if (s.mode === "meaning" || s.mode === "word") bindChoice(word);
    else if (s.mode === "parts") bindParts(word);
    else if (s.mode === "spell") bindSpell(word);

    speak(word);
  }

  function advance(correct, word) {
    const s = state.session;
    Store.record(word, correct);
    if (correct) s.right += 1;
    else s.wrong += 1;
    s.index += 1;
    s.answered = false;
    s.flipped = false;
    renderSession();
  }

  function renderSessionDone() {
    const s = state.session;
    const total = s.right + s.wrong;
    const pct = total ? Math.round((s.right / total) * 100) : 0;
    view.innerHTML =
      '<div class="card center"><div style="font-size:44px">' +
      (pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪") + "</div>" +
      "<h2 style=\"margin:6px 0\">" + pct + "% correct</h2>" +
      '<p class="muted">' + s.right + " right · " + s.wrong + " to review</p></div>" +
      '<button class="btn primary wide" id="againBtn">Study again</button>' +
      '<button class="btn wide" id="doneBtn" style="margin-top:10px">Back to modes</button>';
    document.getElementById("againBtn").addEventListener("click", () => startSession(s.mode));
    document.getElementById("doneBtn").addEventListener("click", endSession);
    updateStreakChip();
  }

  /* --- flashcards --- */

  function flashcardHTML(word) {
    const s = state.session;
    const rec = ALL_WORDS.get(word);
    const settings = Store.getSettings();
    let inner;

    if (!s.flipped) {
      inner =
        '<div class="prompt">What does it mean?</div>' +
        '<div class="bigWord">' + esc(word) + "</div>" +
        (settings.showHints ? hintHTML(word) : "") +
        '<div class="tapHint">Tap to reveal</div>';
    } else {
      inner =
        '<div class="prompt">' + esc(word) + "</div>" +
        '<div class="bigDef">' + esc(rec ? rec.def : "") + "</div>" +
        '<div style="width:100%;text-align:left">' +
        splitHTML(word, { showWord: false, showDefinition: false, showExamples: false }) +
        "</div>";
    }

    return (
      '<div class="card flip" id="flipCard">' + inner + "</div>" +
      (s.flipped
        ? '<div class="row"><button class="btn bad wide" id="missBtn">Missed it</button>' +
          '<button class="btn good wide" id="gotBtn">Got it</button></div>'
        : "")
    );
  }

  function hintHTML(word) {
    const result = Splitter.split(word);
    const parts = result.parts.filter(p => p.entry);
    if (!parts.length) return "";
    return (
      '<div class="literal">Hint: ' +
      parts.map(p => "<b>" + esc(p.text) + "</b> = " + esc(p.meaning)).join(" · ") +
      "</div>"
    );
  }

  function bindFlashcard(word) {
    const s = state.session;
    const card = document.getElementById("flipCard");
    card.addEventListener("click", () => {
      if (s.flipped) return;
      s.flipped = true;
      renderSession();
    });
    if (s.flipped) {
      document.getElementById("gotBtn").addEventListener("click", () => advance(true, word));
      document.getElementById("missBtn").addEventListener("click", () => advance(false, word));
    }
  }

  /* --- multiple choice --- */

  function choiceHTML(word, direction) {
    const rec = ALL_WORDS.get(word);
    const pool = activeWords();
    const distractors = sample(pool, 3, word);
    const options = shuffle([word].concat(distractors));
    state.session.options = options;

    if (direction === "meaning") {
      return (
        '<div class="card"><div class="prompt">Which definition fits?</div>' +
        '<div class="bigWord">' + esc(word) + "</div></div>" +
        '<div class="choices">' +
        options.map(w => {
          const r = ALL_WORDS.get(w);
          return '<button class="choice" data-word="' + esc(w) + '">' +
            esc(r ? r.def : w) + "</button>";
        }).join("") +
        "</div>"
      );
    }
    return (
      '<div class="card"><div class="prompt">Which word means this?</div>' +
      '<div class="bigDef">' + esc(rec ? rec.def : "") + "</div></div>" +
      '<div class="choices">' +
      options.map(w =>
        '<button class="choice" data-word="' + esc(w) + '"><b>' + esc(w) + "</b></button>"
      ).join("") +
      "</div>"
    );
  }

  function bindChoice(word) {
    const s = state.session;
    view.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        if (s.answered) return;
        s.answered = true;
        const picked = btn.dataset.word;
        const correct = picked === word;

        view.querySelectorAll(".choice").forEach(b => {
          b.disabled = true;
          if (b.dataset.word === word) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });

        showAfterAnswer(word, correct);
      });
    });
  }

  function showAfterAnswer(word, correct) {
    const panel = document.createElement("div");
    panel.className = "card";
    panel.style.marginTop = "14px";
    panel.innerHTML =
      '<div class="feedback ' + (correct ? "ok" : "no") + '">' +
      (correct ? "Correct" : "Not quite") + "</div>" +
      splitHTML(word, { showExamples: false });
    view.insertBefore(panel, document.getElementById("quitBtn"));

    const next = document.createElement("button");
    next.className = "btn primary wide";
    next.style.marginTop = "12px";
    next.textContent = "Next";
    view.insertBefore(next, document.getElementById("quitBtn"));
    next.addEventListener("click", () => advance(correct, word));
    next.focus();

    if (Store.getSettings().autoAdvance && correct) {
      setTimeout(() => {
        if (state.session && state.session.answered) advance(true, word);
      }, 1100);
    }
  }

  /* --- parts quiz --- */

  function partsHTML(word) {
    const result = Splitter.split(word);
    const candidates = result.parts.filter(p => p.entry);
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    state.session.target = target;

    const sameKind = MORPHEMES[target.entry.kind].filter(m => m.id !== target.entry.id);
    const wrong = sample(sameKind, 3).map(m => m.meaning);
    const options = shuffle([target.meaning].concat(wrong));

    return (
      '<div class="card"><div class="prompt">In <b>' + esc(word) +
      "</b>, what does this part mean?</div>" +
      '<div class="pieces" style="margin-top:10px">' +
      result.parts.map(p => {
        const isTarget = p === target;
        return '<button class="piece ' + p.kind + '" style="' +
          (isTarget ? "" : "opacity:.45") + '">' +
          '<span class="pieceKind">' + esc(p.kind === "link" ? "joins" : p.kind) + "</span>" +
          '<span class="pieceText">' + esc(p.text) + "</span>" +
          (isTarget ? '<span class="pieceMeaning">?</span>' : "") +
          "</button>";
      }).join('<span class="joiner">+</span>') +
      "</div></div>" +
      '<div class="choices">' +
      options.map(m =>
        '<button class="choice" data-meaning="' + esc(m) + '">' + esc(m) + "</button>"
      ).join("") +
      "</div>"
    );
  }

  function bindParts(word) {
    const s = state.session;
    const target = s.target;
    view.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        if (s.answered) return;
        s.answered = true;
        const correct = btn.dataset.meaning === target.meaning;
        view.querySelectorAll(".choice").forEach(b => {
          b.disabled = true;
          if (b.dataset.meaning === target.meaning) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });

        const panel = document.createElement("div");
        panel.className = "card";
        panel.style.marginTop = "14px";
        const entry = target.entry;
        panel.innerHTML =
          '<div class="feedback ' + (correct ? "ok" : "no") + '">' +
          (correct ? "Correct" : "Not quite") + "</div>" +
          "<p><b>" + esc(entry.key) + "-</b> (" +
          esc(ORIGIN_NAMES[entry.origin] || entry.origin) + ") means <b>" +
          esc(entry.meaning) + "</b>.</p>" +
          (entry.examples.length
            ? '<p class="examples"><b>Also in:</b> ' +
              entry.examples.map(e => esc(e)).join(", ") + "</p>"
            : "");
        view.insertBefore(panel, document.getElementById("quitBtn"));

        const next = document.createElement("button");
        next.className = "btn primary wide";
        next.style.marginTop = "12px";
        next.textContent = "Next";
        view.insertBefore(next, document.getElementById("quitBtn"));
        next.addEventListener("click", () => advance(correct, word));
      });
    });
  }

  /* --- spelling --- */

  function spellHTML(word) {
    const rec = ALL_WORDS.get(word);
    const settings = Store.getSettings();
    return (
      '<div class="card"><div class="prompt">Type the word that means:</div>' +
      '<div class="bigDef">' + esc(rec ? rec.def : "") + "</div>" +
      (settings.showHints ? '<p class="small muted">Starts with <b>' +
        esc(word[0].toUpperCase()) + "</b> · " + word.length + " letters</p>" : "") +
      "</div>" +
      '<input class="field" id="spellInput" type="text" autocapitalize="none" ' +
      'autocorrect="off" autocomplete="off" spellcheck="false" placeholder="your answer">' +
      '<button class="btn primary wide" id="checkBtn" style="margin-top:10px">Check</button>'
    );
  }

  function bindSpell(word) {
    const s = state.session;
    const input = document.getElementById("spellInput");
    const check = document.getElementById("checkBtn");

    const submit = () => {
      if (s.answered) return;
      s.answered = true;
      const correct = input.value.trim().toLowerCase() === word;
      input.disabled = true;
      check.disabled = true;

      const panel = document.createElement("div");
      panel.className = "card";
      panel.style.marginTop = "14px";
      panel.innerHTML =
        '<div class="feedback ' + (correct ? "ok" : "no") + '">' +
        (correct ? "Correct" : "The word was " + esc(word)) + "</div>" +
        splitHTML(word, { showExamples: false });
      view.insertBefore(panel, document.getElementById("quitBtn"));

      const next = document.createElement("button");
      next.className = "btn primary wide";
      next.style.marginTop = "12px";
      next.textContent = "Next";
      view.insertBefore(next, document.getElementById("quitBtn"));
      next.addEventListener("click", () => advance(correct, word));
    };

    check.addEventListener("click", submit);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") submit();
    });
    input.focus();
  }

  /* ---------- view: browse ---------- */

  function renderBrowse() {
    viewTitle.textContent = "Words";
    const words = activeWords();
    const sum = Store.summary(words);

    view.innerHTML =
      '<input class="field" id="browseSearch" type="search" autocapitalize="none" ' +
      'autocorrect="off" spellcheck="false" placeholder="Search ' + words.length + ' words…">' +
      '<div class="chips" style="margin:12px 0">' +
      ["all", "new", "shaky", "learning", "mastered"].map(f =>
        '<button class="chip" data-filter="' + f + '" aria-pressed="' +
        (state.browseFilter === f ? "true" : "false") + '">' + esc(f) +
        (f === "all" ? " (" + words.length + ")" : " (" + sum[f] + ")") + "</button>"
      ).join("") +
      "</div>" +
      '<div class="list" id="browseList"></div>';

    const search = document.getElementById("browseSearch");
    const list = document.getElementById("browseList");

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      let items = words.filter(w => {
        if (state.browseFilter !== "all" && Store.level(w) !== state.browseFilter) return false;
        if (!q) return true;
        const rec = ALL_WORDS.get(w);
        return w.indexOf(q) === 0 || (rec && rec.def.toLowerCase().indexOf(q) !== -1);
      });
      const shown = items.slice(0, 120);
      if (!shown.length) {
        list.innerHTML = '<div class="empty"><span class="bigEmoji">🔍</span>No words match.</div>';
        return;
      }
      list.innerHTML =
        shown.map(w => {
          const rec = ALL_WORDS.get(w);
          return '<button class="listItem" data-word="' + esc(w) + '"><span>' +
            '<span class="lw">' + esc(w) + '</span><span class="ld">' +
            esc(rec ? rec.def : "") + '</span></span><span class="dot ' +
            Store.level(w) + '"></span></button>';
        }).join("") +
        (items.length > shown.length
          ? '<p class="small muted center">Showing 120 of ' + items.length + "</p>"
          : "");

      list.querySelectorAll(".listItem").forEach(btn => {
        btn.addEventListener("click", () => showWordDetail(btn.dataset.word));
      });
    };

    search.addEventListener("input", draw);
    view.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        state.browseFilter = chip.dataset.filter;
        renderBrowse();
      });
    });
    draw();
  }

  function showWordDetail(word) {
    viewTitle.textContent = word;
    const e = Store.entry(word);
    view.innerHTML =
      '<button class="btn" id="backBtn" style="margin-bottom:12px">‹ Back</button>' +
      '<div class="card">' + splitHTML(word) + "</div>" +
      '<div class="statGrid">' +
      stat(e.seen, "times seen") +
      stat(e.right, "correct") +
      stat(Store.level(word), "status") +
      stat(e.due && e.due > Date.now()
        ? Math.ceil((e.due - Date.now()) / 86400000) + "d"
        : "now", "next review") +
      "</div>" +
      '<button class="btn wide" id="speakBtn" style="margin-top:12px">🔊 Say it</button>';

    document.getElementById("backBtn").addEventListener("click", renderBrowse);
    document.getElementById("speakBtn").addEventListener("click", () => {
      if (!("speechSynthesis" in window)) return toast("Speech not supported here");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(word));
    });
  }

  /* Tapping a coloured piece jumps to that morpheme's card. Delegated from
   * the view root so it covers splits rendered after the initial paint. */
  view.addEventListener("click", e => {
    const piece = e.target.closest(".piece[data-morpheme]");
    if (!piece || !piece.dataset.morpheme) return;
    if (state.session) return; /* mid-quiz taps must not navigate away */
    const [kind, form] = piece.dataset.morpheme.split(":");
    state.rootFilter = kind;
    showMorphemeDetail(kind, form);
  });

  /* ---------- view: roots ---------- */

  function renderRoots() {
    viewTitle.textContent = "Roots & Affixes";
    const kind = state.rootFilter;
    const entries = MORPHEMES[kind];

    view.innerHTML =
      '<div class="chips" style="margin-bottom:12px">' +
      [["prefix", "Prefixes"], ["root", "Roots"], ["suffix", "Suffixes"]].map(([k, label]) =>
        '<button class="chip" data-kind="' + k + '" aria-pressed="' +
        (kind === k ? "true" : "false") + '">' + label + " (" + MORPHEMES[k].length + ")</button>"
      ).join("") +
      "</div>" +
      '<input class="field" id="rootSearch" type="search" autocapitalize="none" ' +
      'autocorrect="off" spellcheck="false" placeholder="Search meanings and spellings…">' +
      '<div class="list" id="rootList" style="margin-top:12px"></div>';

    const search = document.getElementById("rootSearch");
    const list = document.getElementById("rootList");

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const items = entries.filter(e =>
        !q || e.variants.some(v => v.indexOf(q) === 0) || e.meaning.toLowerCase().indexOf(q) !== -1
      );
      if (!items.length) {
        list.innerHTML = '<div class="empty"><span class="bigEmoji">🌱</span>Nothing matches.</div>';
        return;
      }
      list.innerHTML = items.map(e =>
        '<button class="listItem" data-id="' + esc(e.id) + '"><span>' +
        '<span class="lw">' + esc(e.variants.join(", ")) + '</span>' +
        '<span class="ld">' + esc(e.meaning) + "</span></span>" +
        '<span class="small muted">' + esc(e.origin) + "</span></button>"
      ).join("");
      list.querySelectorAll(".listItem").forEach(btn => {
        btn.addEventListener("click", () => {
          const entry = entries.find(x => x.id === btn.dataset.id);
          showMorphemeDetail(kind, entry.key);
        });
      });
    };

    search.addEventListener("input", draw);
    view.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        state.rootFilter = chip.dataset.kind;
        renderRoots();
      });
    });
    draw();
  }

  function showMorphemeDetail(kind, form) {
    const entry = (MORPHEMES[kind] || []).find(e => e.variants.indexOf(form) !== -1) ||
      ["prefix", "root", "suffix"].reduce((found, k) =>
        found || MORPHEMES[k].find(e => e.variants.indexOf(form) !== -1), null);

    if (!entry) {
      toast("No entry for that part");
      return;
    }

    viewTitle.textContent = entry.key;
    const inCorpus = wordsWithMorpheme(entry.id).slice(0, 24);

    view.innerHTML =
      '<button class="btn" id="backBtn" style="margin-bottom:12px">‹ Back</button>' +
      '<div class="card">' +
      '<div class="confidence">' + esc(entry.kind) + " · " +
      esc(ORIGIN_NAMES[entry.origin] || entry.origin) + "</div>" +
      '<div class="wordHead"><span class="word">' + esc(entry.variants.join(", ")) + "</span></div>" +
      '<p class="definition">' + esc(entry.meaning) + "</p>" +
      (entry.examples.length
        ? '<p class="examples"><b>Classic examples:</b> ' +
          entry.examples.map(e => esc(e)).join(", ") + "</p>"
        : "") +
      "</div>" +
      (inCorpus.length
        ? '<div class="sectionTitle">In your word lists (' + inCorpus.length + ')</div>' +
          '<div class="list">' + inCorpus.map(w => {
            const rec = ALL_WORDS.get(w);
            return '<button class="listItem" data-word="' + esc(w) + '"><span>' +
              '<span class="lw">' + esc(w) + '</span><span class="ld">' +
              esc(rec ? rec.def : "") + "</span></span></button>";
          }).join("") + "</div>"
        : '<p class="small muted center">No study words use this part yet.</p>');

    document.getElementById("backBtn").addEventListener("click", renderRoots);
    view.querySelectorAll(".listItem[data-word]").forEach(btn => {
      btn.addEventListener("click", () => showWordDetail(btn.dataset.word));
    });
  }

  /* ---------- view: settings ---------- */

  function renderSettings() {
    viewTitle.textContent = "Settings";
    const s = Store.getSettings();
    const stats = Store.getStats();

    view.innerHTML =
      '<div class="sectionTitle">Word lists</div><div class="card">' +
      Object.keys(LISTS).map(key =>
        settingSwitch(
          "list-" + key,
          LISTS[key].name,
          LISTS[key].words.length + " words",
          s.lists.indexOf(key) !== -1
        )
      ).join("") +
      "</div>" +

      '<div class="sectionTitle">Session</div><div class="card">' +
      '<div class="settingRow"><div><div class="sname">Words per session</div>' +
      '<div class="sdesc">How many questions a study run holds</div></div>' +
      '<select class="field" id="sessionLength" style="width:auto">' +
      [10, 15, 20, 30, 50].map(n =>
        '<option value="' + n + '"' + (s.sessionLength === n ? " selected" : "") + ">" + n + "</option>"
      ).join("") +
      "</select></div>" +
      settingSwitch("hardestFirst", "Hardest words first", "Prioritize the ones you keep missing", s.hardestFirst) +
      settingSwitch("showHints", "Show part hints", "Reveal prefix and root clues before you answer", s.showHints) +
      settingSwitch("autoAdvance", "Auto-advance", "Move on automatically after a correct answer", s.autoAdvance) +
      settingSwitch("speakWords", "Speak words aloud", "Read each word using the device voice", s.speakWords) +
      "</div>" +

      '<div class="sectionTitle">Appearance</div><div class="card">' +
      '<div class="settingRow"><div><div class="sname">Theme</div>' +
      '<div class="sdesc">Match the system or force one</div></div>' +
      '<select class="field" id="theme" style="width:auto">' +
      [["system", "System"], ["dark", "Dark"], ["light", "Light"]].map(([v, label]) =>
        '<option value="' + v + '"' + (s.theme === v ? " selected" : "") + ">" + label + "</option>"
      ).join("") +
      "</select></div></div>" +

      '<div class="sectionTitle">Progress</div><div class="card">' +
      '<div class="statGrid">' +
      stat(stats.studied || 0, "answers given") +
      stat(stats.studied ? Math.round((stats.correct / stats.studied) * 100) + "%" : "—", "accuracy") +
      "</div>" +
      '<button class="btn bad wide" id="resetBtn" style="margin-top:12px">Reset all progress</button>' +
      "</div>" +

      '<div class="sectionTitle">Add to Home Screen</div><div class="card small muted">' +
      "<p style=\"margin-top:0\">In Safari, tap the <b>Share</b> button, then " +
      "<b>Add to Home Screen</b>. WordSplit then opens full screen and works " +
      "with no connection — all " + ALL_WORDS.size + " words and " +
      (MORPHEMES.prefix.length + MORPHEMES.root.length + MORPHEMES.suffix.length) +
      " word parts are stored on the device.</p></div>";

    Object.keys(LISTS).forEach(key => {
      document.getElementById("list-" + key).addEventListener("change", e => {
        const lists = Store.getSettings().lists.slice();
        const at = lists.indexOf(key);
        if (e.target.checked && at === -1) lists.push(key);
        if (!e.target.checked && at !== -1) lists.splice(at, 1);
        if (!lists.length) {
          e.target.checked = true;
          toast("Keep at least one list on");
          return;
        }
        Store.setSetting("lists", lists);
        toast("Word list updated");
      });
    });

    ["hardestFirst", "showHints", "autoAdvance", "speakWords"].forEach(key => {
      document.getElementById(key).addEventListener("change", e => {
        Store.setSetting(key, e.target.checked);
      });
    });

    document.getElementById("sessionLength").addEventListener("change", e => {
      Store.setSetting("sessionLength", parseInt(e.target.value, 10));
    });

    document.getElementById("theme").addEventListener("change", e => {
      Store.setSetting("theme", e.target.value);
      applyTheme();
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      if (!window.confirm("Erase every word's progress and streak? This cannot be undone.")) return;
      Store.resetProgress();
      updateStreakChip();
      renderSettings();
      toast("Progress reset");
    });
  }

  function settingSwitch(id, name, desc, checked) {
    return (
      '<div class="settingRow"><div><div class="sname">' + esc(name) + "</div>" +
      '<div class="sdesc">' + esc(desc) + "</div></div>" +
      '<label class="switch"><input type="checkbox" id="' + esc(id) + '"' +
      (checked ? " checked" : "") + '><span class="track"></span><span class="knob"></span></label></div>'
    );
  }

  /* ---------- chrome ---------- */

  function applyTheme() {
    const theme = Store.getSettings().theme;
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }

  function updateStreakChip() {
    const stats = Store.getStats();
    if (stats.streak > 0) {
      streakChip.hidden = false;
      streakChip.textContent = "🔥 " + stats.streak + " day" + (stats.streak === 1 ? "" : "s");
    } else {
      streakChip.hidden = true;
    }
  }

  const VIEWS = {
    split: renderSplit,
    study: renderStudy,
    browse: renderBrowse,
    roots: renderRoots,
    settings: renderSettings
  };

  function go(name) {
    state.view = name;
    if (name !== "study") state.session = null;
    tabbar.querySelectorAll(".tab").forEach(tab => {
      tab.setAttribute("aria-current", tab.dataset.view === name ? "true" : "false");
    });
    window.scrollTo(0, 0);
    (VIEWS[name] || renderSplit)();
  }

  tabbar.addEventListener("click", e => {
    const tab = e.target.closest(".tab");
    if (tab) go(tab.dataset.view);
  });

  applyTheme();
  updateStreakChip();
  go("split");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline caching is best-effort */
      });
    });
  }
})();
