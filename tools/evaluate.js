#!/usr/bin/env node
/* Measures whether the learned model actually helps.
 *
 * Gold set: the verified splits in the override table. Overrides are bypassed
 * during evaluation, so the splitter has to derive each reading on its own.
 * Two numbers matter:
 *
 *   held-out   trains on half the examples, scores the other half. This is the
 *              honest one — it shows whether a correction on one word carries
 *              to words the model never saw.
 *   shipped    scores the committed js/weights.js against the whole gold set.
 *
 * Run from the repo root:  node tools/evaluate.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = ["js/morphemes.js", "js/splitter.js", "js/data/core.js", "js/data/ssat.js", "js/data/sat.js"];

function loadApp(withWeights) {
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  global.window = {};
  const files = FILES.slice();
  if (withWeights && fs.existsSync(path.join(ROOT, "js/weights.js"))) {
    files.push("js/weights.js");
  }
  files.push("js/learn.js");
  files.forEach(f => eval(fs.readFileSync(path.join(ROOT, f), "utf8")));
  const W = global.window;
  const words = [...new Set(
    [].concat(W.WS_LIST_CORE, W.WS_LIST_SSAT, W.WS_LIST_SAT).map(line => line.split("|")[0])
  )];
  W.WordSplitter.registerWords(words);
  return { W, words };
}

function goldSet(W) {
  const S = W.WordSplitter;
  const FM = W.WS_FORM_MAP;
  const idOf = form => {
    for (const kind of ["prefix", "root", "suffix"]) {
      const list = FM[kind].get(form);
      if (list) return list[0].id;
    }
    return null;
  };
  const gold = [];
  Object.entries(S.OVERRIDES).forEach(([word, spec]) => {
    if (spec === "=") return;
    const ids = [];
    spec.split("|").forEach(slot => {
      slot.split("+").filter(Boolean).forEach(f => ids.push(idOf(f)));
    });
    if (ids.some(x => x === null)) return;
    gold.push({ word, ids: ids.join(",") });
  });
  return gold;
}

const predict = (S, w) =>
  S.split(w, { ignoreOverrides: true }).parts
    .filter(p => p.entry).map(p => p.entry.id).join(",");

function accuracy(S, set) {
  let hit = 0;
  set.forEach(g => { if (predict(S, g.word) === g.ids) hit += 1; });
  return { hit, total: set.length, pct: (100 * hit) / set.length };
}

function coverage(S, words) {
  let split = 0;
  words.forEach(w => { if (S.split(w).parts.length > 1) split += 1; });
  return (100 * split) / words.length;
}

function signatureFor(S, word, ids) {
  const match = S.candidates(word, 10).find(
    c => c.parts.filter(p => p.entry).map(p => p.entry.id).join(",") === ids
  );
  return match ? match.signature : null;
}

function heldOut() {
  const { W, words } = loadApp(false);
  const S = W.WordSplitter;
  const L = W.WordLearner;
  L._clearAll();

  const gold = goldSet(W);
  let seed = 20240607;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const shuffled = gold.slice().sort(() => rnd() - 0.5);
  const half = Math.floor(shuffled.length / 2);
  const train = shuffled.slice(0, half);
  const test = shuffled.slice(half);

  L.setEnabled(false);
  const off = accuracy(S, test);
  L.setEnabled(true);

  const examples = [];
  train.forEach(g => {
    const sig = signatureFor(S, g.word, g.ids);
    if (sig) examples.push({ word: g.word, signature: sig });
  });

  console.log("HELD-OUT  train " + train.length + " examples, test " + test.length);
  console.log("  before training     : " + off.hit + "/" + off.total +
    "  " + off.pct.toFixed(1) + "%");
  for (let epoch = 1; epoch <= 3; epoch++) {
    L.trainFromExamples(examples, 1);
    const a = accuracy(S, test);
    console.log("  after epoch " + epoch + "       : " + a.hit + "/" + a.total +
      "  " + a.pct.toFixed(1) + "%");
  }
  console.log("  split coverage      : " + coverage(S, words).toFixed(1) + "%");
}

function shipped() {
  const { W, words } = loadApp(true);
  const S = W.WordSplitter;
  const L = W.WordLearner;
  const gold = goldSet(W);

  L.setEnabled(false);
  const off = accuracy(S, gold);
  const offCov = coverage(S, words);
  L.setEnabled(true);
  const on = accuracy(S, gold);
  const onCov = coverage(S, words);

  console.log("\nSHIPPED MODEL  (js/weights.js, " + gold.length + " gold words)");
  console.log("  heuristic only      : " + off.hit + "/" + off.total +
    "  " + off.pct.toFixed(1) + "%   coverage " + offCov.toFixed(1) + "%");
  console.log("  with learned weights: " + on.hit + "/" + on.total +
    "  " + on.pct.toFixed(1) + "%   coverage " + onCov.toFixed(1) + "%");
  console.log("  delta               : " + (on.pct - off.pct >= 0 ? "+" : "") +
    (on.pct - off.pct).toFixed(1) + " points");

  const tw = L.topWeights(5);
  console.log("  trusts most         : " +
    tw.top.map(r => r.key + " " + r.weight.toFixed(1)).join(", "));
  console.log("  trusts least        : " +
    tw.bottom.map(r => r.key + " " + r.weight.toFixed(1)).join(", "));
}

heldOut();
shipped();
