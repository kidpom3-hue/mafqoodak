// نقطة البداية: تربط الواجهة بالبيانات وتبدأ التطبيق
import { start, onChange, onReset } from './state.js';
import { renderAll, refresh } from './ui.js';
import { bindEvents } from './actions.js';

bindEvents();
onChange(refresh);   // تحديث جزئي عند وصول بيانات جديدة
onReset(renderAll);  // إعادة رسم كاملة (تسجيل دخول/خروج، تغيير المكان)
renderAll();
start();

// تثبيت التطبيق على الجوال والعمل دون اتصال (PWA)
if ('serviceWorker' in navigator && location.protocol === 'https:'){
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('sw', e));
}
