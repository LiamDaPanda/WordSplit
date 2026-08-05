# WordSplit

An Add-to-Home-Screen vocabulary app for the **Upper Level SSAT** and the **SAT**.
Instead of asking you to memorize definitions cold, WordSplit breaks each word
into its prefix, root, and suffix, tells you what each piece means, and shows how
those pieces add up to the definition.

> **incredulous** = `in-` (not) + `cred` (to believe) + `-ulous` (tending to)
> → *tending to not believe*

Once you know that `cred` means "believe", you get *credible*, *credence*,
*credulity*, and *discredit* almost for free. That's the whole idea.

## What's in it

| | |
|---|---|
| **Upper Level SSAT list** | 1,508 words with definitions |
| **SAT list** | 1,612 words with definitions |
| **Unique words total** | 2,600 |
| **Word parts** | 93 prefixes, 437 roots, 136 suffixes |

Every word carries a part of speech and a plain-language definition. The word
parts each carry a meaning, a language of origin, and classic example words.

## Features

**Split** — Type any word, including ones outside the study lists, and see it
broken apart. Tap any coloured piece to open that prefix/root/suffix and see
every study word that uses it. There's a word of the day and a random-word
button.

**Five study modes plus review**

- **Flashcards** — see the word, recall the meaning, grade yourself. Optional
  part hints show the morpheme breakdown before you flip.
- **Pick the meaning** — multiple choice, word → definition.
- **Pick the word** — multiple choice, definition → word.
- **Parts quiz** — a word is split on screen and one piece is highlighted; say
  what that piece means. This is the mode that builds transferable knowledge.
- **Spell it** — read the definition, type the word.
- **Due review** — only the words the spaced-repetition schedule says are due.

**Words** — browse or search the full list, filtered by how well you know each
one (new / shaky / learning / mastered), with a detail page per word.

**Roots** — browse the whole morpheme database on its own, searchable by
spelling or meaning.

**Settings** — pick which lists are in rotation (SSAT, SAT, or both), session
length, hardest-words-first ordering, part hints, auto-advance, spoken words,
and light/dark/system theme. Progress can be reset.

Progress uses a Leitner box schedule: a correct answer promotes a word and
pushes its next review out (1, 2, 4, 8, 16, 32 days); a miss sends it back to
the start. Everything is stored on the device in `localStorage` — no account, no
network, no tracking.

## Installing on an iPhone

1. Serve the folder over HTTPS (or `http://localhost` for testing) and open it
   in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Launch it from the Home Screen — it opens full screen with no browser chrome
   and works with no connection at all.

A service worker precaches every asset on first load, so after one visit the
app is fully offline: all 2,600 words and 666 word parts live on the device.

## Running locally

No build step, no dependencies — it's static files.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Note that the service worker and Add to Home Screen both need `localhost` or
HTTPS; opening `index.html` via `file://` won't register the worker.

## How the splitter works

`js/splitter.js` doesn't use a lookup table of pre-split words. It searches:

1. Peel up to two prefixes off the front and three suffixes off the back,
   collecting every combination that leaves a plausible middle.
2. Score each reading — an exact root match is worth most, a root plus a linking
   vowel slightly less, and leftover unexplained letters cost points. Longer
   root matches are favoured so a greedy suffix can't strip a root's tail
   (`con + volut`, not `con + vol + ute`).
3. Retry after removing a regular inflection (`-s`, `-ed`, `-ing`, restoring a
   silent `e` or an undoubled consonant) and keep whichever reading explains
   more of the word.
4. Fall back to an affix-only reading when there's no classical root but a real
   English base is left over (`be + moan`, `boor + ish`).

About 80% of the 2,600 study words split into two or more meaningful parts. The
rest — *aegis*, *balm*, *coup*, *banana* — genuinely have no classical parts, so
the app says so rather than inventing a breakdown.

An override table handles words whose real history disagrees with a greedy
match (`reticent` is `re` + `tac` + `ent`, not `retic` + `ent`) and blocks
over-splitting of ordinary words (`summer` is not `sum` + `mer`). Every override
is checked against the morpheme database, so no piece ever renders without a
meaning.

## Layout

```
index.html              app shell and tab bar
css/styles.css          iOS-first styling, light and dark
js/morphemes.js         666 prefixes, roots, and suffixes
js/splitter.js          segmentation engine and override table
js/data/ssat.js         Upper Level SSAT words
js/data/sat.js          SAT words
js/store.js             settings, progress, Leitner scheduling
js/app.js               views and study modes
sw.js                   offline precache
manifest.webmanifest    PWA metadata
icons/                  app icons, including a maskable variant
```

## A note on the word lists

These are study lists assembled for this app — high-frequency vocabulary at each
test's level, not an official or licensed word list from any testing
organization. Definitions are written to be short enough to hold in your head
during a quiz, which means they're study glosses, not full dictionary entries.
