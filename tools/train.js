#!/usr/bin/env node
/* Builds js/weights.js — the model WordSplit ships with.
 *
 * Training data is the override table in js/splitter.js: several hundred
 * splits that were checked by hand. Those words already resolve correctly at
 * runtime through the override itself, so the point of training on them is
 * everything else — the weights land on morphemes, so the evidence carries to
 * the thousands of words that have no override.
 *
 * Run from the repo root:  node tools/train.js
 * Verify the effect with:  node tools/evaluate.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadApp() {
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  global.window = {};
  ["js/morphemes.js", "js/splitter.js", "js/data/ssat.js", "js/data/sat.js", "js/learn.js"]
    .forEach(f => eval(fs.readFileSync(path.join(ROOT, f), "utf8")));
  return global.window;
}

/* The override spec names spellings; turn each into the candidate signature
 * the splitter would produce for that same reading. */
function goldExamples(W) {
  const S = W.WordSplitter;
  const examples = [];
  const unreachable = [];

  Object.entries(S.OVERRIDES).forEach(([word, spec]) => {
    if (spec === "=") return;
    const ids = specIds(W, spec);
    if (!ids) return;
    const cands = S.candidates(word, 10);
    const match = cands.find(c => idsOf(c.parts) === ids);
    if (!match) {
      unreachable.push(word);
      return;
    }
    examples.push({ word, signature: match.signature });
  });

  return { examples, unreachable };
}

function specIds(W, spec) {
  const FM = W.WS_FORM_MAP;
  const idOf = form => {
    for (const kind of ["prefix", "root", "suffix"]) {
      const list = FM[kind].get(form);
      if (list) return list[0].id;
    }
    return null;
  };
  const ids = [];
  spec.split("|").forEach(slot => {
    slot.split("+").filter(Boolean).forEach(f => ids.push(idOf(f)));
  });
  return ids.some(x => x === null) ? null : ids.join(",");
}

function idsOf(parts) {
  return parts.filter(p => p.entry).map(p => p.entry.id).join(",");
}

function main() {
  const W = loadApp();
  const S = W.WordSplitter;
  const L = W.WordLearner;

  const words = [...new Set(
    [].concat(W.WS_LIST_SSAT, W.WS_LIST_SAT).map(line => line.split("|")[0])
  )];
  S.registerWords(words);
  L._clearAll();

  const { examples, unreachable } = goldExamples(W);
  console.log("verified examples:", examples.length,
    "(" + unreachable.length + " unreachable, skipped)");

  const result = L.trainFromExamples(examples, 2);
  console.log("trained:", JSON.stringify(result));

  const weights = L._exportWeights();
  const keys = Object.keys(weights).filter(k => Math.abs(weights[k]) > 0.001).sort();
  const rounded = {};
  keys.forEach(k => { rounded[k] = Math.round(weights[k] * 100) / 100; });

  const out =
    "/* WordSplit — the model the app ships with.\n" +
    " *\n" +
    " * GENERATED FILE. Do not edit by hand; run `node tools/train.js` instead.\n" +
    " *\n" +
    " * A weight per scoring feature, learned by structured perceptron from the\n" +
    " * verified splits in the override table. Keys are R:/P:/S: for a root,\n" +
    " * prefix, or suffix by id, plus structural features. The device adds its\n" +
    " * own corrections on top of these at runtime.\n" +
    " *\n" +
    " * " + keys.length + " features · trained " + new Date().toISOString().slice(0, 10) + "\n" +
    " */\n" +
    "window.WS_BASE_WEIGHTS = " + JSON.stringify(rounded, null, 0) + ";\n";

  fs.writeFileSync(path.join(ROOT, "js/weights.js"), out);
  console.log("wrote js/weights.js —", keys.length, "features,",
    (out.length / 1024).toFixed(1) + "KB");
}

main();
