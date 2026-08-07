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

  /* ---------- your meme library ----------
   *
   * The captions above ship with the app. Actual meme images do not, and
   * deliberately: the well-known ones are photographs and video frames owned
   * by the people who made them, and bundling them into a repo that is served
   * publicly would be redistributing someone else's work. Hotlinking is worse
   * — it breaks the offline promise and spends someone else's bandwidth.
   *
   * So the app ships the frame and you fill it. Add whatever memes you like
   * from the camera roll or a URL; they are stored as blobs in IndexedDB on
   * this device, which means they work with no connection and never leave it.
   */
  /* Reaction images that ship with the app.
   *
   * Every one is an artwork old enough that its copyright has expired, and a
   * faithful photograph of a flat public-domain painting earns no new
   * copyright of its own, so these can be redistributed freely. Each was
   * checked against the Wikimedia Commons licence field before being pulled
   * in — the sourcing script is in the commit that added them.
   *
   * This is deliberately not a folder of Drake and Distracted Boyfriend.
   * Those are photographs and video frames someone owns, and several of the
   * owners enforce; copying them into a public repository would hand this
   * project a real problem rather than a feature. Classical painters had
   * roughly the same range of faces and are out of copyright.
   */
  const BUILTIN = [
    { file: "memes/ducreux.jpg", mood: "right",
      caption: "and you said you didn't study",
      title: "Portrait de l'artiste sous les traits d'un moqueur",
      artist: "Joseph Ducreux", year: "c. 1793",
      source: "https://commons.wikimedia.org/wiki/File:Joseph_Ducreux_-_Self-portrait_of_the_artist_as_a_mocker.jpg" },
    { file: "memes/babbe.jpg", mood: "right",
      caption: "the test cannot hurt you",
      title: "Malle Babbe",
      artist: "Frans Hals", year: "c. 1633",
      source: "https://commons.wikimedia.org/wiki/File:Malle_Babbe_(Frans_Hals)-WUS03734.jpg" },
    { file: "memes/cavalier.jpg", mood: "right",
      caption: "merely correct? no. inevitable.",
      title: "The Laughing Cavalier",
      artist: "Frans Hals", year: "1624",
      source: "https://commons.wikimedia.org/wiki/File:Frans_Hals_%E2%80%93_The_Laughing_Cavalier.jpg" },
    { file: "memes/lutenist.jpg", mood: "right",
      caption: "a toast to the prefix",
      title: "Self-Portrait as a Lutenist",
      artist: "Jan Steen", year: "c. 1663",
      source: "https://commons.wikimedia.org/wiki/File:Jan_Steen_-_Self-Portrait_as_a_Lutenist_-_WGA21754.jpg" },
    { file: "memes/leyster.jpg", mood: "right",
      caption: "oh this? effortless",
      title: "Self-Portrait",
      artist: "Judith Leyster", year: "c. 1630",
      source: "https://commons.wikimedia.org/wiki/File:Judith_Leyster_-_Self-Portrait_-_Google_Art_Project.jpg" },
    { file: "memes/zeuxis.jpg", mood: "right",
      caption: "i knew it the whole time",
      title: "Self-Portrait as Zeuxis Laughing",
      artist: "Rembrandt", year: "c. 1662",
      source: "https://commons.wikimedia.org/wiki/File:Rembrandt_Self-portrait_as_the_Laughing_Zeuxis_while_Painting_an_Old_Woman.jpg" },
    { file: "memes/scream.jpg", mood: "wrong",
      caption: "the definition left my head",
      title: "The Scream",
      artist: "Edvard Munch", year: "1893",
      source: "https://commons.wikimedia.org/wiki/File:Edvard_Munch_-_The_Scream_-_Google_Art_Project.jpg" },
    { file: "memes/desespere.jpg", mood: "wrong",
      caption: "wait, THAT was the root?",
      title: "Le D\u00e9sesp\u00e9r\u00e9",
      artist: "Gustave Courbet", year: "c. 1843",
      source: "https://commons.wikimedia.org/wiki/File:Gustave_Courbet_-_Le_D%C3%A9sesp%C3%A9r%C3%A9_(1843).jpg" },
    { file: "memes/madfear.jpg", mood: "wrong",
      caption: "it's the vocab section",
      title: "The Man Made Mad with Fear",
      artist: "Gustave Courbet", year: "c. 1844",
      source: "https://commons.wikimedia.org/wiki/File:The_Man_Made_Mad_with_Fear_by_Gustave_Courbet.jpg" },
    { file: "memes/despair.jpg", mood: "wrong",
      caption: "we move on",
      title: "Despair",
      artist: "Edvard Munch", year: "1894",
      source: "https://commons.wikimedia.org/wiki/File:Edvard_Munch_-_Despair_(1894).jpg" },
  ];

  const DB_NAME = "wordsplit-memes";
  const STORE = "memes";
  let db = null;
  let loaded = [];
  let onChange = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      if (!window.indexedDB) return reject(new Error("no indexeddb"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(mode) {
    return openDB().then(d => d.transaction(STORE, mode).objectStore(STORE));
  }

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /* Object URLs are minted once per record and held for the life of the page,
   * so a card can be rendered synchronously from a string of HTML. */
  function decorate(rec) {
    return {
      id: rec.id,
      mood: rec.mood || "any",
      caption: rec.caption || "",
      name: rec.name || "",
      url: URL.createObjectURL(rec.blob)
    };
  }

  function load() {
    return tx("readonly")
      .then(store => request(store.getAll()))
      .then(rows => {
        loaded.forEach(m => URL.revokeObjectURL(m.url));
        loaded = rows.map(decorate);
        if (onChange) onChange(loaded);
        return loaded;
      })
      .catch(() => {
        /* private mode, or storage refused — the captions still work */
        loaded = [];
        return loaded;
      });
  }

  function add(blob, opts) {
    const o = opts || {};
    const rec = {
      blob,
      mood: o.mood || "any",
      caption: o.caption || "",
      name: o.name || "",
      added: Date.now()
    };
    return tx("readwrite").then(store => request(store.add(rec))).then(load);
  }

  function update(id, patch) {
    return tx("readwrite")
      .then(store => request(store.get(id)).then(rec => {
        if (!rec) return null;
        return request(store.put(Object.assign(rec, patch)));
      }))
      .then(load);
  }

  function remove(id) {
    return tx("readwrite").then(store => request(store.delete(id))).then(load);
  }

  function clear() {
    return tx("readwrite").then(store => request(store.clear())).then(load);
  }

  function list() {
    return loaded.slice();
  }

  /* A meme for this outcome, or null when the library has nothing that fits.
   * "any" images are eligible either way, so one uploaded meme still shows. */
  /* User images and the shipped paintings draw from one pool, so adding your
   * own dilutes the built-ins rather than replacing them — unless you say
   * otherwise, which is what `useBuiltins` is for. */
  function pickImage(correct, useBuiltins) {
    const want = correct ? "right" : "wrong";
    const pool = useBuiltins === false ? [] : BUILTIN.map(b => ({
      id: "builtin:" + b.file,
      mood: b.mood,
      caption: b.caption,
      url: b.file,
      builtin: true
    }));
    const fits = pool.concat(loaded)
      .filter(m => m.mood === want || m.mood === "any");
    if (!fits.length) return null;
    return fits[Math.floor(Math.random() * fits.length)];
  }

  function credits() {
    return BUILTIN.map(b => ({
      title: b.title, artist: b.artist, year: b.year, source: b.source
    }));
  }

  /* Images are capped so one enormous screenshot cannot eat the device
   * storage budget and take the word lists down with it. */
  const MAX_BYTES = 4 * 1024 * 1024;

  function fromFile(file, opts) {
    if (!file || file.size > MAX_BYTES) {
      return Promise.reject(new Error("Image is over 4MB"));
    }
    if (!/^image\//.test(file.type)) {
      return Promise.reject(new Error("That is not an image"));
    }
    return add(file, Object.assign({ name: file.name }, opts));
  }

  /* Fetching someone else's image needs their server to allow it. When it
   * refuses there is nothing to be done from a page, so say so plainly
   * rather than failing silently — saving the image and picking the file
   * always works. */
  function fromURL(url, opts) {
    return fetch(url, { mode: "cors" })
      .then(res => {
        if (!res.ok) throw new Error("Server said " + res.status);
        return res.blob();
      })
      .then(blob => {
        if (!/^image\//.test(blob.type)) throw new Error("That URL is not an image");
        if (blob.size > MAX_BYTES) throw new Error("Image is over 4MB");
        return add(blob, Object.assign({ name: url.split("/").pop() }, opts));
      })
      .catch(err => {
        const msg = /Failed to fetch|NetworkError|CORS/i.test(String(err && err.message))
          ? "That site will not hand the image to another page. Save it, then add the file."
          : err.message || "Could not fetch that";
        throw new Error(msg);
      });
  }

  const Library = {
    load, list, add, update, remove, clear, credits,
    fromFile, fromURL, pick: pickImage,
    builtinCount: BUILTIN.length,
    get count() { return loaded.length; },
    set onChange(fn) { onChange = fn; }
  };

  window.WordMemes = { answer, summary, gameOver, Library };
})();
