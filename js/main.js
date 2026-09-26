// نقطة البداية: تربط الواجهة بالبيانات وتبدأ التطبيق
import { S, start, onChange, onReset, setOffice, SHARE_RE } from './state.js';
import { renderAll, refresh, go } from './ui.js';
import { bindEvents } from './actions.js';

// إزالة اختصار الصفحة من الرابط بعد قراءته حتى لا يتكرر عند التحديث
if (location.hash) history.replaceState(null, '', location.pathname + location.search);

// رابط مشاركة غرض يُفتح والتطبيق مفتوح (مثل لصقه في شريط العنوان)
window.addEventListener('hashchange', () => {
  const m = SHARE_RE.exec(location.hash.slice(1)); if (!m) return;
  history.replaceState(history.state, '', location.pathname + location.search);
  if (m[1] !== S.officeId) setOffice(m[1]);
  go('item', {id: m[2]});
});

bindEvents();
onChange(refresh);   // تحديث جزئي عند وصول بيانات جديدة
onReset(renderAll);  // إعادة رسم كاملة (تسجيل دخول/خروج، تغيير المكان)
renderAll();
start();

// تثبيت التطبيق على الجوال والعمل دون اتصال (PWA)
if ('serviceWorker' in navigator && location.protocol === 'https:'){
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('sw', e));
}
