const CACHE_NAME = "benchmark-pro-cache-v502";
const META_CACHE = "benchmark-pro-meta";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./css/styles.css",
  "./src/app.js",
  "./src/charts.js",
  "./src/engine.js",
  "./src/exercises.js",
  "./src/library.js",
  "./src/migrations.js",
  "./src/models.js",
  "./src/plans.js",
  "./src/pwa.js",
  "./src/reminder.js",
  "./src/storage.js",
  "./src/ui.js",
  "./src/version.js",
  "./src/views.js",
  "./src/workouts.js",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: "reload" umgeht den HTTP-Cache, sonst landen alte Dateien im neuen Cache
      .then((cache) => cache.addAll(CORE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME && key !== META_CACHE ? caches.delete(key) : Promise.resolve()))))
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

// Tägliche Erinnerung: Android weckt den Service Worker periodisch (nur installierte PWA).
// Der Status kommt aus dem Meta-Cache, weil der Service Worker kein localStorage lesen kann.
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "bmp-reminder") return;
  event.waitUntil(checkReminder());
});

async function checkReminder() {
  try {
    const cache = await caches.open(META_CACHE);
    const res = await cache.match("./__reminder.json");
    if (!res) return;
    const meta = await res.json();
    if (!meta.enabled) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (meta.lastLogged === today || meta.lastNotified === today) return;
    const [h, m] = String(meta.time || "18:30").split(":").map(Number);
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
    await self.registration.showNotification("BenchMark Pro", {
      body: "Heute noch nichts eingetragen. Ein 5-Minuten-Snack reicht schon.",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192-maskable.png",
      tag: "bmp-reminder"
    });
    meta.lastNotified = today;
    await cache.put("./__reminder.json", new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
  } catch (e) {
    // Erinnerung ist best effort
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("./");
    })
  );
});
