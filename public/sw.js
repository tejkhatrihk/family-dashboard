const CACHE_NAME = "family-dashboard-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        const response = await fetch("/");
        if (!response.ok) {
          throw new Error(`Failed to fetch app shell: ${response.status}`);
        }

        const html = await response.clone().text();
        const assets = [
          ...html.matchAll(/(?:src|href)="(\/[^"]+)"/g),
        ]
          .map(([, assetPath]) => assetPath)
          .filter((assetPath) => /\.(js|css)(\?|$)/.test(assetPath));

        await cache.put("/", response);
        await cache.addAll([
          ...assets,
          "/manifest.webmanifest",
          "/family-dashboard.svg",
          "/family-dashboard-192.png",
          "/family-dashboard-512.png",
        ]);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("family-dashboard-shell-") &&
                cacheName !== CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put("/", responseCopy)),
            );
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match("/");
          if (cachedPage) return cachedPage;
          return new Response("The Family Dashboard is not available offline yet.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }),
    );
    return;
  }

  if (!["script", "style", "image", "font"].includes(request.destination)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseCopy = response.clone();
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseCopy)),
          );
        }
        return response;
      });
    }),
  );
});
