/* WHO'S LYING? — service worker: lets the game install as an app and play offline.
   Pages, scripts and styles: network first, so a new version shows up straight away.
   Fonts, sounds and images: cache first, they never change. Other sites are left alone. */
var CACHE = "wl-v3";
var CORE = [
  "./", "index.html", "css/style.css", "manifest.webmanifest",
  "js/config.js", "js/cases.js", "js/engine.js", "js/ads.js", "js/leaderboard.js",
  "js/platform.js", "js/progress.js", "js/audio.js", "js/fx.js", "js/game.js",
  "assets/favicon.svg", "assets/icon-192.png",
  "assets/fonts/big-shoulders-display-latin-900-normal.woff2", "assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  var key = url.origin + url.pathname; // one cache entry per file, whatever the ?query
  var media = /\.(woff2|mp3|png|svg|ico)$/.test(url.pathname);
  e.respondWith(caches.open(CACHE).then(function (c) {
    if (media) {
      return c.match(key).then(function (hit) {
        return hit || fetch(req).then(function (r) { if (r.ok) c.put(key, r.clone()); return r; });
      });
    }
    // "no-cache" asks the server whether the file changed, so a new release never mixes with old files.
    return fetch(req, req.mode === "navigate" ? undefined : { cache: "no-cache" }).then(function (r) { if (r.ok) c.put(key, r.clone()); return r; }).catch(function () {
      return c.match(key).then(function (hit) { return hit || (req.mode === "navigate" ? c.match(url.origin + url.pathname.replace(/[^/]*$/, "")) : undefined); });
    });
  }));
});
