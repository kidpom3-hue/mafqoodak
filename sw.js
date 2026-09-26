// Service Worker: يحفظ ملفات التطبيق ليفتح بسرعة ويعمل عند ضعف الاتصال.
// الاستراتيجية: الشبكة أولاً (لتظهر تعديلاتك فوراً)، ثم النسخة المحفوظة إذا انقطع الاتصال.
// عند تغيير أسماء الملفات غيّر رقم الإصدار هنا.
const CACHE = 'mafqoodak-v4';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/main.js', './js/config.js', './js/firebase.js', './js/state.js', './js/ui.js', './js/actions.js',
  './js/constants.js', './js/utils.js', './js/ai.js', './js/sample-data.js',
  './js/views/common.js', './js/views/home.js', './js/views/visitor.js', './js/views/staff.js', './js/views/admin.js', './js/views/auth.js', './js/views/privacy.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
