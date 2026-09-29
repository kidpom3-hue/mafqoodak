// H8: تحميل كسول للملفات الثقيلة التي لا يحتاجها الزائر (لوحة الموظف، الإدارة، الإحصاءات، الطباعة، الخدمات، QR، الذكاء الاصطناعي…).
// تُحمَّل عند أول فتح لصفحة تحتاجها فقط، ثم تبقى في الذاكرة. وملف sw.js يحفظها كلها (SHELL) فتعمل دون اتصال بعد أول زيارة.
// need(name): يرجع الوحدة إن كانت محمّلة، وإلا يبدأ تحميلها ويرجع null (والصفحة تعرض مؤشر تحميل ثم تُرسم من جديد عند وصولها).
// load(name): وعد (Promise) بالوحدة، للأزرار والإجراءات.
const LOADERS = {
  staff: () => import('./views/staff.js'),
  admin: () => import('./views/admin.js'),
  statsView: () => import('./views/stats.js'),
  stats: () => import('./stats.js'),
  audit: () => import('./views/audit.js'),
  print: () => import('./views/print.js'),
  gov: () => import('./views/gov.js'),
  qr: () => import('./qr.js'),
  ai: () => import('./ai.js'),
  sample: () => import('./sample-data.js'),
};
const MOD = {}, PENDING = {};
let onLoaded = () => {}, onFail = () => {};
// ui.js يضبطهما: إعادة الرسم بعد التحميل، ورسالة عند الفشل (مثل انقطاع الاتصال قبل حفظ الملف)
export const setLazyHooks = (loaded, fail) => { onLoaded = loaded; onFail = fail; };
export const mod = name => MOD[name];
export function load(name){
  if (MOD[name]) return Promise.resolve(MOD[name]);
  return PENDING[name] ||= LOADERS[name]()
    .then(m => { MOD[name] = m; return m; })
    .finally(() => { delete PENDING[name]; });
}
export function need(name){
  if (MOD[name]) return MOD[name];
  if (!PENDING[name]) load(name).then(() => onLoaded(name), e => { console.warn('[lazy]', name, e); onFail(name); });
  return null;
}
// مؤشر التحميل الصغير أثناء الانتظار
export const loadingHtml = () => `<div class="loading" aria-busy="true"><span class="spin"></span></div>`;
