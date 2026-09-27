// اللغة: العربية (الأساس) والإنجليزية.
// t('key', {var}) يرجع النص باللغة الحالية، وtp('key', n) يختار صيغة العدد حسب Intl.PluralRules.
// كل نص يراه المستخدم مكانه القاموسان js/i18n/ar.js وjs/i18n/en.js (tools/check-i18n.mjs يفحص ذلك).
import { AR } from './i18n/ar.js';
import { EN } from './i18n/en.js';

const DICTS = {ar: AR, en: EN};
const KEY = 'mfq:lang';
// الافتراضي: الاختيار المحفوظ، ثم لغة المتصفح (عربي إذا بدأت بـ ar، وإلا إنجليزي)
function initial(){
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v === 'ar' || v === 'en') return v; } catch {}
  return String(navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
export let LANG = initial();
export const isEn = () => LANG === 'en';
export const saved = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };

// {name} في النص يُستبدل بالقيمة (القيم تُمرَّر بعد esc عند الحاجة)
const fill = (s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m)) : s;
export function t(key, vars){
  const s = DICTS[LANG][key] ?? AR[key];
  if (s === undefined){ console.warn('[i18n] missing', key); return key; }
  return fill(s, vars);
}
// هل للمفتاح نص؟ (لتسميات اختيارية مثل df.<cat>.<k>)
export const hasKey = key => key in DICTS[LANG] || key in AR;
// نص بلغة محددة (مثل رسالة بريد بلغة المستلم، لا بلغة الموظف)
export const tIn = (lang, key, vars) => fill((DICTS[lang] || AR)[key] ?? AR[key] ?? key, vars);
// النص العربي دائماً: للقيم المخزّنة في قاعدة البيانات (ملاحظات النظام في الطلبات والسجل)
export const tAr = (key, vars) => fill(AR[key] ?? key, vars);

const PR = {};
const rules = () => { try { return PR[LANG] || (PR[LANG] = new Intl.PluralRules(LANG)); } catch { return {select: n => n === 1 ? 'one' : 'other'}; } };
// tp('n.item', 5) ← «5 أغراض» / «5 items»
export function tp(key, n, vars){
  const f = DICTS[LANG][key] ?? AR[key];
  if (!f){ console.warn('[i18n] missing', key); return String(n); }
  return fill(f[rules().select(n)] ?? f.other, {n, ...vars});
}

// ملاحظة نظام مخزّنة بالعربية ← نصها باللغة الحالية (ملاحظات الموظف الحرة تبقى كما هي)
export function noteText(s){
  if (!s || LANG === 'ar') return s || '';
  const k = Object.keys(AR).find(k => k.startsWith('sys.') && AR[k] === s);
  return k ? t(k) : s;
}

export const locale = () => LANG === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
// الاتجاه ولغة الصفحة وعنوانها
export function applyLang(){
  const h = document.documentElement;
  h.lang = LANG; h.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = t('app.title');
}
export function setLang(l){
  if (l !== 'ar' && l !== 'en') return;
  LANG = l;
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {}
  applyLang();
}
applyLang();
