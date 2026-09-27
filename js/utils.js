// أدوات مساعدة عامة: التواريخ، البحث العربي، المطابقة، الصور
import { color, colorName, cat, catName, subName, subLabel, searchWords, statusLabel, isBuilding, roomKind, norm, tokens, STOP, latinDigits } from './constants.js';
import { t, tp, locale, isEn } from './i18n.js';
// كانت هنا سابقاً؛ نعيد تصديرها حتى لا تتغيّر أماكن الاستيراد
export { isBuilding, norm, tokens, STOP };
// G1: latinDigits (٠-٩ و۰-۹ إلى 0-9): قبل أي مقارنة أو بحث أو حفظ رقم. مكانها constants.js لأن norm تستخدمها
export { latinDigits };

/* ---------- helpers ---------- */
export const $ = (s, r=document) => r.querySelector(s);
export const $$ = (s, r=document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const LS = {
  get(k, d){ try { const v = localStorage.getItem('mfq:'+k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('mfq:'+k, JSON.stringify(v)); } catch {} },
};
export const pad = n => String(n).padStart(2,'0');

/* ---------- الوقت: بتوقيت الرياض دائماً (G2) ---------- */
// كل عرض للوقت وكل حساب لليوم بتوقيت الرياض مهما كانت منطقة الجهاز، والقيم المخزّنة (مللي ثانية) لا تتغيّر
export const TZ = 'Asia/Riyadh';
// ينشئ منسّق Intl ويحفظه؛ إن لم يدعم المتصفح اللغة أو المنطقة الزمنية يرجع إلى أبسط منسّق
const FMT = {};
function fmt(key, o){
  const k = locale() + '|' + key;
  if (FMT[k]) return FMT[k];
  const tries = [[locale(), {...o, timeZone: TZ}], [isEn() ? 'en' : 'ar', {...o, timeZone: TZ}], [isEn() ? 'en' : 'ar', o]];
  for (const [l, x] of tries){ try { return FMT[k] = new Intl.DateTimeFormat(l, x); } catch {} }
}
// يوم بصيغة YYYY-MM-DD بتوقيت الرياض من وقت بالمللي ثانية (للتصدير والمقارنة)
let isoF;
export const isoDay = ms => {
  if (!ms) return '';
  try {
    isoF = isoF || new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'});
    const p = Object.fromEntries(isoF.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    // الرياض UTC+3 بلا توقيت صيفي
    const d = new Date(ms + 3 * 36e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
};
export const today = () => isoDay(Date.now());
export const dayNum = s => { if (!s) return NaN; const [y,m,d] = s.split('-').map(Number); return Date.UTC(y, m-1, d) / 864e5; };
export const daysAgo = s => dayNum(today()) - dayNum(s);
// تاريخ مخزّن كنص (YYYY-MM-DD): نأخذ ظهر ذلك اليوم بتوقيت غرينتش، فيبقى اليوم نفسه في الرياض
const noon = s => { const [y,m,d] = s.split('-').map(Number); return new Date(Date.UTC(y, m-1, d, 12)); };
// التاريخ حسب اللغة: ar-SA أو en-GB، بالتقويم الميلادي والأرقام اللاتينية في اللغتين
export const fmtDate = s => s ? fmt('d', {day: 'numeric', month: 'long'}).format(noon(s)) : '';
// التاريخ والوقت (سجل الحيازة): «27 سبتمبر 2026، 10:30 ص» / «27 Sept 2026, 10:30»
export const fmtDateTime = ms => ms ? fmt('dt', {day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(ms)) : '';
// G2: الوقت الدقيق الموحّد: «الأحد 27 سبتمبر · 9:31 م»، والسنة فقط إن لم تكن الحالية،
// وخلال آخر 24 ساعة: «قبل 5 دقائق · 9:31 م». الإنجليزية بالمنطق نفسه
export function when(ms){
  if (!ms) return '';
  // الساعة لا تنقسم على سطرين: «· 9:31 م» بمسافات غير قابلة للكسر (السطر ينكسر قبل «·» فقط عند الحاجة)
  const d = new Date(ms), clock = ' ·\u00A0' + fmt('hm', {hour: 'numeric', minute: '2-digit', hour12: true}).format(d).replace(/\s/g, '\u00A0');
  const m = Math.floor((Date.now() - ms) / 6e4);
  if (m >= 0 && m < 24 * 60){
    const rel = m < 1 ? t('time.now') : m < 60 ? tp('time.minAgo', m) : tp('time.hourAgo', Math.floor(m / 60));
    return rel + clock;
  }
  const sameYear = isoDay(ms).slice(0, 4) === today().slice(0, 4);
  const day = fmt(sameYear ? 'dm' : 'dmy', sameYear ? {day: 'numeric', month: 'long'} : {day: 'numeric', month: 'long', year: 'numeric'}).format(d);
  return fmt('wd', {weekday: 'long'}).format(d) + ' ' + day + clock;
}
// المدة بالأيام: nom للرفع («متبقٍّ يومان»)، وبدونه للجر والنصب («قبل يومين»، «مدة الحفظ 90 يوماً»)
export const daysWord = (n, nom = false) => tp(nom ? 'n.daysNom' : 'n.days', n);
export function relDay(s){
  const d = daysAgo(s);
  if (isNaN(d)) return '';
  if (d <= 0) return t('time.today');
  if (d === 1) return t('time.yesterday');
  if (d < 14) return tp('time.daysAgo', d);
  return fmtDate(s);
}
export function relTime(ms){
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 6e4);
  if (m < 1) return t('time.now');
  if (m < 60) return tp('time.minAgo', m);
  const h = Math.round(m / 60);
  if (h < 24) return tp('time.hourAgo', h);
  return relDay(isoDay(ms));
}
export const pill = (map, s) => map[s] ? `<span class="pill ${map[s].c}">${statusLabel(map[s])}</span>` : '';
export const colorDot = id => { const c = color(id); return c ? `<span class="dot" style="background:${c.hex}"></span>` : ''; };

/* ---------- المكان ---------- */
// اسم المكان للعرض (بالإنجليزية من spotsEn في المكتب إن وُجد). تضبطه state.js بعد تحميل المكاتب
let spotHook = s => s;
export const setSpotHook = f => { spotHook = f; };
// عنوان خانة رقم الغرفة: «رقم المعمل» / «Lab number»
export const roomWord = s => t('room.label.' + roomKind(s));
// نص المكان كاملاً، مثل: «معامل الحاسب · مبنى 3 · معمل 105» (بدون escape؛ استخدم esc عند العرض)
export const spotText = x => !x?.spot ? '' : spotHook(x.spot, x.officeId)
  + (x.bldg ? ' · ' + t('place.bldg', {n: x.bldg}) : '') + (x.room ? ' · ' + t('room.' + roomKind(x.spot), {n: x.room}) : '');
export const spotName = (s, officeId) => s ? spotHook(s, officeId) : '';

// الاسم العام للغرض في الإعلان: اسم النوع إن وُجد، وإلا اسم التصنيف (الاسم التفصيلي سري للموظفين)
// يُخزَّن بالعربية دائماً (قيمة في قاعدة البيانات)، ويُترجم عند العرض عبر showTitle
// النقود: «مبلغ مالي» دائماً (publicName)، فلا يظهر للعامة نوعها ولا مبلغها
export const publicTitle = (catId, sub) => cat(catId).publicName || subName(sub) || cat(catId).name;
// النوع بصيغة للمقارنة: الاسم الحالي حتى لو خُزّن بالاسم القديم
export const subKey = s => subName(s);
// العنوان العام للعرض (الأغراض القديمة خُزّن عنوانها باسم النوع القديم)
// وبالإنجليزية: اسم النوع أو التصنيف المقابل
export const showTitle = i => { const v = subName(i?.title); if (!isEn() || !v) return v; const c = cat(i.cat); return v === c.publicName ? c.publicEn : v === c.name ? catName(i.cat) : subLabel(v); };

// نص البحث: أسماء التصنيف والنوع واللون باللغتين، فكلمة إنجليزية (wallet، keys) تجد الأغراض العربية
// withPlace=false للزائر: مكان العثور سري (المرحلة E5)، فلا يُبحث به في الإعلان العام (ولو بقي في غرض قديم لم يُنقل بعد)
export const itemText = (i, withPlace = true) => [subName(i.title), i.desc, i.sub, searchWords(i.cat, i.sub, i.color), i.brand,
  withPlace ? i.spot : '', withPlace ? spotName(i.spot, i.officeId) : '', i.bldg, i.room, i.ref].join(' ');
export function textScore(q, i, withPlace = true){
  const t = tokens(itemText(i, withPlace)); let s = 0;
  for (const w of q){
    if (t.includes(w)) s += 3;
    else if (t.some(x => (x.length > 2 && w.startsWith(x)) || (w.length > 2 && x.startsWith(w)))) s += 1;
  }
  return s;
}
/* heuristic match between a lost report and a found item, 0-100 */
export function matchScore(r, it){
  let s = 0;
  if (r.cat && it.cat === r.cat) s += 40; else if (r.cat && r.cat !== 'other' && it.cat !== 'other') s -= 15;
  if (r.sub && subKey(it.sub) === subKey(r.sub)) s += 12;
  if (r.color && it.color === r.color) s += 15;
  const a = new Set(tokens(`${r.title} ${r.desc}`)), b = new Set(tokens(`${it.title} ${it.desc} ${it.sub || ''}`));
  let inter = 0; a.forEach(t => { if (b.has(t)) inter++; });
  if (a.size && b.size) s += Math.round(28 * inter / Math.min(a.size, b.size));
  if (r.lostDate && it.foundDate){ const d = dayNum(it.foundDate) - dayNum(r.lostDate); if (d < -1) s -= 30; else if (d <= 7) s += 6; }
  // إجابة رقمية متطابقة تماماً بين البلاغ والتفاصيل السرية (المبلغ، عدد المفاتيح، آخر 4 أرقام): للموظف فقط،
  // لأن الزائر يقارن بالبيانات العامة التي لا details فيها
  for (const k of ['amount', 'keyCount', 'docLast4']) if (r.details?.[k] && r.details[k] === it.details?.[k]){ s += 15; break; }
  if (r.spot && it.spot && r.spot === it.spot){
    s += 6;
    if (r.bldg && r.bldg === it.bldg) s += 4;   // نفس المبنى يرفع احتمال التطابق
  }
  return Math.max(0, Math.min(100, s));
}
export async function sha(s){
  if (globalThis.crypto?.subtle){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }
  return sha256Fallback(s);   // عند فتح التطبيق عبر http (مثل عنوان الشبكة المحلية) لا تتوفر crypto.subtle
}
function sha256Fallback(str){
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = [...new TextEncoder().encode(str)]; const bitLen = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const r = (x, n) => (x >>> n) | (x << (32 - n)); const w = new Array(64);
  for (let o = 0; o < bytes.length; o += 64){
    for (let i = 0; i < 16; i++) w[i] = (bytes[o+i*4] << 24) | (bytes[o+i*4+1] << 16) | (bytes[o+i*4+2] << 8) | bytes[o+i*4+3];
    for (let i = 16; i < 64; i++){ const s0 = r(w[i-15],7) ^ r(w[i-15],18) ^ (w[i-15] >>> 3), s1 = r(w[i-2],17) ^ r(w[i-2],19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0; }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let i = 0; i < 64; i++){
      const t1 = (hh + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h = h.map((v, i) => (v + [a,b,c,d,e,f,g,hh][i]) | 0);
  }
  return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
export const genCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
// حروف رقم القيد والأكواد القصيرة: بلا أحرف متشابهة (O/0، I/1، B/8...)
const REF_CHARS = 'ACDEFHJKMNPRTUVWXY34679';
export const refCode = (n = 4) => [...crypto.getRandomValues(new Uint8Array(n))].map(x => REF_CHARS[x % REF_CHARS.length]).join('');
export function makeRef(office){
  return `${(office?.code || 'MFQ').toUpperCase()}-${refCode(4)}`;
}
// كود إشعار التسليم كما يكتبه الموظف: أحرف كبيرة وأرقام فقط
export const normCode = s => latinDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
// اسم طريقة التصرّف في الغرض (القيمة المخزّنة ← نص بلغة الواجهة)
export const disposalLabel = d => t('disposal.' + (['donated', 'destroyed', 'authority', 'finder'].includes(d) ? d : 'other'));
export function dataUrlToBlob(u){
  const [h, b] = u.split(','); const mime = (h.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(b); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], {type: mime});
}
export async function compress(file, max=900){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    let w = img.naturalWidth, h = img.naturalHeight; const k = Math.min(1, max / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    let q = .74, dataUrl = c.toDataURL('image/jpeg', q);
    while (dataUrl.length > 190000 && q > .35){ q -= .12; dataUrl = c.toDataURL('image/jpeg', q); }
    return {dataUrl, blob: dataUrlToBlob(dataUrl)};
  } finally { URL.revokeObjectURL(url); }
}

// نسخة مموّهة حقيقية للصورة: نصغّرها إلى 24px عرضاً فتضيع تفاصيلها من الملف نفسه (وليس بـ CSS فقط)
export async function makeBlur(dataUrl){
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
  const w = 24, h = Math.max(1, Math.round(24 * (img.naturalHeight || 1) / (img.naturalWidth || 1)));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', .6);
}

let toastTimer;
// الرسالة المنبثقة في منطقة aria-live="polite" ثابتة في الصفحة (لا hidden)، فيقرؤها قارئ الشاشة عند تغيّر نصها
export function toast(msg){
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('show'); t.textContent = ''; }, 2800);
}
