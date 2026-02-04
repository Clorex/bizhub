/* BizHub Service Worker (strict caches, low storage) */
const VERSION = "bizhub-sw-v1.0.0";

const CACHE_STATIC = `${VERSION}-static`;
const CACHE_PAGES = `${VERSION}-pages`;
const CACHE_IMAGES = `${VERSION}-images`;
const CACHE_API = `${VERSION}-api`;

// Strict limits (tune later)
const LIMITS = {
  static: 80, // _next static chunks etc.
  pages: 20,  // recently visited pages
  images: 120, // transformed cloudinary images
  api: 40,    // small GET JSON responses (public only)
};

const MAX_AGE = {
  pagesMs: 2 * 24 * 60 * 60 * 1000,   // 2 days
  imagesMs: 7 * 24 * 60 * 60 * 1000,  // 7 days
  apiMs: 10 * 60 * 1000,              // 10 minutes
};

function now() {
  return Date.now();
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const extra = keys.length - maxEntries;
  if (extra <= 0) return;

  // delete oldest first
  for (let i = 0; i < extra; i++) {
    await cache.delete(keys[i]);
  }
}

async function putWithMeta(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  // store response
  await cache.put(request, response);
  // store meta timestamp
  await cache.put(
    new Request(request.url + "::meta"),
    new Response(String(now()), { headers: { "Content-Type": "text/plain" } })
  );
}

async function getMetaAgeMs(cacheName, request) {
  const cache = await caches.open(cacheName);
  const meta = await cache.match(new Request(request.url + "::meta"));
  if (!meta) return Infinity;
  const t = Number(await meta.text());
  if (!Number.isFinite(t)) return Infinity;
  return now() - t;
}

async function cacheFirst(cacheName, request, opts) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const age = await getMetaAgeMs(cacheName, request);
    if (!opts?.maxAgeMs || age <= opts.maxAgeMs) return cached;
    // stale -> still serve cached, but refresh in background
    fetch(request)
      .then(async (res) => {
        if (res && res.ok) await putWithMeta(cacheName, request, res.clone());
      })
      .catch(() => {});
    return cached;
  }

  const res = await fetch(request);
  if (res && res.ok) {
    await putWithMeta(cacheName, request, res.clone());
    if (opts?.maxEntries) await trimCache(cacheName, opts.maxEntries);
  }
  return res;
}

async function staleWhileRevalidate(cacheName, request, opts) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(async (res) => {
      if (res && res.ok) {
        await putWithMeta(cacheName, request, res.clone());
        if (opts?.maxEntries) await trimCache(cacheName, opts.maxEntries);
      }
      return res;
    })
    .catch(() => null);

  if (cached) return cached;
  const res = await fetchPromise;
  return res || new Response("", { status: 504 });
}

async function networkFirst(cacheName, request, opts) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      await putWithMeta(cacheName, request, res.clone());
      if (opts?.maxEntries) await trimCache(cacheName, opts.maxEntries);
    }
    return res;
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return cached || new Response("", { status: 504 });
  }
}

function isCloudinaryImage(url) {
  return url.includes("res.cloudinary.com") && url.includes("/image/upload/");
}

function isNextStatic(url) {
  return url.includes("/_next/static/");
}

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

// Only cache public-ish API GETs (strict allowlist)
function isCacheablePublicApi(urlObj) {
  if (!isSameOrigin(urlObj.href)) return false;
  if (!urlObj.pathname.startsWith("/api/")) return false;

  // allowlist (these are called publicly on product page)
  if (urlObj.pathname === "/api/vendor/shipping/options") return true;
  if (urlObj.pathname === "/api/vendor/chat/availability") return true;

  // everything else: don't cache (vendor auth endpoints etc)
  return false;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const keep = new Set([CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES, CACHE_API]);
      await Promise.all(keys.map((k) => (!keep.has(k) ? caches.delete(k) : Promise.resolve())));
      self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event?.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!req || req.method !== "GET") return;

  const url = new URL(req.url);

  // HTML navigation (pages)
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(CACHE_PAGES, req, { maxEntries: LIMITS.pages }));
    return;
  }

  // Next static assets (fast)
  if (isNextStatic(url.href)) {
    event.respondWith(cacheFirst(CACHE_STATIC, req, { maxEntries: LIMITS.static }));
    return;
  }

  // Cloudinary images (big data saver on repeat views)
  if (isCloudinaryImage(url.href)) {
    event.respondWith(cacheFirst(CACHE_IMAGES, req, { maxEntries: LIMITS.images, maxAgeMs: MAX_AGE.imagesMs }));
    return;
  }

  // Public API GETs (short cache)
  if (isCacheablePublicApi(url)) {
    event.respondWith(staleWhileRevalidate(CACHE_API, req, { maxEntries: LIMITS.api }));
    return;
  }

  // Same-origin css/js/images from public folder
  if (isSameOrigin(url.href)) {
    const dest = req.destination;
    if (dest === "style" || dest === "script" || dest === "font") {
      event.respondWith(staleWhileRevalidate(CACHE_STATIC, req, { maxEntries: LIMITS.static }));
      return;
    }
  }
});