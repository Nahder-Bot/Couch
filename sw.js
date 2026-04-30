// Couch service worker — drop this in the same folder as app.html + landing.html.
// Provides:
//   1. Offline shell caching so the app loads fast and works without a connection (read-only)
//   2. Push notification handling so OS-level notifications arrive even when the app is closed
// Bump CACHE whenever you ship user-visible app changes so installed PWAs invalidate and
// re-fetch the shell. Version naming convention: couch-v{N}-{milestone-or-fix-shorthand}.

const CACHE = 'couch-v36.5-conflict-aware-empty';
// Post-Phase-9 routing: landing.html at /, app.html at /app (via Firebase Hosting rewrites).
// Pre-cache the app shell (primary PWA entry) + core CSS/JS so offline cold-launch works.
// Other JS modules (js/firebase.js, js/constants.js, etc.) populate the cache via the
// stale-while-revalidate fetch handler on first online run.
const SHELL = ['/app', '/css/app.css', '/js/app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ===== Caching: stale-while-revalidate for shell, bypass for live API =====
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  const isLiveAPI =
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('themoviedb.org');
  if (isLiveAPI) return;

  // Firebase Hosting reserved namespace (/__/auth/*, /__/firebase/*, /__/init.json …).
  // These are same-origin but must never be intercepted — the auth SDK loads
  // its redirect handler iframe from /__/auth/handler, and caching those
  // breaks sign-in + spams console errors.
  if (url.pathname.startsWith('/__/')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })()
  );
});

// ===== Push notifications =====
// Cloud Function sends a JSON payload like:
//   { title: "Watchparty starting", body: "Ashley starts Inception in 5 min", url: "/app?wp=abc", tag: "wp-abc" }
// We display it as a system notification. Clicking it focuses the app and navigates if a url is given.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    try { data = { title: 'Couch', body: event.data ? event.data.text() : '' }; } catch(e2) {}
  }
  const title = data.title || 'Couch';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/mark-72.png',
    tag: data.tag || 'qn-default',
    data: { url: data.url || '/app' },
    requireInteraction: !!data.requireInteraction,
    renotify: !!data.renotify
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('postMessage' in client) {
            try { client.postMessage({ type: 'qn-notification-click', url: targetUrl }); } catch(e) {}
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
