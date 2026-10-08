// Service Worker: يحفظ ملفات التطبيق ليفتح بسرعة ويعمل عند ضعف الاتصال.
// الاستراتيجية: الشبكة أولاً (لتظهر تعديلاتك فوراً)، ثم النسخة المحفوظة إذا انقطع الاتصال.
// عند تغيير أسماء الملفات غيّر رقم الإصدار هنا.
const CACHE = 'mafqoodak-v44';   // = APP_VERSION في js/config.js (ارفعهما معاً في كل PR)
// ملفات التطبيق نفسه فقط: ملفات Firebase من gstatic (ومنها firebase-app-check.js) لا يتعامل معها هذا العامل (مصدر آخر)
// H8: تبقى هنا كل الملفات، ومنها ما يُحمَّل عند الحاجة فقط (lazy.js)، ليعمل التطبيق كاملاً دون اتصال بعد أول زيارة
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/main.js', './js/config.js', './js/firebase.js', './js/state.js', './js/ui.js', './js/actions.js',
  './js/constants.js', './js/utils.js', './js/ai.js', './js/sample-data.js', './js/migrate.js', './js/workflow.js',
  './js/i18n.js', './js/i18n/ar.js', './js/i18n/en.js', './js/qr.js', './js/stats.js', './js/notify.js', './js/theme.js', './js/lazy.js',
  './js/views/print.js', './js/views/stats.js', './js/views/audit.js', './js/views/gov.js',
  './js/views/common.js', './js/views/home.js', './js/views/visitor.js', './js/views/staff.js', './js/views/admin.js', './js/views/auth.js', './js/views/privacy.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  // H15: شعار المؤسسة لمكتب الكلية (ملوّن وأبيض، والنجمة وحدها للترويسة)
  './icons/college/tvtc-logo.png', './icons/college/tvtc-logo-white.png', './icons/college/tvtc-mark.png', './icons/college/tvtc-mark-white.png',
];

self.addEventListener('install', e => {
  // cache: 'reload': تُجلب ملفات النسخة الجديدة من الخادم مباشرة، لا من ذاكرة HTTP القديمة
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // H21: الصور (الأيقونات والشعار) من النسخة المحفوظة أولاً؛ تتجدد مع رقم الإصدار. كان طلبها من الشبكة يُخفي الشعار عند كل تنقل
  if (req.destination === 'image'){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // H6: cache: 'no-cache' يجبر المتصفح على سؤال الخادم (GitHub Pages) عن كل ملف بدل نسخته المخزّنة في ذاكرة HTTP،
  // فلا تظهر نسخة قديمة بعد التحديث. طلب فتح الصفحة (navigate) لا يقبل خيارات إضافية، فنبني له طلباً جديداً بعنوانه
  const fresh = req.mode === 'navigate' ? new Request(req.url, {cache: 'no-cache'}) : new Request(req, {cache: 'no-cache'});
  e.respondWith(
    fetch(fresh).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
// الضغط على إشعار المتصفح: نفتح التطبيق (أو نعود إليه إن كان مفتوحاً)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const c = list.find(x => 'focus' in x);
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
