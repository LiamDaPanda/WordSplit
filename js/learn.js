/* WordSplit — the adaptive layer.
 *
 * The splitter's hand-written scoring gets most words right. On top of it this
 * module keeps a learned weight per scoring feature, trained by a structured
 * perceptron: show it the correct reading of a word, and it pushes weight
 * toward the features of that reading and away from the one it had preferred.
 *
 * The point is that a correction generalizes. Weights live on the morpheme,
 * not the word, so being told once that "convoluted" is con+volut shifts every
 * other word built from that root too.
 *
 * The app ships pre-trained (js/weights.js) on the verified splits in the
 * override table, and keeps learning on the device from corrections made in
 * the Split view. Nothing here calls out to a network or an external model —
 * it is a linear model over a few hundred sparse features, trained in-process.
 *
 * Measured, not assumed (tools/evaluate.js). Trained on half the verified
 * examples and tested on the half it had never seen, exact-match accuracy went
 * 72.2% -> 75.6%, so corrections really do carry to unseen words. An
 * unsupervised self-training variant was also tried and is deliberately absent
 * — it scored 71% against a 74% baseline, because a model that trains on its
 * own guesses mostly learns to repeat them.
 */
(function () {
  const Splitter = window.WordSplitter;

  const WEIGHTS_KEY = "wordsplit.weights.v1";
  const LOG_KEY = "wordsplit.learnlog.v1";

  /* How far the learned weights may move a decision. The heuristic score
   * spread between a good and a bad reading is roughly 20-60 points, so this
   * ceiling lets learning settle genuinely close calls without letting it
   * overrule strong structural evidence. */
  const MAX_WEIGHT = 12;
  const PERCEPTRON_LR = 2.5;
  const CANDIDATE_CAP = 10;
  const TRAIN_EPOCHS = 3;
  const MARGIN = 8; /* score gap below which a win counts as too close */

  /* Shipped model, then whatever this device has learned on top of it. Kept
   * apart so a reset returns to the trained baseline rather than to nothing. */
  const base = Object.assign(Object.create(null), window.WS_BASE_WEIGHTS || {});
  let deltas = Object.create(null);
  let weights = Object.create(null);
  let log = { corrections: 0, confirmations: 0, trainedAt: null };
  let enabled = true;

  function recompute() {
    weights = Object.create(null);
    for (const k in base) weights[k] = base[k];
    for (const k in deltas) weights[k] = clamp((weights[k] || 0) + deltas[k]);
  }

  function load() {
    try {
      const raw = localStorage.getItem(WEIGHTS_KEY);
      if (raw) deltas = Object.assign(Object.create(null), JSON.parse(raw));
      const rawLog = localStorage.getItem(LOG_KEY);
      if (rawLog) log = Object.assign(log, JSON.parse(rawLog));
    } catch (err) {
      deltas = Object.create(null);
    }
    recompute();
  }

  function persist() {
    try {
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(deltas));
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
      return true;
    } catch (err) {
      return false;
    }
  }

  function clamp(v) {
    return Math.max(-MAX_WEIGHT, Math.min(MAX_WEIGHT, v));
  }

  /* The hook the splitter calls for every candidate it scores. */
  function scoreAdjust(features) {
    if (!enabled) return 0;
    let total = 0;
    for (const key in features) {
      const w = weights[key];
      if (w) total += w * features[key];
    }
    return total;
  }

  /* Structural features encode the heuristic's own design; morpheme-identity
   * features are the ones a correction should really move. */
  function isMorphemeFeature(key) {
    return key.charCodeAt(1) === 58 /* ':' */ &&
      (key[0] === "R" || key[0] === "P" || key[0] === "S");
  }

  /* ---------- batch training (used to build the shipped weights) ---------- */

  /* examples: [{ word, signature }] — the reading each word should get.
   * Runs the same perceptron used online, just over many examples at once. */
  /* Averaged perceptron.
   *
   * The plain version ends wherever the last handful of examples pushed it,
   * which is why a third epoch was scoring *worse* than a second: late
   * corrections were undoing settled ones. Averaging every intermediate
   * weight vector keeps what all the epochs agreed on and lets the
   * disagreements cancel, which is the standard fix and a measurable one. */
  function trainFromExamples(examples, epochs) {
    const rounds = epochs || TRAIN_EPOCHS;
    let taught = 0;
    const totals = Object.create(null);
    let snapshots = 0;
    const snapshot = () => {
      snapshots += 1;
      for (const k in deltas) totals[k] = (totals[k] || 0) + deltas[k];
    };
    for (let epoch = 0; epoch < rounds; epoch++) {
      taught = 0;
      examples.forEach(ex => {
        snapshot();
        const cands = Splitter.candidates(ex.word, CANDIDATE_CAP);
        if (cands.length < 2) return;
        const chosen = cands.find(c => c.signature === ex.signature);
        if (!chosen) return; /* the target reading is not reachable at all */
        const predicted = cands[0];
        taught += 1;
        if (chosen.signature === predicted.signature) {
          /* Right already — but a reading that only just won is a coin flip on
           * the next similar word, so widen a thin margin. */
          const runnerUp = cands[1];
          if (runnerUp && chosen.score - runnerUp.score < MARGIN) {
            update(chosen.features, PERCEPTRON_LR * 0.4);
            update(runnerUp.features, -PERCEPTRON_LR * 0.4);
          }
          return;
        }
        update(chosen.features, PERCEPTRON_LR);
        update(predicted.features, -PERCEPTRON_LR);
      });
    }
    /* Replace the final weights with the average over the whole run. */
    if (snapshots) {
      deltas = Object.create(null);
      for (const k in totals) {
        const avg = totals[k] / snapshots;
        if (Math.abs(avg) > 0.001) deltas[k] = avg;
      }
      weights = Object.create(null);
      for (const k in base) weights[k] = clamp(base[k]);
      for (const k in deltas) weights[k] = clamp((base[k] || 0) + deltas[k]);
    }

    log.trainedAt = Date.now();
    return { examples: taught, epochs: rounds, features: Object.keys(weights).length };
  }

  /* ---------- online learning from corrections ---------- */

  /* Structured perceptron: reward the reading the person chose, penalize the
   * one the model preferred. Returns true when weights actually moved. */
  function learnFromChoice(word, chosenSignature) {
    const cands = Splitter.candidates(word, CANDIDATE_CAP);
    if (cands.length < 2) return false;
    const chosen = cands.find(c => c.signature === chosenSignature);
    const predicted = cands[0];
    if (!chosen) return false;

    if (chosen.signature === predicted.signature) {
      log.confirmations += 1;
      /* Already right, but if the runner-up is breathing down its neck, widen
       * the gap a little so the next similar word is not a coin flip. */
      const runnerUp = cands[1];
      if (runnerUp && chosen.score - runnerUp.score < MARGIN) {
        update(chosen.features, PERCEPTRON_LR * 0.4);
        update(runnerUp.features, -PERCEPTRON_LR * 0.4);
      }
      persist();
      return true;
    }

    log.corrections += 1;
    update(chosen.features, PERCEPTRON_LR);
    update(predicted.features, -PERCEPTRON_LR);
    persist();
    return true;
  }

  /* Updates land in the device's delta layer, on top of the shipped model. */
  function update(features, delta) {
    for (const key in features) {
      deltas[key] = (deltas[key] || 0) + delta * features[key];
      weights[key] = clamp((base[key] || 0) + deltas[key]);
    }
  }

  /* ---------- introspection ---------- */

  function stats() {
    return {
      features: Object.keys(weights).length,
      shipped: Object.keys(base).length,
      learnedHere: Object.keys(deltas).length,
      corrections: log.corrections,
      confirmations: log.confirmations,
      trainedAt: log.trainedAt,
      enabled
    };
  }

  /* The morphemes the model currently trusts most and least — the closest
   * thing to "what did it learn", in plain sight rather than hidden. */
  function topWeights(n) {
    const MORPHEMES = window.WS_MORPHEMES;
    const byId = new Map();
    ["prefix", "root", "suffix"].forEach(kind => {
      MORPHEMES[kind].forEach(entry => byId.set(entry.id, entry));
    });
    const rows = [];
    for (const key in weights) {
      if (!isMorphemeFeature(key)) continue;
      const entry = byId.get(key.slice(2));
      if (!entry) continue;
      rows.push({ key: entry.key, kind: entry.kind, meaning: entry.meaning, weight: weights[key] });
    }
    rows.sort((a, b) => b.weight - a.weight);
    const count = n || 5;
    return { top: rows.slice(0, count), bottom: rows.slice(-count).reverse() };
  }

  function setEnabled(on) {
    enabled = !!on;
  }

  /* Forget what this device learned, keeping the model it shipped with. */
  function reset() {
    deltas = Object.create(null);
    log = { corrections: 0, confirmations: 0, trainedAt: null };
    recompute();
    persist();
  }

  /* Test hooks: exercise the model without touching storage. */
  function _clearAll() {
    deltas = Object.create(null);
    for (const k in base) delete base[k];
    recompute();
  }
  function _exportWeights() {
    return Object.assign({}, weights);
  }

  load();
  Splitter.setScorer(scoreAdjust);

  window.WordLearner = {
    scoreAdjust,
    trainFromExamples,
    learnFromChoice,
    stats,
    topWeights,
    setEnabled,
    reset,
    _clearAll,
    _exportWeights
  };
})();
