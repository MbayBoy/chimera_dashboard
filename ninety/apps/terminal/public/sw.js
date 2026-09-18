/*
 * Service worker.
 *
 * Caches the shell so the terminal opens and can be installed to a home screen,
 * and so a yard that loses connectivity still sees the interface rather than a
 * browser error page.
 *
 * It deliberately does NOT cache API responses. A cached list of jobs whose
 * windows closed ten minutes ago is worse than an empty screen: the operator
 * would quote on work that no longer exists, lose the ninety seconds, and
 * conclude the product is broken. Live data is live or it is absent.
 */
const SHELL_CACHE = 'ninety-terminal-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never serve API or WebSocket traffic from a cache.
  if (url.pathname.startsWith('/v1/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});

/*
 * Web push, so an alert reaches the counter when the tab is backgrounded or the
 * screen is off. A browser notification alone is silent when the tablet is
 * muted, which is why the foreground path also plays a sound and vibrates.
 */
self.addEventListener('push', (event) => {
  let payload = { title: 'NINETY', body: '' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : '';
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: 'ninety-new-request',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 120, 300, 120, 500],
      icon: '/icon.svg',
      badge: '/icon.svg',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      return existing ? existing.focus() : self.clients.openWindow('/');
    }),
  );
});
