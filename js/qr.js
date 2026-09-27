// مولّد رمز QR صغير مكتوب داخل التطبيق (بلا مكتبة خارجية، فيعمل دون اتصال).
// يدعم الوضع البايتي (نص UTF-8 مثل الروابط)، ومستوى تصحيح الأخطاء M (يتحمّل تلف نحو 15% من الرمز)،
// والإصدارات 1 إلى 10 (حتى 213 بايتاً، وروابط المفقودات نحو 80 بايتاً).
// الخطوات حسب مواصفة ISO/IEC 18004: ترميز البيانات ← رموز تصحيح Reed-Solomon ← رسم الأنماط ← اختيار أفضل قناع.

// لكل إصدار (1..10) عند المستوى M: عدد رموز التصحيح في كل كتلة، وعدد الكتل
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

// عدد الخانات المتاحة للبيانات والتصحيح بعد الأنماط الثابتة
function rawModules(ver){
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2){ const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
  return r;
}
const dataCodewords = ver => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

/* ---------- حساب Reed-Solomon في الحقل GF(256) ---------- */
function gfMul(x, y){
  let z = 0;
  for (let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z;
}
function rsDivisor(degree){
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++){
    for (let j = 0; j < r.length; j++){ r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data, div){
  const r = div.map(() => 0);
  for (const b of data){
    const f = b ^ r.shift(); r.push(0);
    div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

/* ---------- ترميز البيانات ---------- */
function encodeData(bytes, ver){
  const bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4);                                  // الوضع البايتي 0100
  put(bytes.length, ver <= 9 ? 8 : 16);       // عدد البايتات
  bytes.forEach(b => put(b, 8));
  const cap = dataCodewords(ver) * 8;
  put(0, Math.min(4, cap - bits.length));     // علامة النهاية
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);   // حشو 0xEC و0x11 بالتناوب
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  return out;
}
// تقسيم البيانات إلى كتل، وإضافة رموز التصحيح لكل كتلة، ثم التشبيك بينها
function withEcc(data, ver){
  const nb = NUM_BLOCKS[ver], ecLen = ECC_PER_BLOCK[ver], raw = Math.floor(rawModules(ver) / 8);
  const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(ecLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++){
    const d = data.slice(k, k + shortLen - ecLen + (i < nShort ? 0 : 1)); k += d.length;
    const ecc = rsRemainder(d, div);
    if (i < nShort) d.push(0);                // مكان فارغ يُتجاوز عند التشبيك
    blocks.push(d.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecLen || j >= nShort) out.push(b[i]); });
  return out;
}

/* ---------- رسم المصفوفة ---------- */
function alignPositions(ver){
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
  return r;
}
function build(ver, codewords, mask){
  const size = ver * 4 + 17;
  const m = Array.from({length: size}, () => new Array(size).fill(false));
  const fn = Array.from({length: size}, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
  // أنماط التوقيت، ثم مربعات التحديد الثلاثة، ثم أنماط المحاذاة
  for (let i = 0; i < size; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]){
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  }
  const al = alignPositions(ver), last = al.length - 1;
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // معلومات التنسيق: المستوى M (00) + رقم القناع، مع رمز BCH
  const fmt = (() => { const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); return ((d << 10) | r) ^ 0x5412; })();
  const bit = (v, i) => ((v >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(fmt, i));
  set(8, 7, bit(fmt, 6)); set(8, 8, bit(fmt, 7)); set(7, 8, bit(fmt, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fmt, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fmt, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fmt, i));
  set(8, size - 8, true);                     // الوحدة الداكنة الثابتة
  // معلومات الإصدار (من الإصدار 7)
  if (ver >= 7){
    let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const v = (ver << 12) | r;
    for (let i = 0; i < 18; i++){ const a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit(v, i)); set(b, a, bit(v, i)); }
  }
  // وضع بتات البيانات بنمط متعرّج من أسفل اليمين، عمودين عمودين
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++){
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
      if (!fn[y][x] && k < codewords.length * 8){ m[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; }
    }
  }
  // تطبيق القناع على خانات البيانات فقط
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
  ];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
  return m;
}

// نقاط الجزاء: كل قناع يعطي رمزاً صحيحاً، ونختار الأسهل قراءةً للكاميرا
function penalty(m){
  const n = m.length; let p = 0, dark = 0;
  const lines = [];
  for (let i = 0; i < n; i++){ lines.push(m[i]); lines.push(m.map(r => r[i])); }
  for (const line of lines){
    let run = 1;
    for (let i = 1; i <= n; i++){
      if (i < n && line[i] === line[i - 1]) run++;
      else { if (run >= 5) p += run - 2; run = 1; }
    }
    const s = line.map(v => v ? 1 : 0).join('');
    for (const pat of ['10111010000', '00001011101']) for (let i = s.indexOf(pat); i >= 0; i = s.indexOf(pat, i + 1)) p += 40;
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++){
    const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  m.forEach(r => r.forEach(v => { if (v) dark++; }));
  p += (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return p;
}

// المصفوفة النهائية (true = داكن)
export function qrMatrix(text){
  const bytes = [...new TextEncoder().encode(String(text))];
  let ver = 1;
  while (ver <= 10 && 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 > dataCodewords(ver) * 8) ver++;
  if (ver > 10) throw new Error('QR: text too long');
  const cw = withEcc(encodeData(bytes, ver), ver);
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++){ const m = build(ver, cw, mask); const p = penalty(m); if (p < bestP){ best = m; bestP = p; } }
  return best;
}

// رمز QR بصيغة SVG (داكن على أبيض دائماً ليُقرأ مطبوعاً وفي الوضع الداكن)، مع هامش هادئ 4 وحدات
const escAttr = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
export function qrSvg(text, {label = ''} = {}){
  const m = qrMatrix(text), n = m.length, q = 4, size = n + q * 2;
  let d = '';
  m.forEach((row, y) => {
    for (let x = 0; x < n; x++){
      if (!row[x]) continue;
      let w = 1; while (x + w < n && row[x + w]) w++;   // دمج الخانات المتجاورة في مستطيل واحد
      d += `M${x + q} ${y + q}h${w}v1h-${w}z`; x += w - 1;
    }
  });
  // الألوان من متغيرات CSS الثابتة --qr-bg و--qr-ink (أبيض وأسود في كل الأوضاع)
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escAttr(label)}" shape-rendering="crispEdges"><rect class="qr-bg" width="${size}" height="${size}"/><path class="qr-ink" d="${d}"/></svg>`;
}
