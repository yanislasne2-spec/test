// Pépite : fonctionne hors connexion.
// Change VERSION à chaque mise à jour pour que l'iPhone récupère la nouvelle version.
const VERSION = "pepite-3";
const FILES = ["./", "index.html", "style.css?v=3", "data.js?v=3", "app.js?v=3", "manifest.webmanifest", "vendor/anthropic-sdk-0.137.0.mjs",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour avoir les nouveautés), cache si hors ligne
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match("index.html")))
  );
});
