# WordSplit

**Live: https://liamdapanda.github.io/WordSplit/**

Served by GitHub Pages straight from the repository — the app is static, so
there is no build step and `.nojekyll` keeps the tree from going through Jekyll.

Pages is configured in repository settings, not in this repo — there is no
deploy workflow, and adding one does not help. Two things were established the
hard way and are worth not repeating:

- A workflow declaring the `pages` concurrency group **cancels GitHub's own
  branch-deployment build**, because that is the group the built-in build uses.
- A job declaring the `github-pages` environment is rejected before its first
  step unless the Pages source is already set to "GitHub Actions", and
  `configure-pages` with `enablement: true` will not switch a site that is
  already deploying from a branch — it succeeds as a no-op.

So the source is a settings choice: **Settings → Pages**. To publish `main`,
either set Source to *Deploy from a branch → `main` / `(root)`*, or make `main`
the default branch under Settings → Branches. If Source is set to *GitHub
Actions*, a workflow is required and branch pushes will not publish on their
own.

An Add-to-Home-Screen vocabulary app for the **Upper Level SSAT**.
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
| **Upper Level SSAT list** | 4,884 words — the one study list |
| **Dictionary backing** | 2,442 further everyday and academic words |
| **Words the app knows** | 7,238 |
| **Word parts** | 93 prefixes, 439 roots, 135 suffixes |

Every word carries a part of speech and a plain-language definition. The word
parts each carry a meaning, a language of origin, and classic example words.

There is one study list, and only one — the SSAT. The everyday words are not a
second list you can switch to; they are a recognition dictionary. They exist so
that looking a word up returns a definition instead of a blank, and so the
splitter has a vocabulary wide enough to tell a real word from a typo. They are
never drilled, scored, or counted.

## Features

**Split** — Type a word and press **Split** (or Enter) to see it broken apart.
Tap any coloured piece to open that prefix/root/suffix and see every study word
that uses it. There's a word of the day and a random-word button.

A definition always appears. If the word is an inflected form the dictionary
does not list, the base word's meaning stands in, labelled — *duties* shows
"plural of **duty** — a moral or legal obligation". If the word is not a word at
all, the app says so rather than inventing a breakdown: typing `blorption` gets
"not in the dictionary", with a **Split it anyway** button if you want the parts
regardless. Even then, a word built from real parts is explained by them.

**Play** — three games over the same words, scored rather than scheduled.
Answers still count toward your progress, so playing is real study.

- **Word Rush** — 60 seconds of rapid questions. A combo multiplier builds to
  ×5 on a clean run; a miss resets it and costs three seconds.
- **Build It** — a definition and a tray of prefix/root/suffix tiles: assemble
  the word from its parts. Puzzles are only offered when the tiles genuinely
  spell the word, so there is always a real answer to find.
- **Survival** — three lives, no clock, and the field of choices widens the
  longer you last.

Each keeps a high score on the device, and the results screen lists the words
you missed so you can tap straight through to them.

**Eight study modes**

- **Flashcards** — see the word, recall the meaning, grade yourself. Optional
  part hints show the morpheme breakdown before you flip.
- **Pick the meaning** — multiple choice, word → definition.
- **Pick the word** — multiple choice, definition → word.
- **Parts quiz** — a word is split on screen and one piece is highlighted; say
  what that piece means. This is the mode that builds transferable knowledge.
- **Spell it** — read the definition, type the word.
- **Build it** — read the definition, then assemble the word from a tray of
  prefix, root and suffix tiles. Only offered for words whose parts genuinely
  spell them, so every puzzle has a findable answer: 2,167 of the list qualify.
- **Analogies** — A is to B as C is to what, in the test's own format.
- **Due review** — only the words the spaced-repetition schedule says are due.

**Pairs** — put in two words and the app works out how they relate, then lists
other pairs that relate the same way. *benevolent* is to *malevolent* as
*benediction* is to *malediction*: both swap the same prefix over the same
root. Tapping a pair pivots the view onto it. There is an **Analogies** study
mode too, asking it in the SSAT's own A : B :: C : ? format.

Everything it reports is derived from the breakdown, so it is a relation the
app can point at in the spelling rather than one it asserts. Where two words
share no structure it says so instead of inventing something.

**Words** — browse or search the full list, filtered by how well you know each
one (new / shaky / learning / mastered), with a detail page per word.

**Roots** — browse the whole morpheme database on its own, searchable by
spelling or meaning.

