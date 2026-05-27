/* =========================
   SERVICE WORKER
   Caches app for offline use
========================= */

const CACHE = "vscode-godmode-v1";

const PRECACHE = [
  "/",
  "/index.html",
  "/app.js",
  "/style.css",
  "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/loader.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/editor/editor.main.js",
  "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/editor/editor.main.css",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
];

// Install: cache all core files
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fallback to network
self.addEventListener("fetch", e => {
  // Don't cache AI API calls
  if (e.request.url.includes("googleapis.com") ||
      e.request.url.includes("groq.com") ||
      e.request.url.includes("openrouter.ai") ||
      e.request.url.includes("deepseek.com") ||
      e.request.url.includes("huggingface.co") ||
      e.request.url.includes("unsplash.com") ||
      e.request.url.includes("picsum.photos") ||
      e.request.method !== "GET") {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match("/index.html"));
    })
  );
});