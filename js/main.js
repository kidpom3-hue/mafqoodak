// نقطة البداية: تربط الواجهة بالبيانات وتبدأ التطبيق
// G6: التطبيق يدير مكان التمرير بنفسه عند الرجوع (ui.js)، فلا يتدخّل المتصفح ويعيده مكاناً آخر
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
import { S, start, onChange, onReset, setOffice, SHARE_RE, OFFICE_RE } from './state.js';
import { renderAll, refresh, go } from './ui.js';
import { bindEvents } from './actions.js';
import { checkNotify } from './notify.js';
import { toast } from './utils.js';
import { t } from './i18n.js';
import './theme.js';   // يطبّق المظهر المحفوظ (فاتح/داكن/تلقائي)

// H7: منع التأطير (clickjacking): لا يُرسم التطبيق إذا فُتح داخل إطار في موقع آخر (frame-ancestors لا تعمل في meta)
const FRAMED = (() => { try { return window.top !== window.self; } catch { return true; } })();
if (FRAMED){ document.body.innerHTML = ''; throw new Error('framed'); }
// H7: الخطوط من Google Fonts بلا onload مضمّن في index.html (CSP): نضيفها هنا كملف تنسيق عادي
(() => { const pre = document.querySelector('link[rel=preload][as=style][href*="fonts.googleapis.com"]');
  if (pre){ const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = pre.href; document.head.appendChild(l); } })();

// إزالة اختصار الصفحة من الرابط بعد قراءته حتى لا يتكرر عند التحديث
if (location.hash) history.replaceState(null, '', location.pathname + location.search);

// رابط مشاركة غرض يُفتح والتطبيق مفتوح (مثل لصقه في شريط العنوان)
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1), m = SHARE_RE.exec(h), o = OFFICE_RE.exec(h);
  if (!m && !o) return;
  history.replaceState(history.state, '', location.pathname + location.search);
  if (o){ setOffice(o[1]); return; }   // رابط مكتب: مفقودات ذلك المكتب
  if (m[1] !== S.officeId) setOffice(m[1]);
  go('item', {id: m[2]});
});

bindEvents();
onChange(() => { refresh(); checkNotify(); });   // تحديث جزئي عند وصول بيانات جديدة، وإشعار المتصفح إن كان التطبيق في الخلفية
onReset(renderAll);  // إعادة رسم كاملة (تسجيل دخول/خروج، تغيير المكان)
renderAll();
start();
// بعد تسجيل الخروج وإعادة تحميل الصفحة (actions.js ← signOut)
try { if (sessionStorage.getItem('mfq:signedOut')){ sessionStorage.removeItem('mfq:signedOut'); setTimeout(() => toast(t('a.signedOut')), 400); } } catch {}

// تثبيت التطبيق على الجوال والعمل دون اتصال (PWA)
// H6: عند وصول Service Worker جديد (نسخة أحدث من التطبيق) يظهر شريط «تحديث جديد متاح» مع زر «تحديث» يعيد تحميل الصفحة.
// نبحث عن تحديث أيضاً كلما عاد المستخدم إلى التطبيق (visibilitychange)، فلا يبقى على نسخة قديمة أياماً
if ('serviceWorker' in navigator && location.protocol === 'https:'){
  const hadController = !!navigator.serviceWorker.controller;   // أول تثبيت ليس «تحديثاً»
  navigator.serviceWorker.register('./sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(e => console.warn('sw', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdate(); });
}
function showUpdate(){
  if (document.getElementById('upd')) return;
  const bar = document.createElement('div');
  bar.id = 'upd'; bar.className = 'undo-bar show'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
  bar.innerHTML = `<span>${t('upd.ready')}</span><button type="button" class="btn sm soft">${t('upd.btn')}</button>`;
  bar.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(bar);
}
