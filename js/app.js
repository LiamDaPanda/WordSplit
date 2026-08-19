/* WordSplit — views, navigation, and the study modes. */
(function () {
  const Store = window.WordStore;
  const Splitter = window.WordSplitter;
  const Learner = window.WordLearner || null;
  const Memes = window.WordMemes || null;
  const Analogy = window.WordAnalogy || null;
  const MORPHEMES = window.WS_MORPHEMES;
  const ORIGIN_NAMES = window.WS_ORIGIN_NAMES;

  /* There is one list: the Upper Level SSAT. Nothing else is studied, offered,
   * or switchable.
   *
   * The everyday words loaded alongside it are not a second list — they are a
   * recognition dictionary. They exist so that looking a word up returns a
   * definition instead of a blank, and so the splitter has a vocabulary wide
   * enough to tell a real word from a typo. They are never drilled, never
   * counted, and never named as a choice. */
  const STUDY_LIST = {
    key: "ssat",
    name: "Upper Level SSAT",
    raw: window.WS_LIST_SSAT || []
  };
  const RECOGNITION = { key: "core", raw: window.WS_LIST_CORE || [] };
  const LISTS = { ssat: STUDY_LIST, core: RECOGNITION };

  const POS_NAMES = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };

  /* word -> {word, pos, def, lists[]} across every list, built once */
  const ALL_WORDS = new Map();
  [STUDY_LIST, RECOGNITION].forEach(list => {
    const key = list.key;
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

  /* Everything that is studied, played, and browsed. */
  function activeWords() {
    return STUDY_LIST.words.length ? STUDY_LIST.words : [...ALL_WORDS.keys()];
  }

  /* Endings that let a definition be found for a form the dictionary does not
   * list directly. Two kinds:
   *
   *  - inflection, where the word is the same word ("abating" -> "abate")
   *  - derivation, where it is a word built from another ("audibility" ->
   *    "audible"), which is where most real lookups were failing: nobody
   *    types the dictionary headword, they type the form they just read.
   *
   * Sorted longest-ending-first at load, so "ibility" is tried before "ity"
   * and the table can be written in whatever order reads best. */
  const ENDINGS = [
    { end: "ibility", add: ["ible"], note: "the quality of being" },
    { end: "ability", add: ["able"], note: "the quality of being" },
    { end: "ically", add: ["ic", "ical"], note: "the adverb from" },
    { end: "ously", add: ["ous"], note: "the adverb from" },
    { end: "ently", add: ["ent"], note: "the adverb from" },
    { end: "antly", add: ["ant"], note: "the adverb from" },
    { end: "fully", add: ["ful", ""], note: "the adverb from" },
    { end: "ily", add: ["y"], note: "the adverb from" },
    { end: "ness", add: ["", "e"], note: "the quality of being" },
    { end: "ancy", add: ["ant", "ance"], note: "the state of being" },
    { end: "ency", add: ["ent", "ence"], note: "the state of being" },
    { end: "acy", add: ["ate", "ant"], note: "the state of being" },
    { end: "atory", add: ["ate"], note: "relating to" },
    { end: "ized", add: ["ize"], note: "past tense of" },
    { end: "ised", add: ["ise", "ize"], note: "past tense of" },
    { end: "izing", add: ["ize"], note: "the -ing form of" },
    { end: "ments", add: ["ment"], note: "plural of" },
    { end: "ies", add: ["y"], note: "plural of" },
    { end: "ied", add: ["y"], note: "past tense of" },
    { end: "ing", add: ["", "e"], note: "the -ing form of" },
    { end: "es", add: ["", "e"], note: "plural of" },
    { end: "ed", add: ["", "e"], note: "past tense of" },
    { end: "est", add: ["", "e"], note: "the superlative of" },
    { end: "er", add: ["", "e"], note: "the comparative of" },
    { end: "ly", add: ["", "e"], note: "the adverb from" },
    { end: "s", add: [""], note: "plural of" }
  ].sort((x, y) => y.end.length - x.end.length);

  /* Find a definition for any word: the entry itself, or the entry for the
   * form it is built from. Returns null only when the word is unknown. */
  function lookupWord(raw) {
    const word = String(raw || "").toLowerCase().trim();
    if (!word) return null;

    const direct = ALL_WORDS.get(word);
    if (direct) return { word, rec: direct, base: word, note: null };

    for (const rule of ENDINGS) {
      if (!word.endsWith(rule.end)) continue;
      const stem = word.slice(0, word.length - rule.end.length);
      if (stem.length < 2) continue;
      const forms = rule.add.map(a => stem + a);
      /* a final -y becomes -i before some endings ("happy" -> "happiest") */
      if (stem.endsWith("i")) forms.push(stem.slice(0, -1) + "y");
      /* a doubled final consonant is dropped before -ing/-ed ("running") */
      const last = stem[stem.length - 1];
      if (stem.length > 3 && last === stem[stem.length - 2] && "bdfglmnprt".includes(last)) {
        forms.push(stem.slice(0, -1));
      }
      for (const form of forms) {
        const rec = ALL_WORDS.get(form);
        if (rec) return { word, rec, base: form, note: rule.note };
      }
    }
    return null;
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

  /* ---------- the peanut gallery ---------- */

  /* The run has to be counted here rather than in advance(), which does not
   * run until the reader taps Next — by then the caption is already on screen. */
  function noteAnswer(correct) {
    const s = state.session;
    if (!s) return { run: correct ? 1 : 0, hadMissed: false };
    const hadMissed = !!s.everMissed;
    if (correct) {
      s.run = (s.run || 0) + 1;
      return { run: s.run, hadMissed };
    }
    const ended = s.run || 0;
    s.everMissed = true;
    s.run = 0;
    return { run: ended, hadMissed };
  }

  function memeHTML(meme, correct) {
    if (!meme || !Memes || Store.getSettings().memes === false) return "";
    /* A real image wins when the library has one that fits the outcome; the
     * drawn face is the fallback, not the preference. */
    const img = Memes.Library.pick(correct, Store.getSettings().builtinMemes !== false);
    if (img) return memeCardHTML(img, meme.line, correct);
    return (
      '<div class="meme ' + (correct ? "ok" : "no") + '">' +
      icon("face-" + meme.face, "memeFace") +
      '<span class="memeLine">' + esc(meme.line) + "</span></div>"
    );
  }

  /* The classic layout: image, heavy condensed caption in white with a black
   * outline, laid over the bottom. The caption the meme was saved with wins;
   * otherwise the generated line rides along. */
  function memeCardHTML(img, fallbackLine, correct) {
    const caption = img.caption || fallbackLine || "";
    return (
      '<figure class="memeCard ' + (correct ? "ok" : "no") + '">' +
      '<img src="' + esc(img.url) + '" alt="" loading="lazy">' +
      (caption
        ? '<figcaption class="memeCap">' + esc(caption) + "</figcaption>"
        : "") +
      "</figure>"
    );
  }

  /* A caption above the real feedback, never instead of it. */
  function feedbackHTML(correct, text) {
    const st = noteAnswer(correct);
    const meme = Memes ? Memes.answer(correct, st.run, st.hadMissed) : null;
    return (
      memeHTML(meme, correct) +
      '<div class="feedback ' + (correct ? "ok" : "no") + '">' + esc(text) + "</div>"
    );
  }

  /* ---------- split rendering ---------- */

  function pieceHTML(part) {
    let kindLabel = part.kind === "link" ? "joins" : part.kind;
    let meaning = part.meaning;
    if (part.kind === "base" && !meaning) {
      /* A leftover middle is only "the base word" when it really is one.
       * "abhorrence" leaves "abhorr", which is not a word and should not be
       * called one — it is a bound stem, so say that instead of overclaiming. */
      const isWord = ALL_WORDS.has(part.text);
      kindLabel = isWord ? "base" : "stem";
      meaning = isWord ? "a word on its own" : "what the affixes attach to";
    }
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
    const found = lookupWord(word);
    const rec = found ? found.rec : null;
    let html = "";

    if (options.showWord !== false) {
      html += '<div class="wordHead"><span class="word">' + esc(word) + "</span>";
      if (rec && rec.pos) {
        html += '<span class="pos">' + esc(POS_NAMES[rec.pos] || rec.pos) + "</span>";
      }
      html += "</div>";

      if (options.showDefinition !== false) {
        /* A definition always appears. If the word is an inflected form, the
         * base word's meaning stands in, labelled so it is not a surprise. */
        if (rec && found.note) {
          html +=
            '<p class="defRow"><span class="defLabel">Meaning:</span>' +
            '<span class="defText">' + esc(found.note) + " <b>" + esc(found.base) +
            "</b> — " + esc(rec.def) + "</span></p>";
        } else if (rec) {
          html +=
            '<p class="defRow"><span class="defLabel">Meaning:</span>' +
            '<span class="defText">' + esc(rec.def) + "</span></p>";
        } else {
          /* No dictionary entry, but if the parts are real the word can
           * still be explained by what they mean — which is the whole
           * premise of the app, so it should not go blank here. */
          const literal = Splitter.literalReading(result);
          html +=
            '<p class="defRow"><span class="defLabel">Meaning:</span>' +
            '<span class="defText muted">' +
            (literal
              ? "Not in the dictionary, but its parts read as <b>" +
                esc(literal) + "</b>."
              : "Not in the dictionary — this may be a typo, or a word " +
                "WordSplit has not learned yet.") +
            "</span></p>";
        }
      }
    }

    if (result.parts.length > 1) {
      html += '<div class="pieces">';
      /* The joiner travels with the piece that follows it, so a row that
       * wraps never leaves a dangling "+" at the end of a line. */
      result.parts.forEach((part, i) => {
        html += i
          ? '<span class="pieceGroup"><span class="joiner">+</span>' +
            pieceHTML(part) + "</span>"
          : pieceHTML(part);
      });
      html += "</div>";

      if (result.inflection) {
        html +=
          '<p class="defRow small"><span class="defLabel">Ending:</span>' +
          '<span class="defText muted"><b>' + esc(result.inflection.label) +
          "</b> — " + esc(result.inflection.note) +
          ", removed to show the base.</span></p>";
      }

      const literal = Splitter.literalReading(result);
      if (literal) {
        html +=
          '<div class="literal"><span class="defLabel">Read the parts:</span>' +
          '<span class="defText"><b>' + esc(literal) + "</b></span></div>";
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
          '<p class="defRow examples"><span class="defLabel">Same roots:</span>' +
          '<span class="defText">' + shared.map(w => esc(w)).join(", ") + "</span></p>";
      }
    }

    /* Teaching the splitter is only offered where a reading is actually in
     * question — not mid-quiz, and not for words it refused to split. */
    if (options.allowTeach && Learner && result.parts.length > 1 && !result.overridden) {
      html +=
        '<div class="teach" data-teach-word="' + esc(word) + '">' +
        '<span class="small muted">Is this breakdown right?</span>' +
        '<span class="teachBtns">' +
        '<button class="pill" data-teach="yes">Yes</button>' +
        '<button class="pill" data-teach="other">Show other readings</button>' +
        "</span></div>";
    }
    return html;
  }

  /* The ranked alternatives, for someone to pick the right one from. */
  function alternativesHTML(word) {
    const cands = Splitter.candidates(word, 6);
    if (cands.length < 2) {
      return '<p class="small muted">The splitter only sees one way to read this word.</p>';
    }
    return (
      '<div class="sectionTitle">Pick the right reading</div>' +
      '<div class="list">' +
      cands.map((c, i) =>
        '<button class="listItem" data-pick="' + esc(c.signature) +
        '" data-pick-word="' + esc(word) + '"><span>' +
        '<span class="lw">' + c.parts.map(p => esc(p.text)).join(" + ") + "</span>" +
        '<span class="ld">' +
        c.parts.map(p => esc(p.entry ? p.meaning : "stem")).join(" · ") +
        "</span></span>" +
        (i === 0 ? '<span class="small muted">current</span>' : "") +
        "</button>"
      ).join("") +
      "</div>" +
      '<p class="small muted">Choosing one teaches the splitter. It learns the ' +
      "word parts, not just this word, so related words shift too.</p>"
    );
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

  /* ---------- study mode: analogies ---------- */

  let questions = null;

  /* Distractors that are not obviously wrong: same ending where possible, so
   * the question turns on the relation rather than on the shape of the word. */
  function analogyDistractors(answer, n) {
    const pool = activeWords();
    const tail = answer.slice(-3);
    const alike = pool.filter(w => w !== answer && w.endsWith(tail));
    const out = sample(alike, n);
    if (out.length < n) {
      sample(pool, n * 3).forEach(w => {
        if (out.length < n && w !== answer && out.indexOf(w) === -1) out.push(w);
      });
    }
    return out.slice(0, n);
  }

  function analogyQuestionHTML(q) {
    if (!q) return '<div class="card"><p class="muted">No question.</p></div>';
    return (
      '<div class="card"><div class="prompt">Complete the analogy</div>' +
      '<div class="analogyLine">' +
      "<b>" + esc(q.a) + '</b> <span class="relIs">is to</span> <b>' + esc(q.b) + "</b>" +
      '<span class="relAs">as</span>' +
      "<b>" + esc(q.c) + '</b> <span class="relIs">is to</span> <b class="blank">?</b>' +
      "</div></div>" +
      '<div class="choices">' +
      q.options.map(w =>
        '<button class="choice" data-word="' + esc(w) + '">' + esc(w) + "</button>"
      ).join("") +
      "</div>"
    );
  }

  function bindAnalogyQuestion(q) {
    view.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        const s = state.session;
        if (s.answered) return;
        s.answered = true;
        const correct = btn.dataset.word === q.answer;

        view.querySelectorAll(".choice").forEach(b => {
          b.disabled = true;
          if (b.dataset.word === q.answer) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });

        const panel = document.createElement("div");
        panel.className = "card";
        panel.style.marginTop = "14px";
        panel.innerHTML =
          feedbackHTML(correct, correct ? "Correct" : "It was " + q.answer) +
          '<p class="defRow"><span class="defLabel">Relation:</span>' +
          '<span class="defText">' + esc(q.relation ? q.relation.label : "") +
          "</span></p>" +
          '<p class="defRow"><span class="defLabel">Both pairs:</span>' +
          '<span class="defText"><b>' + esc(q.a) + "</b> → <b>" + esc(q.b) +
          "</b> and <b>" + esc(q.c) + "</b> → <b>" + esc(q.answer) + "</b></span></p>" +
          splitHTML(q.answer, { showExamples: false, allowTeach: false });
        view.insertBefore(panel, document.getElementById("quitBtn"));

        const next = document.createElement("button");
        next.className = "btn primary wide";
        next.style.marginTop = "12px";
        next.textContent = "Next";
        view.insertBefore(next, document.getElementById("quitBtn"));
        next.addEventListener("click", () => advance(correct, q.answer));
        next.focus();
      });
    });
  }

  /* ---------- view: analogies ---------- */

  /* The SSAT asks "A is to B as C is to what?". Put two words in and the app
   * names the relation between them, then finds other pairs that stand in the
   * same relation — which is the point, because the relation is nearly always
   * structural, and once you see it once you have it for every word built the
   * same way. */
  function renderAnalogy(preload) {
    viewTitle.textContent = "Analogies";
    const a = (preload && preload[0]) || "";
    const b = (preload && preload[1]) || "";

    view.innerHTML =
      '<form class="pairRow" id="pairForm">' +
      '<input class="field" id="pairA" type="search" autocapitalize="none" ' +
      'autocorrect="off" spellcheck="false" placeholder="first word" value="' +
      esc(a) + '">' +
      '<span class="pairIs">is to</span>' +
      '<input class="field" id="pairB" type="search" autocapitalize="none" ' +
      'autocorrect="off" spellcheck="false" placeholder="second word" value="' +
      esc(b) + '">' +
      '<button class="btn primary" id="pairGo" type="submit">Find</button>' +
      "</form>" +
      '<div id="pairResult"></div>';

    document.getElementById("pairForm").addEventListener("submit", e => {
      e.preventDefault();
      showAnalogy(
        document.getElementById("pairA").value,
        document.getElementById("pairB").value
      );
    });

    if (a && b) showAnalogy(a, b);
    else {
      document.getElementById("pairResult").innerHTML =
        '<div class="card"><p class="small muted" style="margin-top:0">Put in two ' +
        "words that feel related and the app works out how, then finds other " +
        "pairs that relate the same way.</p>" +
        '<div class="sectionTitle" style="margin-top:14px">Try one</div>' +
        '<div class="chips">' +
        [["benevolent", "malevolent"], ["audible", "inaudible"],
         ["import", "export"], ["negligent", "diligent"]].map(([x, y]) =>
          '<button class="chip" data-pair="' + esc(x) + "|" + esc(y) + '">' +
          esc(x) + " : " + esc(y) + "</button>").join("") +
        "</div></div>";
      view.querySelectorAll("[data-pair]").forEach(chip => {
        chip.addEventListener("click", () => {
          const [x, y] = chip.dataset.pair.split("|");
          document.getElementById("pairA").value = x;
          document.getElementById("pairB").value = y;
          showAnalogy(x, y);
        });
      });
    }
  }

  function showAnalogy(rawA, rawB) {
    const box = document.getElementById("pairResult");
    if (!box) return;
    const a = String(rawA || "").toLowerCase().trim();
    const b = String(rawB || "").toLowerCase().trim();
    if (!a || !b) return;

    const missing = [a, b].filter(w => !Analogy || !Splitter.split(w).parts.some(p => p.entry));
    if (!Analogy) {
      box.innerHTML = '<div class="card"><p class="muted">Analogies are unavailable.</p></div>';
      return;
    }

    const rel = Analogy.relate(a, b);
    if (!rel) {
      box.innerHTML =
        '<div class="card"><div class="feedback no">No shared structure</div>' +
        "<p><b>" + esc(a) + "</b> and <b>" + esc(b) + "</b> do not share a root " +
        "or an affix frame, so there is no breakdown-level relation to show." +
        (missing.length
          ? " " + esc(missing.join(" and ")) + " may also be outside the dictionary."
          : "") +
        "</p><p class=\"small muted\" style=\"margin-bottom:0\">This app only " +
        "claims relations it can point at in the spelling. Two words can still " +
        "be related in meaning without being related in build.</p></div>" +
        pairSplitHTML(a, b);
      return;
    }

    const pairs = Analogy.analogues(a, b, 12);
    box.innerHTML =
      '<div class="card">' +
      '<div class="relHead">' + esc(a) + ' <span class="relIs">is to</span> ' + esc(b) + "</div>" +
      '<div class="relTag' + (rel.opposite ? " opposed" : "") + '">' + esc(rel.label) + "</div>" +
      relDetailHTML(rel) +
      "</div>" +
      (pairs.length
        ? '<div class="sectionTitle">Pairs that relate the same way</div>' +
          '<div class="list">' + pairs.map(p =>
            '<button class="listItem" data-word="' + esc(p.a) + '"' +
            (p.b ? ' data-pair-b="' + esc(p.b) + '"' : "") + '>' +
            '<span class="liText"><span class="lw">' + esc(p.a) +
            (p.b ? ' <span class="relIs">is to</span> ' + esc(p.b) : "") + "</span>" +
            '<span class="ld">' + esc(pairGloss(p)) + "</span></span>" +
            (Analogy.isStudy(p.a) ? '<span class="dot ' + Store.level(p.a) + '"></span>' : "") +
            "</button>").join("") + "</div>"
        : '<p class="small muted center">No other pair in the dictionary relates ' +
          "this way — the relation is real, but this one is on its own.</p>") +
      pairSplitHTML(a, b);

    box.querySelectorAll(".listItem").forEach(btn => {
      btn.addEventListener("click", () => {
        const other = btn.dataset.pairB;
        if (other) renderAnalogy([btn.dataset.word, other]);
        else showWordDetail(btn.dataset.word);
      });
    });
  }

  function relDetailHTML(rel) {
    if (rel.type === "shared-root") {
      return '<p class="defRow"><span class="defLabel">Shared root:</span>' +
        '<span class="defText"><b>' + esc(rel.fromText) + "</b> — " +
        esc(rel.fromMeaning) + "</span></p>";
    }
    const arrow = '<span class="relArrow">→</span>';
    return (
      '<p class="defRow"><span class="defLabel">Changes:</span><span class="defText">' +
      "<b>" + esc(rel.fromText || "nothing") + "</b> " + arrow + " <b>" +
      esc(rel.toText || "nothing") + "</b></span></p>" +
      (rel.fromMeaning || rel.toMeaning
        ? '<p class="defRow"><span class="defLabel">Meaning:</span>' +
          '<span class="defText">' + esc(rel.fromMeaning || "—") + " " + arrow +
          " " + esc(rel.toMeaning || "—") + "</span></p>"
        : "")
    );
  }

  function pairGloss(p) {
    const rec = ALL_WORDS.get(p.b || p.a);
    return rec ? rec.def : "";
  }

  function pairSplitHTML(a, b) {
    return (
      '<div class="sectionTitle">Both, broken apart</div>' +
      '<div class="card">' + splitHTML(a, { showExamples: false, allowTeach: false }) + "</div>" +
      '<div class="card" style="margin-top:10px">' +
      splitHTML(b, { showExamples: false, allowTeach: false }) + "</div>"
    );
  }

  /* ---------- view: split ---------- */

  function renderSplit(preload) {
    viewTitle.textContent = "WordSplit";
    const words = activeWords();
    const daily = words[Math.floor(dayNumber() % words.length)];

    view.innerHTML =
      '<form class="searchRow" id="splitForm">' +
      '<input class="field" id="splitInput" type="search" autocapitalize="none" ' +
      'autocorrect="off" spellcheck="false" enterkeyhint="search" ' +
      'placeholder="Type a word to break apart…">' +
      '<button class="btn primary" id="splitGo" type="submit">Split</button>' +
      "</form>" +
      '<div id="splitResult"></div>' +
      '<div class="sectionTitle">Word of the day</div>' +
      '<div class="card" id="dailyCard">' + splitHTML(daily, { allowTeach: true }) + "</div>" +
      '<button class="btn wide" id="randomBtn">' + icon("shuffle", "bIcon") +
        " Split a random word</button>";

    const input = document.getElementById("splitInput");
    const result = document.getElementById("splitResult");

    /* Only real words get broken apart. Typing letters that are not a word
     * used to produce a confident-looking split of nothing, so an unknown
     * string now says so and offers the split as an explicit choice. */
    const run = force => {
      const value = input.value.trim().toLowerCase();
      if (!value) {
        result.innerHTML = "";
        return;
      }
      if (!/^[a-z][a-z'-]*$/.test(value)) {
        result.innerHTML =
          '<div class="card"><p class="muted">Letters only, please — ' +
          esc(value) + " is not a word.</p></div>";
        return;
      }

      const found = lookupWord(value);
      if (!found && !force) {
        result.innerHTML =
          '<div class="card"><div class="wordHead"><span class="word">' +
          esc(value) + "</span></div>" +
          '<p class="defRow"><span class="defLabel">Meaning:</span>' +
          '<span class="defText muted">Not in the dictionary. WordSplit knows ' +
          ALL_WORDS.size.toLocaleString() + " words — check the spelling, or " +
          "split it anyway to see which parts it recognizes.</span></p>" +
          '<button class="btn wide" id="forceSplit" style="margin-top:12px">' +
          "Split it anyway</button></div>";
        const force0 = document.getElementById("forceSplit");
        if (force0) force0.addEventListener("click", () => run(true));
        return;
      }

      result.innerHTML =
        '<div class="card">' + splitHTML(value, { allowTeach: true }) + "</div>";
      if (!found) {
        result.innerHTML +=
          '<p class="small muted center">Split from the word parts alone — ' +
          "this word is not in the dictionary, so treat the reading as a guess.</p>";
      }
    };

    document.getElementById("splitForm").addEventListener("submit", e => {
      e.preventDefault();
      input.blur(); /* dismisses the iOS keyboard so the result is visible */
      run(false);
    });
    input.addEventListener("search", () => run(false));
    if (preload) {
      input.value = preload;
      run(false);
    }
    document.getElementById("randomBtn").addEventListener("click", () => {
      const w = words[Math.floor(Math.random() * words.length)];
      input.value = w;
      run(false);
      speak(w);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function dayNumber() {
    return Math.floor(Date.now() / 86400000);
  }

  /* ---------- view: study ---------- */

  const MODES = [
    { id: "flashcards", icon: "cards", name: "Flashcards", desc: "See the word, recall the meaning, grade yourself." },
    { id: "meaning", icon: "study", name: "Pick the meaning", desc: "Multiple choice from the word to its definition." },
    { id: "word", icon: "letters", name: "Pick the word", desc: "Multiple choice from the definition back to the word." },
    { id: "parts", icon: "puzzle", name: "Parts quiz", desc: "Identify what a prefix, root, or suffix means." },
    { id: "spell", icon: "keyboard", name: "Spell it", desc: "Read the definition and type the word." },
    { id: "analogies", icon: "pairs", name: "Analogies", desc: "A is to B as C is to what — the SSAT's own format." },
    { id: "review", icon: "repeat", name: "Due review", desc: "Only the words your schedule says are due." }
  ];

  /* One <use> of the sprite in index.html; colour comes from the theme. */
  function icon(id, cls) {
    return '<svg class="' + (cls || "gIcon") + '" aria-hidden="true"><use href="#i-' +
      id + '"/></svg>';
  }

  function renderStudy() {
    viewTitle.textContent = "Study";
    if (state.session) return renderSession();

    const words = activeWords();
    const sum = Store.summary(words);
    const stats = Store.getStats();
    const settings = Store.getSettings();

    view.innerHTML =
      masteryCard(words, sum) +
      '<div class="statGrid">' +
      stat(sum.due, "due now") +
      stat(stats.streak || 0, "day streak") +
      "</div>" +
      '<div class="sectionTitle">Study modes</div>' +
      MODES.map(m =>
        '<button class="modeCard" data-mode="' + m.id + '">' +
        '<span class="mIcon">' + icon(m.icon) + "</span><span><span class=\"mName\">" +
        esc(m.name) + '</span><span class="mDesc">' + esc(m.desc) + "</span></span></button>"
      ).join("") +
      '<p class="small muted center">Sessions are ' + settings.sessionLength +
      " words — change that in Settings.</p>";

    view.querySelectorAll(".modeCard").forEach(btn => {
      btn.addEventListener("click", () => startSession(btn.dataset.mode));
    });
  }

  /* A donut of how the list breaks down by mastery, with the counts beside
   * it. The ring is a conic gradient driven by three custom properties, so
   * there is no chart library and nothing to load. */
  function masteryCard(words, sum) {
    const total = words.length || 1;
    const pctOf = n => (100 * n) / total;
    const known = Math.round(pctOf(sum.mastered));
    const rows = [
      ["mastered", sum.mastered, "var(--good)"],
      ["learning", sum.learning, "var(--warn)"],
      ["shaky", sum.shaky, "var(--bad)"],
      ["not seen", sum.new, "var(--surface-3)"]
    ];

    return (
      '<div class="card"><div class="ringRow">' +
      '<div class="ring" style="--mastered:' + pctOf(sum.mastered) +
      ";--learning:" + pctOf(sum.learning) +
      ";--shaky:" + pctOf(sum.shaky) + '">' +
      '<span class="ringLabel"><b>' + known + "%</b><span>mastered</span></span></div>" +
      '<div class="legend">' +
      rows.map(([name, n, color]) =>
        '<div><span class="dot" style="background:' + color + '"></span>' +
        "<b>" + n.toLocaleString() + "</b> " +
        '<span class="muted">' + esc(name) + "</span></div>"
      ).join("") +
      "</div></div></div>"
    );
  }

  function stat(value, label) {
    return '<div class="stat"><span class="sv">' + esc(value) + '</span>' +
      '<span class="sl">' + esc(label) + "</span></div>";
  }

  let sessionCounter = 0;

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
    } else if (mode === "analogies") {
      /* Questions are generated, not drawn from the list, so the queue holds
       * the answer word of each — which keeps scoring, the Leitner schedule
       * and the progress dots working exactly as they do everywhere else. */
      questions = [];
      const seen = new Set();
      for (let i = 0; i < settings.sessionLength * 4 && questions.length < settings.sessionLength; i++) {
        const q = Analogy && Analogy.question(analogyDistractors);
        if (!q) continue;
        const sig = q.a + ">" + q.b + ">" + q.c;
        if (seen.has(sig)) continue;
        seen.add(sig);
        questions.push(q);
      }
      if (!questions.length) {
        toast("Not enough related pairs to build a round");
        return;
      }
      pool = questions.map(q => q.answer);
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
      /* stamped so a timer left over from a previous session cannot advance
       * this one when someone quits and restarts quickly */
      id: (sessionCounter += 1),
      mode,
      queue: pool,
      index: 0,
      right: 0,
      wrong: 0,
      answered: false,
      flipped: false,
      questions: mode === "analogies" ? questions : null
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
      '<span class="tally"><span class="ok">' + icon("check", "tIcon") + s.right +
      '</span><span class="bad">' + icon("x", "tIcon") + s.wrong +
      "</span></span></div>";

    let body = "";
    if (s.mode === "flashcards" || s.mode === "review") body = flashcardHTML(word);
    else if (s.mode === "meaning") body = choiceHTML(word, "meaning");
    else if (s.mode === "word") body = choiceHTML(word, "word");
    else if (s.mode === "parts") body = partsHTML(word);
    else if (s.mode === "analogies") body = analogyQuestionHTML(s.questions[s.index]);
    else if (s.mode === "spell") body = spellHTML(word);

    view.innerHTML =
      header + body +
      '<button class="btn wide" id="quitBtn" style="margin-top:14px">End session</button>';

    document.getElementById("quitBtn").addEventListener("click", endSession);

    if (s.mode === "flashcards" || s.mode === "review") bindFlashcard(word);
    else if (s.mode === "meaning" || s.mode === "word") bindChoice(word);
    else if (s.mode === "parts") bindParts(word);
    else if (s.mode === "analogies") bindAnalogyQuestion(s.questions[s.index]);
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
      '<div class="card center"><div class="scoreMark ' +
      (pct >= 80 ? "good" : pct >= 50 ? "ok" : "low") + '">' +
      icon(pct >= 80 ? "trophy" : pct >= 50 ? "check" : "repeat", "hugeIcon") + "</div>" +
      "<h2 style=\"margin:6px 0\">" + pct + "% correct</h2>" +
      '<p class="muted">' + s.right + " right · " + s.wrong + " to review</p>" +
      memeHTML(Memes ? Memes.summary(pct) : null, pct >= 50) + "</div>" +
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
      feedbackHTML(correct, correct ? "Correct" : "Not quite") +
      splitHTML(word, { showExamples: false });
    view.insertBefore(panel, document.getElementById("quitBtn"));

    const next = document.createElement("button");
    next.className = "btn primary wide";
    next.style.marginTop = "12px";
    next.textContent = "Next";
    view.insertBefore(next, document.getElementById("quitBtn"));
    next.addEventListener("click", () => advance(correct, word));
    next.focus();

    /* Auto-advance is off by default: a right answer still has an
     * explanation worth reading, and being yanked to the next card mid-
     * sentence is worse than tapping Next. */
    const delay = Store.getSettings().autoAdvanceMs || 0;
    if (delay && correct) {
      const sessionId = state.session.id;
      const at = state.session.index;
      setTimeout(() => {
        const s = state.session;
        if (s && s.id === sessionId && s.index === at && s.answered) advance(true, word);
      }, delay);
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
          feedbackHTML(correct, correct ? "Correct" : "Not quite") +
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
        feedbackHTML(correct, correct ? "Correct" : "The word was " + word) +
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

  /* ---------- view: play ---------- */

  const Games = window.WordGames || null;
  if (Games) {
    Games.mount({
      esc, shuffle, sample, toast, stat, splitHTML, showWordDetail, icon,
      memeHTML, activeWords, ALL_WORDS, Store, Splitter, MORPHEMES
    });
  }

  function renderPlay() {
    viewTitle.textContent = "Play";
    if (!Games) {
      view.innerHTML = '<div class="empty">' + icon("play", "bigIcon") +
        "Games are unavailable.</div>";
      return;
    }
    Games.render(view);
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
        list.innerHTML = '<div class="empty">' + icon("search", "bigIcon") + "No words match.</div>";
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
      '<div class="card">' + splitHTML(word, { allowTeach: true }) + "</div>" +
      '<div class="statGrid">' +
      stat(e.seen, "times seen") +
      stat(e.right, "correct") +
      stat(Store.level(word), "status") +
      stat(e.due && e.due > Date.now()
        ? Math.ceil((e.due - Date.now()) / 86400000) + "d"
        : "now", "next review") +
      "</div>" +
      '<button class="btn wide" id="speakBtn" style="margin-top:12px">' +
      icon("speaker", "bIcon") + " Say it</button>";

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

  /* Teaching: confirm a reading, or open the alternatives and pick one. */
  view.addEventListener("click", e => {
    const btn = e.target.closest("[data-teach]");
    if (btn) {
      const host = btn.closest(".teach");
      const word = host.dataset.teachWord;
      if (btn.dataset.teach === "yes") {
        const current = Splitter.split(word);
        Learner.learnFromChoice(word, current.signature);
        host.innerHTML = '<span class="small ok">Thanks — noted.</span>';
        return;
      }
      const panel = document.createElement("div");
      panel.className = "altPanel";
      panel.innerHTML = alternativesHTML(word);
      host.parentNode.insertBefore(panel, host.nextSibling);
      btn.disabled = true;
      return;
    }

    /* only the split reading picker owns this; game answers are data-answer */
    const pick = e.target.closest("[data-pick]");
    if (!pick || state.view === "play") return;
    const word = pick.dataset.pickWord;
    const changed = Learner.learnFromChoice(word, pick.dataset.pick);
    toast(changed ? "Learned — thanks" : "Could not use that reading");
    morphemeIndex = null; /* weights moved, so cached splits are stale */
    if (state.view === "split") renderSplit(word);
    else showWordDetail(word);
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
        list.innerHTML = '<div class="empty">' + icon("roots", "bigIcon") + "Nothing matches.</div>";
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
      '<p class="defRow"><span class="defLabel">Means:</span>' +
      '<span class="defText">' + esc(entry.meaning) + "</span></p>" +
      (entry.examples.length
        ? '<p class="defRow examples"><span class="defLabel">Examples:</span>' +
          '<span class="defText">' + entry.examples.map(e => esc(e)).join(", ") +
          "</span></p>"
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
      '<div class="sectionTitle">Word list</div><div class="card">' +
      '<p class="defRow" style="margin-top:0"><span class="defLabel">Studying:</span>' +
      '<span class="defText"><b>' + esc(STUDY_LIST.name) + "</b> — " +
      STUDY_LIST.words.length.toLocaleString() + " words</span></p>" +
      '<p class="small muted" style="margin-bottom:0">This is the only list. A ' +
      "further " + RECOGNITION.words.length.toLocaleString() + " everyday words " +
      "are loaded as a recognition dictionary — they give looked-up words a " +
      "definition and let the splitter tell a real word from a typo — but they " +
      "are never studied, scored, or counted.</p></div>" +

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
      '<div class="settingRow"><div><div class="sname">Auto-advance</div>' +
      '<div class="sdesc">Move on by itself after a correct answer</div></div>' +
      '<select class="field" id="autoAdvanceMs" style="width:auto">' +
      [[0, "Off"], [3000, "After 3s"], [5000, "After 5s"], [8000, "After 8s"]].map(
        ([v, label]) =>
          '<option value="' + v + '"' +
          ((s.autoAdvanceMs || 0) === v ? " selected" : "") + ">" + label + "</option>"
      ).join("") +
      "</select></div>" +
      settingSwitch("speakWords", "Speak words aloud", "Read each word using the device voice", s.speakWords) +
      settingSwitch("memes", "Commentary", "A caption reacts to every answer. Turn it off for quiet study.", s.memes !== false) +
      "</div>" +

      '<div class="sectionTitle">Appearance</div><div class="card">' +
      '<div class="settingRow"><div><div class="sname">Theme</div>' +
      '<div class="sdesc">Match the system or force one</div></div>' +
      '<select class="field" id="theme" style="width:auto">' +
      [["system", "System"], ["dark", "Dark"], ["light", "Light"]].map(([v, label]) =>
        '<option value="' + v + '"' + (s.theme === v ? " selected" : "") + ">" + label + "</option>"
      ).join("") +
      "</select></div></div>" +

      (Memes ? memeSectionHTML() : "") +

      (Learner ? learningSectionHTML() : "") +

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

    document.getElementById("autoAdvanceMs").addEventListener("change", e => {
      Store.setSetting("autoAdvanceMs", parseInt(e.target.value, 10));
    });

    ["hardestFirst", "showHints", "speakWords", "memes", "builtinMemes"].forEach(key => {
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

    if (Learner) {
      document.getElementById("adaptiveSplit").addEventListener("change", e => {
        Store.setSetting("adaptiveSplit", e.target.checked);
        Learner.setEnabled(e.target.checked);
        morphemeIndex = null;
        toast(e.target.checked ? "Adaptive splitting on" : "Using the plain rules");
      });
      document.getElementById("resetLearnBtn").addEventListener("click", () => {
        if (!window.confirm("Forget the corrections made on this device? The " +
          "model the app shipped with is kept.")) return;
        Learner.reset();
        morphemeIndex = null;
        renderSettings();
        toast("Corrections forgotten");
      });
    }

    document.getElementById("resetBtn").addEventListener("click", () => {
      if (!window.confirm("Erase every word's progress and streak? This cannot be undone.")) return;
      Store.resetProgress();
      updateStreakChip();
      renderSettings();
      toast("Progress reset");
    });

    if (Memes) wireMemeSection();
  }

  /* ---------- your memes ---------- */

  /* The app ships captions, not images. Well-known memes are photographs and
   * video frames owned by whoever made them, so bundling them into a public
   * repo would be redistributing someone else's work, and hotlinking would
   * break the offline promise as well. The frame ships; you fill it. */
  function memeSectionHTML() {
    const mine = Memes.Library.list();
    return (
      '<div class="sectionTitle">Your memes</div><div class="card">' +
      '<p class="small muted" style="margin-top:0">Add the memes you actually ' +
      "find funny and they show up when you answer. They are stored on this " +
      "device, work offline, and are never uploaded anywhere.</p>" +

      '<div class="memeAdd">' +
      '<label class="btn wide" for="memeFile">' + icon("image", "bIcon") +
      " Choose images</label>" +
      '<input type="file" id="memeFile" accept="image/*" multiple hidden>' +
      '<div class="memeUrlRow">' +
      '<input class="field" id="memeUrl" type="url" inputmode="url" ' +
      'autocapitalize="none" autocorrect="off" spellcheck="false" ' +
      'placeholder="…or paste an image URL">' +
      '<button class="btn" id="memeUrlAdd">Add</button>' +
      "</div></div>" +

      settingSwitch(
        "builtinMemes",
        "Include the shipped paintings",
        Memes.Library.builtinCount + " public-domain reaction images that came with the app",
        Store.getSettings().builtinMemes !== false
      ) +

      (mine.length
        ? '<div class="memeList">' + mine.map(m =>
            '<div class="memeItem" data-id="' + m.id + '">' +
            '<img src="' + esc(m.url) + '" alt="">' +
            '<div class="memeItemBody">' +
            '<input class="field memeCapInput" value="' + esc(m.caption) +
            '" placeholder="Caption (optional)" maxlength="80">' +
            '<div class="memeItemRow">' +
            '<select class="field memeMood">' +
            [["any", "Either"], ["right", "Right"], ["wrong", "Wrong"]]
              .map(([v, label]) => '<option value="' + v + '"' +
                (m.mood === v ? " selected" : "") + ">" + label + "</option>").join("") +
            "</select>" +
            '<button class="btn bad memeDel" aria-label="Remove">' +
            icon("x", "bIcon") + "</button>" +
            "</div></div></div>"
          ).join("") + "</div>" +
          '<button class="btn bad wide" id="memeClear" style="margin-top:12px">' +
          "Remove all " + mine.length + " memes</button>"
        : '<p class="small muted memeEmpty">Nothing added yet — the shipped ' +
          "paintings are covering it.</p>") +

      '<details class="credits"><summary>Where the shipped ones come from</summary>' +
      '<p class="small muted">Paintings out of copyright and freely licensed ' +
      "photographs, all from Wikimedia Commons and all checked against their " +
      "licence. The CC ones ask to be credited, so they are.</p>" +
      '<ul class="creditList">' +
      Memes.Library.credits().map(c =>
        '<li><a href="' + esc(c.source) + '" target="_blank" rel="noopener">' +
        esc(c.title) + "</a> — " + esc(c.artist) +
        (c.year ? ", " + esc(c.year) : "") +
        ' <span class="lic">' + esc(c.license) + "</span></li>"
      ).join("") + "</ul></details>" +
      "</div>"
    );
  }

  function wireMemeSection() {
    const redraw = () => renderSettings();

    const file = document.getElementById("memeFile");
    if (file) {
      file.addEventListener("change", () => {
        const chosen = [...file.files];
        if (!chosen.length) return;
        Promise.all(chosen.map(f =>
          Memes.Library.fromFile(f).then(() => null).catch(err => f.name + ": " + err.message)
        )).then(errs => {
          const failed = errs.filter(Boolean);
          toast(failed.length ? failed[0] : "Added " + chosen.length +
            (chosen.length === 1 ? " meme" : " memes"));
          redraw();
        });
      });
    }

    const urlBtn = document.getElementById("memeUrlAdd");
    if (urlBtn) {
      urlBtn.addEventListener("click", () => {
        const field = document.getElementById("memeUrl");
        const url = field.value.trim();
        if (!url) return;
        urlBtn.disabled = true;
        urlBtn.textContent = "…";
        Memes.Library.fromURL(url)
          .then(() => { toast("Added"); redraw(); })
          .catch(err => {
            urlBtn.disabled = false;
            urlBtn.textContent = "Add";
            toast(err.message);
          });
      });
    }

    view.querySelectorAll(".memeItem").forEach(item => {
      const id = parseInt(item.dataset.id, 10);
      item.querySelector(".memeMood").addEventListener("change", e => {
        Memes.Library.update(id, { mood: e.target.value });
      });
      item.querySelector(".memeCapInput").addEventListener("change", e => {
        Memes.Library.update(id, { caption: e.target.value.trim() });
      });
      item.querySelector(".memeDel").addEventListener("click", () => {
        Memes.Library.remove(id).then(redraw);
      });
    });

    const clearBtn = document.getElementById("memeClear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (!window.confirm("Remove every meme you have added?")) return;
        Memes.Library.clear().then(() => { toast("Memes removed"); redraw(); });
      });
    }
  }

  /* What the splitter has learned, shown rather than hidden: the morphemes it
   * currently trusts most and least, and how much of that came from here. */
  function learningSectionHTML() {
    const s = Store.getSettings();
    const info = Learner.stats();
    const tw = Learner.topWeights(4);
    const row = r =>
      '<li><b>' + esc(r.key) + "</b> <span class=\"muted\">" + esc(r.kind) + " · " +
      esc(r.meaning) + "</span></li>";

    return (
      '<div class="sectionTitle">Adaptive splitting</div><div class="card">' +
      settingSwitch(
        "adaptiveSplit",
        "Learn from corrections",
        "Let the splitter improve as you correct it",
        s.adaptiveSplit !== false
      ) +
      '<div class="statGrid" style="margin-top:12px">' +
      stat(info.corrections, "corrections made") +
      stat(info.learnedHere, "weights changed here") +
      "</div>" +
      '<p class="small muted" style="margin-top:12px">The app ships with ' +
      info.shipped + " weights already trained on its verified splits. Every " +
      "correction you make in the Split view adjusts the word part itself, so " +
      "related words shift too.</p>" +
      (tw.top.length
        ? '<p class="small" style="margin-bottom:4px"><b>Trusts most</b></p>' +
          '<ul class="weightList">' + tw.top.map(row).join("") + "</ul>" +
          '<p class="small" style="margin:10px 0 4px"><b>Trusts least</b></p>' +
          '<ul class="weightList">' + tw.bottom.map(row).join("") + "</ul>"
        : "") +
      '<button class="btn wide" id="resetLearnBtn" style="margin-top:12px">' +
      "Forget my corrections</button></div>"
    );
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
      streakChip.innerHTML = icon("flame", "sIcon") + "<span>" + stats.streak +
        " day" + (stats.streak === 1 ? "" : "s") + "</span>";
    } else {
      streakChip.hidden = true;
    }
  }

  const VIEWS = {
    split: renderSplit,
    analogy: renderAnalogy,
    study: renderStudy,
    play: renderPlay,
    browse: renderBrowse,
    roots: renderRoots,
    settings: renderSettings
  };

  function go(name) {
    state.view = name;
    if (name !== "study") state.session = null;
    /* a running game clock would otherwise keep ticking into the next view */
    if (name !== "play" && Games) Games.stop();
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
  if (Learner) Learner.setEnabled(Store.getSettings().adaptiveSplit !== false);
  /* Loads in the background: answers given before it lands fall back to the
   * drawn reactions rather than waiting on a database. */
  if (Memes) Memes.Library.load();
  /* One pass to build the analogy indexes, over everything the app can
   * recognise, with the study list marked as the preferred vocabulary. */
  if (Analogy) Analogy.index([...ALL_WORDS.keys()], w => Splitter.split(w), STUDY_LIST.words);
  go("split");

  if ("serviceWorker" in navigator) {
    /* Whether a worker was already driving this page when it loaded. On a
     * first-ever visit there is nothing to replace, so taking control is not
     * an update and must not trigger a reload. */
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then(reg => {
        /* Ask on every launch. The browser makes its own update check, but it
         * is tied to navigation, and an app opened from the Home Screen may go
         * a long time without one — which is exactly the case where a shipped
         * change looks like it never arrived. */
        if (reg && reg.update) reg.update().catch(() => {});
      }).catch(() => {
        /* offline caching is best-effort */
      });
    });

    /* The cache is deliberately cache-first, which means a visit that arrives
     * after an update still renders the *previous* build: by the time the new
     * worker has installed and claimed the page, the old HTML and scripts are
     * already on screen. Left alone the update only appears on some later
     * launch — and an app opened from the Home Screen may not fully relaunch
     * for weeks, which is how a shipped feature can look like it never
     * arrived. Reload once, as soon as the new worker takes over. */
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
  }
})();
