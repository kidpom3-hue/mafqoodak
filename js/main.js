// نقطة البداية: تربط الواجهة بالبيانات وتبدأ التطبيق
import { S, start, onChange, onReset, setOffice, SHARE_RE, OFFICE_RE } from './state.js';
import { renderAll, refresh, go } from './ui.js';
import { bindEvents } from './actions.js';
import { checkNotify } from './notify.js';
import './theme.js';   // يطبّق المظهر المحفوظ (فاتح/داكن/تلقائي)

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

// تثبيت التطبيق على الجوال والعمل دون اتصال (PWA)
if ('serviceWorker' in navigator && location.protocol === 'https:'){
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('sw', e));
}
