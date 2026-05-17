var CACHE_NAME = "family-budget-v4";
var ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./css/shared.css",
  "./css/landing.css",
  "./css/app.css",
  "./js/theme.js",
  "./js/app.js",
  "./js/landing-init.js",
  "./js/iridescence.js",
  "./assets/app-screenshot.png",
  "./icons/icon.svg",
  "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.allSettled(
        ASSETS.map(function (url) {
          return cache.add(url);
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  var allowed =
    url.origin === self.location.origin ||
    url.hostname === "cdn.jsdelivr.net";
  if (!allowed) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});
