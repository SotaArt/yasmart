const CACHE_NAME = "smart-home-v2";

let scopeBase;
try {
  scopeBase = new URL("./", self.registration.scope).href;
} catch {
  scopeBase = "/";
}

const STATIC_ASSETS = [
  scopeBase,
  `${scopeBase}index.html`,
  `${scopeBase}manifest.json`,
  `${scopeBase}manifest-user.json`,
  `${scopeBase}manifest-mobile.json`,
  `${scopeBase}icon.svg`,
  `${scopeBase}icon-maskable.svg`,
];

// Install — cache the application shell at the deployment base path
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache for static assets and navigations
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API requests — network only (never cache)
  if (request.url.includes("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets — network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses (same-origin only, skip opaque cross-origin)
        if (response.ok && (response.type === "basic" || response.type === "cors")) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Navigation requests offline — serve the cached app shell
        if (request.mode === "navigate") {
          return caches.match(`${scopeBase}index.html`).then((cached) => cached || caches.match(scopeBase));
        }
        return caches.match(request).then((cached) => cached || caches.match(`${scopeBase}index.html`));
      })
  );
});