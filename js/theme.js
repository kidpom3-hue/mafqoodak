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
