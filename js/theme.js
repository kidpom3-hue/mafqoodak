// المظهر: تلقائي (حسب إعداد الجهاز) أو فاتح أو داكن. يُحفظ على هذا الجهاز فقط (mfq:theme)،
// ويُطبَّق قبل رسم الصفحة بسكربت صغير في index.html حتى لا يومض المظهر الآخر.
import { LS } from './utils.js';

export const THEMES = ['auto', 'light', 'dark'];
export const theme = () => { const v = LS.get('theme', 'auto'); return THEMES.includes(v) ? v : 'auto'; };
export function applyTheme(v = theme()){
  const h = document.documentElement;
  if (v === 'light' || v === 'dark') h.dataset.theme = v; else delete h.dataset.theme;
}
export function setTheme(v){
  if (!THEMES.includes(v)) return;
  if (v === 'auto') { try { localStorage.removeItem('mfq:theme'); } catch {} } else LS.set('theme', v);
  applyTheme(v);
}
applyTheme();

/* حجم الخط (المرحلة F، إمكانية الوصول): عادي / كبير / أكبر. يُحفظ في mfq:text، ويُطبَّق كسمة data-text على html
   قبل أول رسم (السكربت الصغير في index.html)، والتكبير نفسه بـ CSS zoom على body (css/styles.css) */
export const TEXTS = ['m', 'l', 'xl'];
export const textSize = () => { const v = LS.get('text', 'm'); return TEXTS.includes(v) ? v : 'm'; };
export function applyText(v = textSize()){
  const h = document.documentElement;
  if (v === 'm') delete h.dataset.text; else h.dataset.text = v;
}
export function setTextSize(v){
  if (!TEXTS.includes(v)) return;
  if (v === 'm') { try { localStorage.removeItem('mfq:text'); } catch {} } else LS.set('text', v);
  applyText(v);
}
applyText();
