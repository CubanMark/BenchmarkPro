const CACHE_NAME = "benchmark-pro-cache-v440";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./css/styles.css",
  "./src/app.js",
  "./src/exercises.js",
  "./src/migrations.js",
  "./src/models.js",
  "./src/plans.js",
  "./src/pwa.js",
  "./src/stats.js",
  "./src/storage.js",
  "./src/ui.js",
  "./src/version.js",
  "./src/workouts.js",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const accept = req.headers.get("accept") || "";
  const isHtml = accept.includes("text/html") || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");

  if (url.origin === self.location.origin) {
    if (isHtml) {
      event.respondWith(
        fetch(req)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return response;
          })
          .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
      );
      return;
    }

    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (req.method === "GET") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
