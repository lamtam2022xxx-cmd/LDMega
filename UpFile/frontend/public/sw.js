/**
 * sw.js — Service Worker (PWA)
 * Hỗ trợ Add to Home Screen, offline shell và cache assets tĩnh.
 * Không cache API calls hoặc upload sessions (luôn network-first).
 */

const CACHE_NAME = "ldmega-upload-v1";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls và Drive upload: NETWORK ONLY
  if (url.hostname.includes("workers.dev") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("accounts.google.com")) {
    return; // Không cache
  }

  // Không cache POST requests
  if (event.request.method !== "GET") return;

  // Shell assets: Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => caches.match("/index.html")); // Offline fallback
    })
  );
});
