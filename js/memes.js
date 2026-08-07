/* WordSplit — the peanut gallery.
 *
 * A caption and a reaction face for every answer, so the feedback line has
 * something to say beyond "Correct". Everything here is text plus one of the
 * inline SVG faces from index.html — no images, no network, so the app stays
 * fully offline and the download does not grow.
 *
 * Two rules the lines are written to:
 *  - a miss is never an insult. It teases the moment, not the person, and
 *    the streak-breaker lines are the only ones allowed to sting at all.
 *  - nothing here replaces information. The caption sits above the real
 *    feedback, never instead of it.
 */
(function () {
  /* Ordinary right answer. */
  const RIGHT = [
    { face: "grin", line: "Big brain energy" },
    { face: "cool", line: "Certified vocab moment" },
    { face: "smug", line: "Absolutely no notes" },
    { face: "grin", line: "The dictionary fears you" },
    { face: "cool", line: "Effortless. Suspiciously so." },
    { face: "smug", line: "Nailed it, obviously" },
    { face: "grin", line: "That's the one, chief" },
    { face: "cool", line: "Built different" },
    { face: "smug", line: "You knew that. Of course you knew that." },
    { face: "grin", line: "Vocabulary: acquired" },
    { face: "cool", line: "Smooth" },
    { face: "grin", line: "Correct, and a little smug about it" }
  ];

  /* Right answer while a streak is running. Index by how many in a row. */
  const STREAK = [
    { at: 3, face: "grin", line: "Three in a row. Warming up." },
    { at: 5, face: "cool", line: "Five straight. Save some for the test." },
    { at: 8, face: "cool", line: "Eight. The SSAT is filing a complaint." },
    { at: 12, face: "smug", line: "Twelve. This is just showing off now." },
    { at: 20, face: "smug", line: "Twenty. Genuinely, what are you doing here?" }
  ];

  /* First right answer after a miss. */
  const COMEBACK = [
    { face: "grin", line: "Redemption arc" },
    { face: "cool", line: "Back on the horse" },
    { face: "grin", line: "We do not speak of the last one" }
  ];

  /* Ordinary miss. */
  const WRONG = [
    { face: "dead", line: "Bruh." },
    { face: "cry", line: "Pain." },
    { face: "think", line: "Bold guess. Wrong, but bold." },
    { face: "dead", line: "Task failed successfully" },
    { face: "shock", line: "Not the one" },
    { face: "cry", line: "It's giving 'skipped that page'" },
    { face: "think", line: "Close. Well — adjacent." },
    { face: "dead", line: "This is fine." },
    { face: "shock", line: "The root is right there, buddy" },
    { face: "cry", line: "We've all been here" },
    { face: "think", line: "Confidently incorrect" },
    { face: "dead", line: "Respectfully: no" }
  ];

  /* Miss that ends a run worth mourning. */
  const BROKEN = [
    { at: 5, face: "shock", line: "And the streak dies here" },
    { at: 8, face: "cry", line: "Eight in a row, undone. Tragic." },
    { at: 12, face: "dead", line: "A twelve-streak walked so this could fall" }
  ];

  /* End of a study session, by percentage. */
  const SUMMARY = [
    { at: 95, face: "cool", line: "Flawless. Log off, you've won." },
    { at: 80, face: "smug", line: "Genuinely good at this" },
    { at: 60, face: "grin", line: "Solid. Rough edges, but solid." },
    { at: 40, face: "think", line: "Learning is happening. Slowly." },
    { at: 20, face: "cry", line: "Character development" },
    { at: 0, face: "dead", line: "We're going to pretend that didn't happen" }
  ];

  /* End of a game, by percentage. */
  const GAME_OVER = [
    { at: 90, face: "cool", line: "Someone has been studying" },
    { at: 70, face: "smug", line: "Respectable numbers" },
    { at: 50, face: "grin", line: "Middle of the pack, and proud" },
    { at: 30, face: "think", line: "It's a journey" },
    { at: 0, face: "dead", line: "Statistically, guessing would have gone better" }
  ];

  const BEST = [
    { face: "cool", line: "New best. Insufferable behaviour." },
    { face: "smug", line: "Record broken. Tell someone." },
    { face: "grin", line: "High score. You may gloat." }
  ];

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* Highest threshold at or below `value`; the tables are ordered high to low
   * for the summaries and low to high for the streaks, so each has its own. */
  function atMost(list, value) {
    for (const row of list) if (value >= row.at) return row;
    return null;
  }

  function atLeast(list, value) {
    let hit = null;
    for (const row of list) if (value >= row.at) hit = row;
    return hit;
  }

  /* An answer. `streak` is the run *including* this answer when right, and
   * the run this answer just ended when wrong. */
  function answer(correct, streak, hadMissed) {
    if (correct) {
      const milestone = atLeast(STREAK, streak || 0);
      if (milestone && streak === milestone.at) return milestone;
      if (hadMissed && streak === 1) return pick(COMEBACK);
      return pick(RIGHT);
    }
    const mourned = atLeast(BROKEN, streak || 0);
    if (mourned) return mourned;
    return pick(WRONG);
  }

  function summary(pct) {
    return atMost(SUMMARY, pct) || SUMMARY[SUMMARY.length - 1];
  }

  function gameOver(pct, isBest) {
    if (isBest) return pick(BEST);
    return atMost(GAME_OVER, pct) || GAME_OVER[GAME_OVER.length - 1];
  }

  window.WordMemes = { answer, summary, gameOver };
})();
