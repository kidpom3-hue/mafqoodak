// H41: خصائص الدوال الصافية (للمطوّر فقط؛ لا يحمّله التطبيق ولا يحتاج متصفحاً): آلاف المدخلات العشوائية بمولّد ثابت البذرة
// (النتيجة نفسها في كل تشغيل) وقيم تالفة من بيانات قديمة. يفشل عند:
//   - دالة تاريخ ترمي خطأ أو ترجع غير نص/رقم لقيمة غير صالحة (null، NaN، '2026-13-45'، كائن…)
//   - isoDay لا يساوي يوم الرياض (UTC+3) لأي ساعة في السنة
//   - detailValue غير ثابتة (تطبيقها مرتين يغيّر الناتج) أو تتجاوز حدّ النوع أو تُخرج خياراً غير معروف
//   - normPickup/normCode/latinDigits غير ثابتة، أو esc يترك < > " ' أو & ليست بداية رمز، أو رمز الاستلام بأحرف خارج REF_CHARS
//   - ملف التقويم (.ics): سطر أطول من 75 بايتاً، أو بلا CRLF، أو العنوان لا يعود كما هو بعد فك الطي والهروب
//   - matchScore خارج 0–100 أو ليس عدداً صحيحاً أو يرمي
// التشغيل: cd tools && npm run props
globalThis.localStorage ??= {getItem: () => null, setItem(){}, removeItem(){}};
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.document ??= {documentElement: {}, getElementById: () => null, title: '', querySelector: () => null};
const U = await import('../js/utils.js'), C = await import('../js/constants.js');
let n = 0; const bad = [];
const ok = (c, m) => { n++; if (!c) bad.push(m); };
// مولّد ثابت البذرة (mulberry32): الخطأ يتكرر بالمدخلات نفسها
let seed = 41; const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
const rnd = k => Math.floor(rand() * k);
const CH = ['٠','١','٩','۰','۹','0','9','a','Z',' ','-','_','.','@','<','>','&','"',"'",'\n','\t','أ','ة','ـ','ً','😀','‏','\u0000','A','O','I','$','{','}'];
const rstr = (L = 30) => Array.from({length: rnd(L)}, () => CH[rnd(CH.length)]).join('');
const ODD = [null, undefined, '', 0, -1, NaN, Infinity, 1e20, '2026-13-45', 'x', {}, [], true, 8.64e15 + 1, -8.64e15 - 1, '2026-02-30', ' 2026-01-01'];
for (const v of ODD){
  for (const f of ['isoDay', 'fmtDate', 'fmtDateFull', 'fmtDateTime', 'fullWhen', 'when', 'relDay', 'relTime', 'isoMs', 'daysAgo', 'dayNum']){
    try { const r = U[f](v); ok(typeof r === 'string' || typeof r === 'number', `${f}(${String(v)}) نوع ${typeof r}`); } catch (e){ ok(false, `${f}(${String(v)}) رمى ${e.message}`); }
  }
}
// الأيام: isoDay لكل ساعة في سنة = يوم الرياض (UTC+3)
for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 36e5 * 7){
  const d = new Date(ms + 3 * 36e5); const want = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  ok(U.isoDay(ms) === want, `isoDay(${new Date(ms).toISOString()}) = ${U.isoDay(ms)} لا ${want}`);
}
// detailValue: idempotent وحدود الطول ونوع الناتج
const QS = C.CATS.flatMap(c => C.claimOf(c.id).details);
for (let k = 0; k < 4000; k++){
  const q = QS[rnd(QS.length)], v = rstr(120);
  const a = C.detailValue(q, v), b = C.detailValue(q, a);
  ok(typeof a === 'string', 'detailValue نوع');
  ok(a === b, `detailValue غير ثابتة ${q.k}/${q.type}: ${JSON.stringify(v)} → ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  const max = {num: 9, approx: 9, last4: 4, tail: 4, pick: 20, text: 80}[q.type] ?? 80;
  ok(a.length <= max, `detailValue طول ${q.type}: ${a.length}`);
  if (q.type === 'pick') ok(a === '' || q.opts.includes(a), `pick خارج الخيارات ${a}`);
  if (['num', 'approx', 'last4'].includes(q.type)) ok(/^\d*$/.test(a), `رقم فيه غير الأرقام ${a}`);
}
// الرموز
for (let k = 0; k < 3000; k++){
  const s = rstr(20);
  ok(U.normPickup(U.normPickup(s)) === U.normPickup(s), 'normPickup غير ثابتة ' + JSON.stringify(s));
  ok(U.normCode(U.normCode(s)) === U.normCode(s), 'normCode غير ثابتة');
  ok(/^[A-Z0-9]{0,8}$/.test(U.normPickup(s)), 'normPickup ناتج ' + U.normPickup(s));
  ok(!/[<>"']/.test(U.esc(s)) && !/&(?!amp;|lt;|gt;|quot;|#39;)/.test(U.esc(s)), 'esc ترك حرفاً خاصاً');
  ok(U.latinDigits(U.latinDigits(s)) === U.latinDigits(s), 'latinDigits غير ثابتة');
}
for (let k = 0; k < 500; k++){ const c = U.genCode(); ok(/^[ACDEFHJKMNPRTUVWXY34679]{8}$/.test(c), 'genCode ' + c); ok(U.normPickup(U.fmtPickup(c)) === c, 'fmtPickup/normPickup ذهاباً وإياباً ' + c); }
// ics: كل سطر ≤ 75 بايتاً، CRLF، والرمز لا يظهر
const enc = new TextEncoder();
for (let k = 0; k < 400; k++){
  const title = rstr(200), desc = rstr(300), place = rstr(100);
  const s = U.icsEvent({uid: 'u' + k, at: Date.now() + rnd(1e9), title, desc, place, url: 'https://x.test/#a,b;c', remind: rstr(60)});
  ok(s.endsWith('\r\n') && !/[^\r]\n/.test(s), 'ics بلا CRLF');
  for (const line of s.split('\r\n')) ok(enc.encode(line).length <= 75, `ics سطر ${enc.encode(line).length} بايت`);
  // فكّ الطي ثم فكّ الهروب يعيد العنوان كما هو
  const un = s.replace(/\r\n /g, ''); const m = un.match(/^SUMMARY:(.*)$/m);
  const back = m ? m[1].replace(/\\n/g, '\n').replace(/\\([\;,])/g, '$1') : null;
  ok(back === title.replace(/\r?\n/g, '\n'), 'ics العنوان لا يعود كما هو: ' + JSON.stringify([title.slice(0, 40), (back || '').slice(0, 40)]));
}
// matchScore: 0..100 وعدد صحيح ولا ترمي
for (let k = 0; k < 3000; k++){
  const cats = [...C.CATS.map(c => c.id), 'bottles', '', undefined, 'x'];
  const mk = () => ({cat: cats[rnd(cats.length)], sub: rstr(10), color: ['black', '', 'x'][rnd(3)], title: rstr(30), desc: rstr(60), lostDate: ODD[rnd(ODD.length)] ?? '2026-10-01', foundDate: ['2026-10-02', '', 'x'][rnd(3)], spot: ['المكتبة', ''][rnd(2)], bldg: rstr(3), details: rnd(2) ? {amount: '5', serial: 'AB12'} : undefined});
  try { const s = U.matchScore(mk(), mk()); ok(Number.isInteger(s) && s >= 0 && s <= 100, 'matchScore ' + s); } catch (e){ ok(false, 'matchScore رمى ' + e.message); }
}
if (bad.length){ console.log(`✘ ${bad.length} من ${n}:\n- ` + [...new Set(bad)].slice(0, 30).join('\n- ')); process.exit(1); }
console.log(`✔ خصائص الدوال الصافية: ${n} فحصاً (التواريخ بتوقيت الرياض، وإجابات الأسئلة، والرموز، والهروب، وملف التقويم، ودرجة المطابقة).`);