**Commentary** — every answer gets a reaction face and a caption. Get it right
and you're told you're built different; miss one and you get *"Bold guess.
Wrong, but bold."* Streaks are noticed, broken streaks are mourned, and the
first right answer after a miss is a redemption arc. It reads the score at the
end of a session or a game too.

A miss is never an insult — the lines tease the moment, not the person — and
the caption always sits *above* the real feedback, never instead of it.
**Settings → Commentary** turns the whole thing off.

**Your memes** — the app ships the frame; you fill it. Add images from the
camera roll or paste an image URL, tag each one to show on a right answer, a
wrong one, or either, and give it a caption. They then appear as proper meme
cards — picture with the caption laid over it in the usual heavy outlined type
— in study, in the games, and on the results screens.

Everything you add is stored as a blob in IndexedDB **on the device**. It works
with no connection, it is never uploaded, and *Remove all* clears it.

Twenty-six reaction images ship with the app, so it is stocked before you add
anything. Twenty are photographs — pandas, red pandas, capybaras, a quokka,
yawning cats, a golden retriever, a labradoodle mid-bounce, a tabby in a box
looking thoroughly unimpressed — because that is where reaction images actually
live. The other six are paintings, kept for range rather than for the whole
set: Ducreux pointing and smirking (already a well-travelled meme in his own
right), Munch's *Scream*, Courbet's *Man Made Mad with Fear*. Thirteen are
tagged for right answers and thirteen for wrong.

Every licence permits redistribution — public domain, CC0, CC BY, CC BY-SA —
and nothing NonCommercial or NoDerivatives is accepted. The CC ones ask to be
credited, so each is listed with its author, licence and source under
**Settings → Your memes → Where the shipped ones come from**. A switch there
turns them off if you would rather only see your own.

What is deliberately *not* bundled is a folder of Drake and Distracted
Boyfriend. Those are photographs and video frames someone owns, several of
them actively enforced, and copying them into a repository served publicly
under your name would be redistributing someone else's work. Hotlinking is
worse — it breaks the offline promise and spends someone else's bandwidth
besides. Classical painters had much the same range of faces and are in the
public domain; anything more current is a file away.

Some sites refuse to hand an image to another page. That is a CORS refusal
with no workaround from a web page, so the app says exactly that and you can
save the file and add it that way.

**On the clock** — the Upper Level SSAT verbal section is 60 questions in 30
minutes, so **30 seconds** is the real pace, and that is the default. Knowing a
word is not the same skill as knowing it in half a minute. A ring counts down
in the session header, turns amber then red, and pulses over the last five
seconds; running out is a miss, exactly as it is on the test — no answer, no
credit — but the answer and its breakdown are still shown, because the point is
to learn it. Set it to 20s, 45s, or off in Settings.

Flashcards and Due review are never timed: a card you grade yourself has no
moment at which it becomes wrong.

**Settings** — session length, time per question, hardest-words-first ordering,
part hints, spoken words, commentary, and
light/dark/system theme. Auto-advance is **off** by default so an answer and its
breakdown stay on screen until you tap Next; it can be set to 3, 5, or 8
seconds. Adaptive splitting can be turned off, and both progress and learned
corrections can be reset.

Progress uses a Leitner box schedule: a correct answer promotes a word and
pushes its next review out (1, 2, 4, 8, 16, 32 days); a miss sends it back to
the start. Everything is stored on the device in `localStorage` — no account, no
network, no tracking.

## Installing on an iPhone

1. Open **https://liamdapanda.github.io/WordSplit/** in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Launch it from the Home Screen — it opens full screen with no browser chrome
   and works with no connection at all.

A service worker precaches every asset on first load, so after one visit the
app is fully offline: all 7,238 words and 667 word parts live on the device,
along with any memes you have added.

## A splitter that learns

The scoring in `js/splitter.js` is hand-written rules. On top of it sits a
linear model (`js/learn.js`) with one weight per scoring feature — a weight for
each root, prefix, and suffix, plus a few structural features like how many
affixes a reading uses and how many letters it leaves unexplained.

It is trained by **structured perceptron**: show it the correct reading of a
word, and it pushes weight toward the features of that reading and away from
the reading it had preferred. The important part is that weights live on the
*morpheme*, not the word — correcting `convoluted` to `con + volut` also moves
`evolution`, `revolve`, and every other word built from that root.

Two things feed it:

- **The model it ships with** (`js/weights.js`) is trained by `tools/train.js`
  on the several hundred hand-verified splits in the override table. Those
  words already resolve correctly through the override; training on them is how
  that evidence reaches the thousands of words that have no override.
