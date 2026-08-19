/* WordSplit service worker — precache the whole app so it runs with no
 * network at all once it has been added to the Home Screen. */

const CACHE = "wordsplit-v15";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/morphemes.js",
  "./js/splitter.js",
  "./js/weights.js",
  "./js/learn.js",
  "./js/store.js",
  "./js/memes.js",
  "./js/analogy.js",
  "./js/game.js",
  "./js/app.js",
  "./js/data/core.js",
  "./js/data/ssat.js",
  "./memes/acrobat.jpg",
  "./memes/ava.jpg",
  "./memes/babbe.jpg",
  "./memes/badouzi.jpg",
  "./memes/bart.jpg",
  "./memes/blini.jpg",
  "./memes/bouncing.jpg",
  "./memes/capybara.jpg",
  "./memes/curiousred.jpg",
  "./memes/deadpan.jpg",
  "./memes/desespere.jpg",
  "./memes/ducreux.jpg",
  "./memes/fubao.jpg",
  "./memes/ipe.jpg",
  "./memes/istanbul.jpg",
  "./memes/madfear.jpg",
  "./memes/outraged.jpg",
  "./memes/panda.jpg",
  "./memes/puppy.jpg",
  "./memes/quokka.jpg",
  "./memes/redpanda.jpg",
  "./memes/retriever.jpg",
  "./memes/scream.jpg",
  "./memes/sneer.jpg",
  "./memes/tongueout.jpg",
  "./memes/zeuxis.jpg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        const stale = keys.filter(k => k !== CACHE);
        return Promise.all(stale.map(k => caches.delete(k)))
          .then(() => stale.length);
      })
      .then(replaced => self.clients.claim().then(() => replaced))
      .then(replaced => {
        /* Serving cache-first means an open page is showing the build we have
         * just deleted: its HTML and scripts were already on screen before
         * this worker existed. The page cannot fix that itself — the copy of
         * the app running there is the old one, and older builds have no
         * update handling at all — so the worker navigates it. That is what
         * reaches a device stuck on a previous version.
         *
         * Only when something was actually replaced: on a first install there
         * is no old build on screen, and reloading would be a flicker for no
         * reason. */
        if (!replaced) return null;
        return self.clients.matchAll({ type: "window" }).then(clients => {
          clients.forEach(client => {
            try {
              client.navigate(client.url);
            } catch (err) {
              /* not supported everywhere; the page's own controllerchange
               * listener is the fallback */
            }
          });
        });
      })
  );
});

/* Assets are cache-first: they are static, versioned with the cache above, and
 * offline is the point.
 *
 * The page itself is not. Serving index.html from cache is what made a shipped
 * update look like it never arrived — the browser installs the new worker, but
 * the shell already on screen is the old one, and the new code only appears on
 * some later launch. So a navigation goes to the network first and falls back
 * to the cache, which keeps the app fully usable offline while making an
 * update land on the next open rather than the one after that.
 *
 * The cache is swapped atomically — the new one is filled during install and
 * the old deleted on activate — so a freshly fetched page never pairs with
 * scripts from a previous build. */
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html").then(hit => hit || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request)
        .then(response => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
