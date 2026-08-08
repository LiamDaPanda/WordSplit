/* WordSplit — analogies.
 *
 * The SSAT verbal section asks "A is to B as C is to what?", and the honest
 * way to get good at that is to see that the relation is usually *structural*:
 * benevolent is to malevolent as benediction is to malediction, because both
 * pairs swap the same prefix over the same root.
 *
 * Everything here is derived from the morpheme breakdown, so the relations it
 * reports are ones it can actually show you rather than assert. It does not
 * guess at meaning it has no evidence for — there is no embedding, no model,
 * no network call. Where two words have no shared structure it says so.
 */
(function () {
  /* Prefix pairs that genuinely reverse a word. Used only to label a swap
   * that has already been found structurally, never to invent one. */
  const OPPOSED = [
    ["bene", "mal"], ["pro", "anti"], ["pro", "contra"], ["sub", "super"],
    ["micro", "macro"], ["pre", "post"], ["ante", "post"], ["hyper", "hypo"],
    ["eu", "dys"], ["philo", "mis"], ["poly", "mono"], ["exo", "endo"],
    ["ex", "in"], ["exo", "eso"], ["a", "poly"], ["under", "over"]
  ];

  let WORDS = [];          /* every word the app can analyse, in list order */
  let SPLIT = new Map();   /* word -> {pre[], root[], suf[]} of morpheme ids */
  let STUDY = new Set();   /* the subset that is actually drilled */
  let byFrame = null;      /* swap indexes, built lazily */

  /* An analogy has to rest on a morpheme the word actually spells out. The
   * splitter will settle for an approximate root when nothing better fits —
   * that is right for showing a breakdown, and wrong here, because it is how
   * "terse is to inter" gets proposed as a relation. Only exact forms count. */
  function exact(part) {
    return !!part.entry && part.entry.variants.indexOf(part.text) !== -1;
  }

  function idsOf(parts, kind) {
    return parts.filter(p => p.kind === kind && exact(p)).map(p => p.entry.id);
  }

  function key(list) {
    return list.join(",");
  }

  /* One pass over the study list. Words the splitter cannot analyse into
   * morphemes are skipped: with nothing to compare they can carry no
   * structural relation, and pretending otherwise is how a feature like this
   * starts making things up. */
  /* Everything known is indexed, so typing any two words the app recognises
   * gets an answer. `study` marks the drilled subset, which is preferred when
   * the app is the one choosing the words to show you. */
  function index(words, splitFn, study) {
    WORDS = words.slice();
    SPLIT = new Map();
    STUDY = new Set(study || words);
    byFrame = null;
    WORDS.forEach(w => {
      const parts = splitFn(w).parts;
      const text = kind => parts.filter(p => p.kind === kind && exact(p)).map(p => p.text);
      const rec = {
        pre: idsOf(parts, "prefix"),
        root: idsOf(parts, "root"),
        suf: idsOf(parts, "suffix"),
        preText: text("prefix"),
        rootText: text("root"),
        sufText: text("suffix")
      };
      /* Every morpheme in the word has to be an exact form, not just the ones
       * that survived the filter. Otherwise dropping an inexact suffix leaves
       * two words looking like they share an empty one, and "impassioned" gets
       * matched with "dispassion" as though the endings agreed. */
      const carried = parts.filter(p => p.entry).length;
      const kept = rec.pre.length + rec.root.length + rec.suf.length;
      if (kept && kept === carried) SPLIT.set(w, rec);
    });
    return SPLIT.size;
  }

  /* Three indexes, one per thing that can vary while the rest is held still.
   * Each maps "the parts that stay" -> "the part that changes" -> words. */
  function build() {
    if (byFrame) return byFrame;
    const mk = () => new Map();
    byFrame = { prefix: mk(), suffix: mk(), root: mk() };

    const put = (map, frame, slot, word) => {
      let bucket = map.get(frame);
      if (!bucket) map.set(frame, (bucket = new Map()));
      let list = bucket.get(slot);
      if (!list) bucket.set(slot, (list = []));
      list.push(word);
    };

    SPLIT.forEach((r, w) => {
      /* A frame with no root is not a frame. Without a shared root the only
       * thing two words have in common is an ending, and "abeyance is to
       * intemperance" is not an analogy — it is a coincidence of spelling. */
      if (r.root.length) {
        put(byFrame.prefix, key(r.root) + "|" + key(r.suf), key(r.pre), w);
        put(byFrame.suffix, key(r.pre) + "|" + key(r.root), key(r.suf), w);
      }
      /* Swapping the root needs the opposite: real affixes to hold still. */
      if (r.root.length && (r.pre.length || r.suf.length)) {
        put(byFrame.root, key(r.pre) + "|" + key(r.suf), key(r.root), w);
      }
    });
    return byFrame;
  }

  function morph(id) {
    const all = window.WS_MORPHEMES;
    for (const kind of ["prefix", "root", "suffix"]) {
      const hit = all[kind].find(m => m.id === id);
      if (hit) return hit;
    }
    return null;
  }

  function names(ids) {
    return ids.map(id => {
      const m = morph(id);
      return m ? m.key : "?";
    });
  }

  function meanings(ids) {
    return ids.map(id => {
      const m = morph(id);
      return m ? m.meaning.split(",")[0].trim() : "";
    }).filter(Boolean);
  }

  function opposed(aIds, bIds) {
    if (aIds.length !== 1 || bIds.length !== 1) return false;
    const a = names(aIds)[0];
    const b = names(bIds)[0];
    return OPPOSED.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
  }

  /* What changes going from A to B, when everything else holds still. */
  function relate(a, b) {
    const ra = SPLIT.get(a);
    const rb = SPLIT.get(b);
    if (!ra || !rb || a === b) return null;

    /* Same rule as the index: no shared root, no structural analogy. */
    if (!ra.root.length || !rb.root.length) return null;
    const same = (x, y) => key(x) === key(y);
    const textOf = { prefix: "preText", root: "rootText", suffix: "sufText" };
    const describe = (slot, from, to) => {
      const fromNames = ra[textOf[slot]].length ? ra[textOf[slot]] : names(from);
      const toNames = rb[textOf[slot]].length ? rb[textOf[slot]] : names(to);
      const flip = slot === "prefix" && opposed(from, to);
      const added = !from.length;
      const dropped = !to.length;
      return {
        slot,
        from, to,
        fromText: fromNames.join(" + "),
        toText: toNames.join(" + "),
        fromMeaning: meanings(from).join(", "),
        toMeaning: meanings(to).join(", "),
        opposite: flip,
        type: added ? slot + "-added" : dropped ? slot + "-dropped" : slot + "-swap",
        label: flip
          ? "opposite " + slot + "es"
          : added ? "adds the " + slot + " " + toNames.join(" + ")
          : dropped ? "drops the " + slot + " " + fromNames.join(" + ")
          : "swaps one " + slot + " for another"
      };
    };

    if (same(ra.root, rb.root) && same(ra.suf, rb.suf) && !same(ra.pre, rb.pre)) {
      return describe("prefix", ra.pre, rb.pre);
    }
    if (same(ra.pre, rb.pre) && same(ra.root, rb.root) && !same(ra.suf, rb.suf)) {
      return describe("suffix", ra.suf, rb.suf);
    }
    if (same(ra.pre, rb.pre) && same(ra.suf, rb.suf) && !same(ra.root, rb.root)) {
      return describe("root", ra.root, rb.root);
    }

    /* No single-slot swap, but a shared root is still a real relation and
     * worth naming — it is the one the app exists to teach. */
    const shared = ra.root.filter(id => rb.root.indexOf(id) !== -1);
    if (shared.length) {
      return {
        slot: "root",
        type: "shared-root",
        shared,
        fromText: names(shared).join(" + "),
        fromMeaning: meanings(shared).join(", "),
        label: "built on the same root"
      };
    }
    return null;
  }

  /* Pairs that undergo the same transformation as (a, b). */
  function analogues(a, b, limit) {
    const rel = relate(a, b);
    if (!rel) return [];
    const cap = limit || 12;
    const out = [];

    if (rel.type === "shared-root") {
      const want = rel.shared[0];
      WORDS.forEach(w => {
        if (w === a || w === b) return;
        const r = SPLIT.get(w);
        if (r && r.root.indexOf(want) !== -1) out.push({ a: w, b: null });
      });
      return rank(out).slice(0, cap);
    }

    const map = build()[rel.slot];
    const fromKey = key(rel.from);
    const toKey = key(rel.to);
    map.forEach(bucket => {
      const left = bucket.get(fromKey);
      const right = bucket.get(toKey);
      if (!left || !right) return;
      left.forEach(x => right.forEach(y => {
        if (x === y || (x === a && y === b)) return;
        out.push({ a: x, b: y });
      }));
    });
    return rank(out).slice(0, cap);
  }

  /* Pairs where both halves are on the study list come first: they are the
   * ones worth learning, and the ones a quiz can legitimately ask about. */
  function rank(pairs) {
    const score = p =>
      (STUDY.has(p.a) ? 1 : 0) + (p.b == null || STUDY.has(p.b) ? 1 : 0);
    return pairs.slice().sort((x, y) => score(y) - score(x));
  }

  function isStudy(word) {
    return STUDY.has(word);
  }

  /* An A : B :: C : ? question, built only from relations that actually have
   * a second instance — so every question has a defensible answer. */
  function question(pickWrong) {
    const map = build();
    const slots = ["prefix", "suffix", "root"];
    for (let tries = 0; tries < 220; tries++) {
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const frames = [...map[slot].keys()];
      if (!frames.length) continue;
      const bucket = map[slot].get(frames[Math.floor(Math.random() * frames.length)]);
      const variants = [...bucket.keys()].filter(k => k !== "");
      if (variants.length < 2) continue;

      /* two different values of the varying slot, over the same frame */
      const i = Math.floor(Math.random() * variants.length);
      let j = Math.floor(Math.random() * (variants.length - 1));
      if (j >= i) j += 1;
      const left = bucket.get(variants[i]);
      const right = bucket.get(variants[j]);
      if (!left.length || !right.length) continue;

      /* the prompt pair should be study words too, so a question never
       * turns on vocabulary the app never asked anyone to learn */
      const a = left.find(w => STUDY.has(w)) || left[0];
      const b = right.find(w => STUDY.has(w)) || right[0];
      /* the second instance has to come from a different frame, or the
       * "analogy" is just the same word pair written twice */
      const pairs = analogues(a, b, 40)
        .filter(p => p.a !== a && p.b !== b && STUDY.has(p.a) && STUDY.has(p.b));
      if (!pairs.length) continue;
      const pair = pairs[Math.floor(Math.random() * pairs.length)];

      const rel = relate(a, b);
      /* None of the three prompt words may turn up as a distractor: seeing
       * "revert" offered as the answer to "revert is to ?" is a puzzle about
       * the question, not about the relation. */
      const banned = new Set([a, b, pair.a, pair.b]);
      const wrong = (pickWrong ? pickWrong(pair.b, 6) : [])
        .filter(w => !banned.has(w)).slice(0, 3);
      if (wrong.length < 3) continue;
      return {
        a, b, c: pair.a, answer: pair.b,
        relation: rel,
        options: shuffle([pair.b].concat(wrong))
      };
    }
    return null;
  }

  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function analysable() {
    return SPLIT.size;
  }

  window.WordAnalogy = { index, relate, analogues, question, analysable, isStudy };
})();
