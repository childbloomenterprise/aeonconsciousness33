const VERSION = "linc33-shell-v1";
const SHELL = [
  /*__BUILD_ASSETS__*/
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/maskable-512.png",
];
const OPTIONAL = [/*__OPTIONAL_ASSETS__*/];
self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREPARE_JOURNEY_SHELL") return;
  event.waitUntil(
    caches
      .open(VERSION)
      .then(async (cache) => {
        const saved = await Promise.all(
          [...SHELL, ...OPTIONAL].map((url) =>
            cache.match(url, { ignoreVary: true }),
          ),
        );
        if (saved.some((response) => !response))
          await cache.addAll([...SHELL, ...OPTIONAL]);
      })
      .then(() => event.ports[0]?.postMessage({ ready: true }))
      .catch(() => event.ports[0]?.postMessage({ ready: false })),
  );
});
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Keep the previous shell for tabs opened before this deployment.
            .filter((key) => key.startsWith("linc33-shell-") && key !== VERSION)
            .slice(0, -1)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    event.request.headers.has("Authorization")
  )
    return;
  if (event.request.mode === "navigate") {
    // Never cache token-bearing auth callback URLs or authenticated responses.
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const shell = await cache.match("/index.html");
        return shell || fetch(event.request);
      }),
    );
    return;
  }
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/images/") ||
    SHELL.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request, { ignoreVary: true }).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches
                .open(VERSION)
                .then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
