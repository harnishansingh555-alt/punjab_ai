// Punjab AI service worker: makes the site installable and keeps the app shell available offline.
// Chat and sign-in requests (/api/*) always go to the network and are never cached.
const CACHE = "punjab-ai-v2";
const SHELL = ["/", "/index.html", "/chat.html", "/features.html", "/help.html", "/about.html", "/faq.html", "/contact.html", "/privacy.html", "/live.html", "/terms.html", "/404.html", "/pages.css", "/pages.js", "/style.css", "/auth.js", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Network first, so updates show up right away; fall back to the cache when offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/chat.html")))
  );
});