- **Your corrections.** Every split in the Split view asks "Is this breakdown
  right?" Answering *no* lists the readings the engine considered, ranked, and
  picking one trains the model on the spot. Corrections are stored separately
  from the shipped weights, so *Forget my corrections* returns to the trained
  baseline rather than to nothing.

It runs entirely on the device. No network call, no external model, no
telemetry — a few hundred numbers in `localStorage`.

### Does it actually work?

`node tools/evaluate.js` measures it, using the verified splits as a gold set
with the override table bypassed so the splitter has to derive each reading:

| | exact-match accuracy |
|---|---|
| Hand-written rules alone | 67.9% |
| With the shipped model | **76.1%** |
| Held out: train on half, test on the half it never saw | 66.9% → **72.1%** |

The held-out row is the honest one — it shows corrections carrying to unseen
words rather than the model memorizing its training set. Split coverage is
unchanged by learning, so the gain is better readings, not more of them.

Concretely, learning is what turns `con-tra-dict` into `contra-dict`,
`in-di-gn-ant` into `in-dign-ant`, `ol-fact-or-y` into `ol-fact-ory`, and
`di-a-lect` into `dia-lect`.

**What was tried and rejected:** an unsupervised self-training pass over the
word lists, where the model scores every reading, turns those scores into a
distribution, and re-weights morphemes by how much belief they carried. It
scored 71% against the 74% baseline of the day and is not in the app. A model
trained on its own guesses mostly learns to repeat them — including its
mistakes. The measurement is the reason it is not shipped.

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

About 85% of the SSAT words split into two or more meaningful parts.
The everyday list is far lower, around 45%, which is the point: *cat*, *run*,
and *table* have no classical parts, and the app says so rather than inventing a
breakdown. The same goes for *aegis*, *balm*, and *coup*.

Two rules keep the search from mangling ordinary words. Parts must reconstruct
the word, so a reading may never quietly add or drop a letter — *possess* is not
allowed to become *possese* on the way to an analysis. And a regular ending is
only peeled off when doing so buys something: *species* keeps its own spelling
rather than being read as a plural of *speci*.

Pieces are shown with the letters the word actually has. Overrides are written
with a morpheme's canonical form, but words carry whichever variant assimilated
to its neighbours, so *accommodate* opens with `ac-`, not the `ad-` it is filed
under. And a leftover middle is only called a **base** when it is a word in its
own right (`be` + `moan`); otherwise it is labelled a **stem**, because
*abhorrence* leaves `abhorr`, which is not a word and should not be called one.

An override table handles words whose real history disagrees with a greedy
match (`reticent` is `re` + `tac` + `ent`, not `retic` + `ent`) and blocks
over-splitting of ordinary words (`summer` is not `sum` + `mer`). Every override
is checked against the morpheme database, so no piece ever renders without a
meaning.

## Layout

```
index.html              app shell and tab bar
css/styles.css          iOS-first styling, light and dark
js/morphemes.js         667 prefixes, roots, and suffixes
js/splitter.js          segmentation engine and override table
js/weights.js           the learned model the app ships with (generated)
js/learn.js             perceptron: trains on corrections, on the device
js/data/ssat.js         Upper Level SSAT words — the study list
js/data/core.js         everyday words, dictionary backing only
js/analogy.js           relations between word pairs, and the pairs that match
js/store.js             settings, progress, high scores, Leitner scheduling
js/memes.js             the commentary: captions, faces, meme library
memes/                  twenty-six freely licensed reaction images, with credits
js/game.js              the three games in the Play tab
js/app.js               views and study modes
sw.js                   offline precache
manifest.webmanifest    PWA metadata
icons/                  app icons, including a maskable variant
tools/fetch-memes.py    re-fetches memes/, refusing any licence it may not ship
tools/train.js          regenerates js/weights.js
tools/evaluate.js       measures whether the model helps
.nojekyll               serves the tree as-is on GitHub Pages
```

Regenerate the shipped model after changing the morpheme database, the scoring,
or the override table:

```sh
node tools/train.js      # rewrites js/weights.js
node tools/evaluate.js   # confirms it still helps
```

## A note on the word lists

These are study lists assembled for this app — high-frequency vocabulary at each
test's level, not an official or licensed word list from any testing
organization. Definitions are written to be short enough to hold in your head
during a quiz, which means they're study glosses, not full dictionary entries.
