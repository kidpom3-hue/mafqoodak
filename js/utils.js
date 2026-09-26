// أدوات مساعدة عامة: التواريخ، البحث العربي، المطابقة، الصور
import { color, colorName, catName } from './constants.js';

/* ---------- helpers ---------- */
export const $ = (s, r=document) => r.querySelector(s);
export const $$ = (s, r=document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const LS = {
  get(k, d){ try { const v = localStorage.getItem('mfq:'+k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('mfq:'+k, JSON.stringify(v)); } catch {} },
};
export const pad = n => String(n).padStart(2,'0');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
export const dayNum = s => { if (!s) return NaN; const [y,m,d] = s.split('-').map(Number); return Date.UTC(y, m-1, d) / 864e5; };
export const daysAgo = s => dayNum(today()) - dayNum(s);
export let DF; try { DF = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {day:'numeric', month:'long'}); } catch { DF = new Intl.DateTimeFormat('ar', {day:'numeric', month:'long'}); }
export const fmtDate = s => { if (!s) return ''; const [y,m,d] = s.split('-').map(Number); return DF.format(new Date(y, m-1, d)); };
export const daysWord = n => n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يوماً`;
export function relDay(s){
  const d = daysAgo(s);
  if (isNaN(d)) return '';
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  if (d === 2) return 'قبل يومين';
  if (d < 14) return `قبل ${daysWord(d)}`;
  return fmtDate(s);
}
export function relTime(ms){
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 6e4);
  if (m < 1) return 'الآن';
  if (m < 60) return m <= 2 ? 'قبل دقيقة' : m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`;
  const d = new Date(ms);
  return relDay(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`);
}
export const pill = (map, s) => map[s] ? `<span class="pill ${map[s].c}">${map[s].l}</span>` : '';
export const colorDot = id => { const c = color(id); return c ? `<span class="dot" style="background:${c.hex}"></span>` : ''; };

/* Arabic-aware text normalisation for search + matching */
export const STOP = new Set(['في','من','على','عن','مع','الى','او','و','لون','فيه','فيها','به','بها','هذا','هذه','لي','كان','تم','عند','قرب','جنب','داخل']);
export function norm(s){
  return String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function tokens(s){
  return norm(s).split(' ').map(t => {
    if (t.length > 4 && (t.startsWith('وال') || t.startsWith('بال'))) t = t.slice(3);
    else if (t.length > 3 && t.startsWith('ال')) t = t.slice(2);
    return t;
  }).filter(t => t.length > 1 && !STOP.has(t));
}
/* ---------- الأماكن داخل المباني ---------- */
// الأماكن التي تقع داخل مبنى (قاعات، معامل، ورش، المبنى الإداري) نطلب لها رقم المبنى ورقم القاعة
export const isBuilding = s => /قاع|معمل|معامل|ورش|مبنى|مباني/.test(s || '');
// الكلمة المناسبة لرقم الغرفة حسب نوع المكان
export const roomWord = s => /معمل|معامل/.test(s || '') ? 'المعمل' : /ورش/.test(s || '') ? 'الورشة' : /قاع/.test(s || '') ? 'القاعة' : /إدار/.test(s || '') ? 'المكتب' : 'الغرفة';
// نص المكان كاملاً، مثل: «معامل الحاسب · مبنى 3 · معمل 105» (بدون escape؛ استخدم esc عند العرض)
export const spotText = x => !x?.spot ? '' : x.spot + (x.bldg ? ' · مبنى ' + x.bldg : '') + (x.room ? ' · ' + roomWord(x.spot).replace(/^ال/, '') + ' ' + x.room : '');

export const itemText = i => [i.title, i.desc, i.sub, catName(i.cat), colorName(i.color), color(i.color)?.alt, i.spot, i.bldg, i.room, i.ref].join(' ');
export function textScore(q, i){
  const t = tokens(itemText(i)); let s = 0;
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
  if (r.sub && it.sub === r.sub) s += 12;
  if (r.color && it.color === r.color) s += 15;
  const a = new Set(tokens(`${r.title} ${r.desc}`)), b = new Set(tokens(`${it.title} ${it.desc} ${it.sub || ''}`));
  let inter = 0; a.forEach(t => { if (b.has(t)) inter++; });
  if (a.size && b.size) s += Math.round(28 * inter / Math.min(a.size, b.size));
  if (r.lostDate && it.foundDate){ const d = dayNum(it.foundDate) - dayNum(r.lostDate); if (d < -1) s -= 30; else if (d <= 7) s += 6; }
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
export function makeRef(office){
  const A = 'ACDEFHJKMNPRTUVWXY34679'; const r = crypto.getRandomValues(new Uint8Array(4));
  return `${(office?.code || 'MFQ').toUpperCase()}-${[...r].map(x => A[x % A.length]).join('')}`;
}
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


let toastTimer;
export function toast(msg){
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}
