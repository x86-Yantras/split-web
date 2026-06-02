const CACHE = 'splitsplit-shell-v2';
const SHELL = [
  '/SplitSplit.html', '/manifest.webmanifest',
  '/src/currency.js', '/src/data.js', '/src/auth.js',
  '/src/domain.js', '/src/sheets.js', '/src/store.js',
  '/src/ui.jsx', '/src/ios-frame.jsx', '/src/tweaks-panel.jsx', '/src/app.jsx',
  '/src/screens/SignIn.jsx', '/src/screens/Home.jsx', '/src/screens/Group.jsx',
  '/src/screens/AddExpense.jsx', '/src/screens/Friends.jsx', '/src/screens/Friend.jsx',
  '/src/screens/Settle.jsx', '/src/screens/Activity.jsx', '/src/screens/Profile.jsx',
  '/src/screens/Invite.jsx', '/src/screens/Join.jsx', '/src/screens/Expense.jsx',
  '/src/screens/Empty.jsx',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never touch Google APIs/CDN
  if (e.request.method !== 'GET') return;
  // Network-first: always serve the latest code when online (so edits aren't masked),
  // fall back to the cached shell only when offline. Cache-first masked every code edit.
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
