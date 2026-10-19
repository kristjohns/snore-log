// Keeps the app and the snore model available offline.
// Bump VERSION with every release so phones pick up the new files.
const VERSION = "v1";
const CACHE = `snore-log-${VERSION}`;
const CORE = [
  "./",
  "index.html",
  "css/app.css",
  "js/app.js",
  "js/analysis.js",
  "js/capture-worklet.js",
  "js/charts.js",
  "js/db.js",
  "js/format.js",
  "js/listener.js",
  "js/session.js",
  "js/wav.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "vendor/mediapipe/audio_bundle.js",
  "vendor/mediapipe/wasm/audio_wasm_internal.js",
  "vendor/mediapipe/wasm/audio_wasm_internal.wasm",
  "model/yamnet.tflite",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("snore-log-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first; anything not cached yet is fetched and kept.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
