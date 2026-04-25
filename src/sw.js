// Service worker — cache-first for precached assets, push handler, and
// periodic background sync for review reminders (fires even when tab is closed).
// self.__WB_MANIFEST is replaced by vite-plugin-pwa at build time.

const CACHE  = 'ft-v1';
const ASSETS = /** @type {Array<{url:string,revision:string}|string>} */ (self.__WB_MANIFEST ?? []);

// ─── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache =>
        Promise.allSettled(
          ASSETS.map(entry =>
            cache.add(typeof entry === 'string' ? entry : entry.url).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Pass through cross-origin requests (Supabase API, fonts, etc.)
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached ?? fetch(event.request))
  );
});

// ─── Web Push ─────────────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'FocusTrack', {
      body:  payload.body,
      icon:  '/icons/android-chrome-192x192.png',
      badge: '/icons/favicon-32x32.png',
      tag:   payload.tag  ?? 'focustrack',
      data:  payload.data ?? null,
    })
  );
});

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/?view=tr';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.startsWith(self.location.origin));
      if (existing) { existing.focus(); return existing.navigate(url); }
      return self.clients.openWindow(url);
    })
  );
});

// ─── Periodic Background Sync: review reminders ───────────────────────────────

self.addEventListener('periodicsync', event => {
  if (event.tag === 'ft-review-check') {
    event.waitUntil(_bgCheckReviews());
  }
});

async function _bgCheckReviews() {
  const topics = await _readTopics();
  if (!topics.length) return;

  const today    = new Date().toISOString().slice(0, 10);
  const overdue  = topics.filter(t => t.nextRepeat && t.nextRepeat < today).length;
  const dueToday = topics.filter(t => t.nextRepeat === today).length;

  if (overdue === 0 && dueToday === 0) return;

  const parts = [];
  if (dueToday > 0) parts.push(`${dueToday} review${dueToday > 1 ? 's' : ''} due today`);
  if (overdue  > 0) parts.push(`${overdue} overdue`);

  return self.registration.showNotification('FocusTrack — Review Time', {
    body:     parts.join(' · '),
    icon:     '/icons/android-chrome-192x192.png',
    badge:    '/icons/favicon-32x32.png',
    tag:      'ft-review-reminder',
    renotify: false,
    data:     { url: '/?view=tr' },
  });
}

// Read topics from FocusTrackDB via raw IndexedDB (Dexie is not available in SW scope).
function _readTopics() {
  return new Promise(resolve => {
    const open = indexedDB.open('FocusTrackDB');
    open.onerror = () => resolve([]);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('kv')) { db.close(); resolve([]); return; }
      const tx  = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('spacedRepetitionData');
      req.onsuccess = () => { db.close(); resolve(req.result?.value ?? []); };
      req.onerror   = () => { db.close(); resolve([]); };
    };
  });
}
