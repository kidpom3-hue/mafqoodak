// فحص إمكانية الوصول الآلي (للمطوّر فقط؛ لا يحمّله التطبيق) عبر Playwright، بطبقتين:
// 1) axe-core: أي خطأ serious أو critical (يحتاج: cd tools && npm install).
// 2) H31: فحوص من المتصفح نفسه (شجرة الوصول في Chromium وقياس العناصر)، تعمل حتى بلا axe-core:
//    - كل زر ورابط وحقل وتبويب ونافذة (dialog) له اسم يُقرأ
//    - كل aria-labelledby/aria-describedby/aria-controls/for يشير إلى عنصر موجود، ولا معرّف مكرر
//    - عنوان h1 واحد، ولا قفزة في مستويات العناوين (h1 ثم h3 بلا h2)
//    - أهداف اللمس 36px على الأقل (اتفاق المشروع؛ حد WCAG 2.5.8 هو 24px)، عدا الروابط داخل الجمل وأعمدة الرسوم البيانية
//      (لها جدول بديل)
//    - تباين النص 4.5:1 (و3:1 للكبير) على خلفيته الفعلية
// يشغّل التطبيق من هذا المستودع مع بديل تجريبي لـ Firebase (tools/a11y-stubs) وبيانات مثال، ويفحص الصفحات الأساسية
// والنوافذ وحالات الخطأ باللغتين في الوضعين الفاتح والداكن، ويفشل عند أي مشكلة.
// التشغيل: cd tools && npm install && npx playwright install chromium && npm run a11y
// (لاستخدام متصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run a11y)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stub = f => fs.readFileSync(path.join(root, 'tools/a11y-stubs', f), 'utf8');
const AXE_FILE = path.join(root, 'tools/node_modules/axe-core/axe.min.js');
const AXE = fs.existsSync(AXE_FILE) ? fs.readFileSync(AXE_FILE, 'utf8') : null;
if (!AXE) console.log('⚠ axe-core غير مثبّت (cd tools && npm install): تعمل فحوص المتصفح وحدها، وفحص axe لم يُشغَّل.');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(0);
const PORT = server.address().port;

// بيانات مثال: مكتب، وأغراض، وطلبات (قيد المراجعة، ومقبول برمز استلام، ومكتمل)، وبلاغ
const now = Date.now(), day = 864e5, O = 'tc-ahsa';
const ds = n => new Date(now - n * day).toISOString().slice(0, 10);
const item = (id, x = {}) => ({officeId: O, ref: 'TCA-' + id.toUpperCase(), cat: 'phones', sub: 'جوال', title: 'جوال', foundDate: ds(3), photo: false, status: 'available', createdBy: 'staffA', createdAt: now - day, updatedAt: now, sample: false, ...x, public: 'public' in x ? x.public : (x.cat ?? 'phones') !== 'cash'});   // H16: الغرض العام فيه public: true (والنقود false)
const db = {
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', nameEn: 'Technical College in Al-Ahsa', type: 'college', city: 'الأحساء', place: 'المبنى الإداري', hours: 'الأحد – الخميس، 7:30 ص – 2:30 م', phone: '0135000000', retentionDays: 90, pickupDays: 7, reviewDays: 2, spots: ['المكتبة', 'الكافتيريا'], active: true, createdAt: 1, code: 'TCA'},
  'staff/staffA': {offices: [O]}, 'users/zed': {name: 'Zed'}, 'users/staffA': {name: 'Staff'},
  'items/i1': item('i1'), 'itemSecrets/i1': {officeId: O, title: 'جوال أسود', color: 'black', spot: 'المكتبة', details: {serial: 'ABCD', model: 'iPhone 13'}},
  'items/i2': item('i2', {cat: 'wallets', sub: 'محفظة رجالية', title: 'محفظة رجالية'}), 'itemSecrets/i2': {officeId: O, title: 'محفظة', spot: 'الكافتيريا'},
  'items/i3': item('i3', {status: 'returned', returnedAt: now - day}),
  'items/i4': item('i4', {cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر', status: 'reserved', reservedFor: 'i4_zed'}), 'itemSecrets/i4': {officeId: O, title: 'حقيبة', color: 'navy', spot: 'المكتبة'},
  // H33: الطلب قيد المراجعة معه نسخة من «سجل أغراضي» (سُجّل قبل العثور) ورقم تسلسلي، فتظهر قوة الإثبات وصفوف السجل للموظف
  'claims/i1_zed': {itemId: 'i1', officeId: O, uid: 'zed', no: 'REQ-7K3M', proof: 'غلاف أحمر', color: 'black', lostSpot: 'المكتبة', lostDate: ds(4), claimantName: 'Zed', idLast4: '1234', status: 'pending', codeHash: 'x', createdAt: now,
    details: {serial: 'ABCD'}, reg: {id: 'g1', at: now - 10 * day, cat: 'phones', title: 'جوال الدراسة', brand: 'Apple', model: 'iPhone 13', serial: 'F2LXK9ABCD'}},
  'claims/i3_zed': {itemId: 'i3', officeId: O, uid: 'zed', no: 'REQ-4PRX', proof: 'x', status: 'done', doneAt: now - day, doneBy: 'staffA', handoverNote: 'استلمه: Zed — آخر 4: 1234', codeHash: 'x', createdAt: now - 3 * day},
  'belongings/g1': {uid: 'zed', cat: 'phones', title: 'جوال الدراسة', brand: 'Apple', model: 'iPhone 13', serial: 'F2LXK9ABCD', mark: 'ملصق قطة', at: now - 10 * day},
  // H31: طلب مقبول برمز استلام (بطاقة الرمز في «طلباتي»، و«تحقق وسلّم» عند الموظف)
  'claims/i4_zed': {itemId: 'i4', officeId: O, uid: 'zed', no: 'REQ-9QWE', proof: 'حقيبة كحلية', color: 'navy', lostSpot: 'المكتبة', lostDate: ds(4), claimantName: 'Zed', idLast4: '1234', status: 'approved', decidedAt: now - 3600e3, decidedBy: 'staffA', pickupBy: now + 6 * day, createdAt: now - day,
    delegate: {name: 'Sam', last4: '5678', at: now - 600e3}},   // H33: مفوَّض بالاستلام
  'users/zed/private/codes': {codes: {i4_zed: 'K7M3TX9P'}},
  'reports/r1': {officeId: O, uid: 'zed', cat: 'phones', title: 'جوالي', status: 'open', lostDate: ds(4), createdAt: now - day},
  'publicStats/tc-ahsa': {month: ds(0).slice(0, 7), monthReceived: 3, monthReturned: 1, totalReceived: 40, totalReturned: 28, returnRate: 70, avgDays: 3.5, avgRating: 4.5, ratings: 12, updatedAt: now},
};
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'}, staff = {uid: 'staffA', displayName: 'Staff', email: 's@example.com'}, owner = {uid: 'owner', displayName: 'Owner', email: 'o@example.com'};
// زر يُضغط بعد فتح الصفحة (نافذة أو حالة خطأ). openAll: كل <details> مفتوح (يُفحص المحتوى المطوي أيضاً)
const click = sel => async p => { await p.evaluate(s => document.querySelector(s)?.click(), sel); };
const PAGES = [
  ['home', null, 'visitor', {}], ['browse', null, 'visitor', {}], ['item', null, 'visitor', {id: 'i1'}], ['privacy', null, 'visitor', {}],
  ['service', null, 'visitor', {id: 'claim'}], ['numbers', null, 'visitor', {}], ['a11y', null, 'visitor', {}],
  ['office', null, 'visitor', {}], ['handin', null, 'visitor', {}], ['login', null, 'visitor', {}],
  ['claim', zed, 'visitor', {id: 'i1'}], ['mine', zed, 'visitor', {}], ['report', zed, 'visitor', {}],
  ['done', zed, 'visitor', {kind: 'claim', id: 'i1_zed', no: 'REQ-7K3M', title: 'جوال', officeId: O, at: now}, null, 'done-claim'],
  ['done', zed, 'visitor', {kind: 'handin', id: 'f1', code: 'K7M3TX', officeId: O, at: now}, null, 'done-handin'],
  ['staff', staff, 'staff', {}], ['staff', staff, 'staff', {tab: 'claims'}, null, 'staff-claims'], ['staff', staff, 'staff', {tab: 'reports'}, null, 'staff-reports'],
  ['item', staff, 'staff', {id: 'i1'}, null, 'staff-item'], ['add', staff, 'staff', {}], ['stats', staff, 'staff', {office: O}],
  ['admin', owner, 'admin', {}],
  // H33: «سجل أغراضي» ونموذج التسجيل، وإيصال التسليم، ونافذة التفويض بالاستلام
  ['regs', zed, 'visitor', {}], ['regAdd', zed, 'visitor', {}], ['receipt', zed, 'visitor', {id: 'i3_zed'}],
  ['mine', zed, 'visitor', {}, click('[data-act=delegate]'), 'sheet-delegate'],
  // النوافذ وحالات الخطأ
  ['home', zed, 'visitor', {}, click('[data-act=account]'), 'sheet-account'], ['home', null, 'visitor', {}, click('[data-act=displaySheet]'), 'sheet-display'],
  ['staff', staff, 'staff', {tab: 'claims'}, click('[data-act=reject]'), 'sheet-reject'],
  ['staff', staff, 'staff', {tab: 'claims'}, async p => { await click('#st-claims-come')(p); await p.waitForTimeout(300); await click('[data-act=verify]')(p); }, 'sheet-verify'],
  ['report', zed, 'visitor', {}, click('[data-act=stepNext]'), 'report-error'], ['login', null, 'visitor', {}, click('form[data-form=login] button[type=submit]'), 'login-error'],
];

// فحوص المتصفح داخل الصفحة: تعيد قائمة نصوص (فارغة = لا مشكلة)
function domChecks(){
  const out = [];
  const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; });
  Object.entries(ids).filter(([, c]) => c > 1).forEach(([id]) => out.push('معرّف مكرر #' + id));
  for (const a of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']){
    document.querySelectorAll(`[${a}]`).forEach(e => e.getAttribute(a).split(/\s+/).filter(Boolean).forEach(id => { if (!document.getElementById(id)) out.push(`${a}="${id}" يشير إلى عنصر غير موجود (${e.tagName.toLowerCase()})`); }));
  }
  const shown = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const srOnly = e => !!e.closest('.sr-only');
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => (shown(h) || srOnly(h)) && !h.closest('[hidden],[aria-hidden=true]'));
  const inDialog = !!document.querySelector('#sheet:not([hidden])');
  if (!inDialog){
    const h1 = hs.filter(h => h.tagName === 'H1').length; if (h1 !== 1) out.push(`عدد عناوين h1 = ${h1} (المتوقع 1)`);
    let prev = 0; for (const h of hs){ if (h.closest('#sheet')) continue; const l = +h.tagName[1]; if (prev && l > prev + 1) out.push(`قفزة في العناوين h${prev} ← h${l}: «${h.textContent.trim().slice(0, 30)}»`); prev = l; }
  }
  const scope = inDialog ? document.querySelector('#sheet') : document;
  scope.querySelectorAll('button, a[href], select, input:not([type=hidden]), textarea, summary, [role=button], [role=tab], [tabindex="0"]').forEach(e => {
    if (!shown(e) && !e.matches('input[type=checkbox],input[type=radio]')) return;
    if (e.closest('[hidden], .sr-only, .chart, .hbars, .cols') || e.matches('.col, .hb-bar')) return;   // أعمدة الرسوم: لها جدول بديل
    let r = e.getBoundingClientRect();
    if (e.matches('input[type=checkbox],input[type=radio]')){ const l = e.closest('label') || (e.id && document.querySelector(`label[for="${e.id}"]`)); if (!l) return; r = l.getBoundingClientRect(); if (!r.width) return; }
    // رابط داخل جملة (WCAG يستثنيه): نصه جزء من نص أطول في العنصر نفسه
    const par = e.parentElement; if (e.matches('a, button.link') && par && /^(P|LI|SPAN|SMALL|DD|TD|LABEL|B)$/.test(par.tagName) && par.textContent.trim().length > e.textContent.trim().length + 8) return;
    // ::before الموسِّع لمنطقة اللمس (مثل .switch)
    const b = getComputedStyle(e, '::before'); const extra = b.content !== 'none' && b.position === 'absolute' ? Math.max(0, -parseFloat(b.top) || 0) + Math.max(0, -parseFloat(b.bottom) || 0) : 0;
    const h = r.height + extra, w = r.width, min = Math.min(h, w);
    const name = `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}${e.dataset.act ? `[data-act=${e.dataset.act}]` : ''}`;
    if (min < 36) out.push(`هدف لمس صغير ${Math.round(w)}×${Math.round(h)} (أقل من 36): ${name} «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}»`);
  });
  // التباين
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [r, g, b, a]; };
  const lum = ([r, g, b]) => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
  const bgOf = e => { const layers = []; let op = 1;
    for (let x = e; x; x = x.parentElement){ const s = getComputedStyle(x); op *= +s.opacity; if (s.backgroundImage !== 'none') return null; const c = parse(s.backgroundColor); if (c && c[3] > 0){ layers.push(c); if (c[3] >= 1) break; } }
    let bg = [255, 255, 255, 1]; for (const l of layers.reverse()) bg = blend(l, bg); return [bg, op]; };
  const seen = new Set(), walk = document.createTreeWalker(scope === document ? document.body : scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());){
    const e = n.parentElement; if (!n.textContent.trim() || !e || seen.has(e)) continue; seen.add(e);
    if (!shown(e) || e.closest('[aria-hidden=true], .sr-only, svg, noscript, script, style, .boot-seo, button:disabled, [aria-disabled=true], .ref')) continue;
    const s = getComputedStyle(e), fg = parse(s.color), b = bgOf(e); if (!fg || !b) continue;
    const [bg, op] = b; const f = blend([...fg.slice(0, 3), fg[3] * op], bg);
    const L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(s.fontSize), large = size >= 24 || (+s.fontWeight >= 700 && size >= 18.66);
    if (ratio < (large ? 3 : 4.5)) out.push(`تباين ${ratio.toFixed(2)}:1 (المطلوب ${large ? 3 : 4.5}): «${n.textContent.trim().slice(0, 24)}» ${s.color} على rgb(${bg.slice(0, 3).map(Math.round)})`);
  }
  return out;
}
const NAMED = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'menuitem', 'tab', 'switch', 'searchbox', 'spinbutton', 'slider', 'listbox', 'option', 'dialog', 'alertdialog', 'tabpanel']);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const found = []; let checked = 0;
for (const lang of ['ar', 'en']) for (const dark of [false, true]) for (const [route, user, mode, params, act, label] of PAGES){
  const page = label || route;
  // bypassCSP: لحقن axe-core في الصفحة فقط (سياسة CSP في index.html تمنع السكربتات المضمّنة، وهذا المقصود في التطبيق)
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, colorScheme: dark ? 'dark' : 'light', bypassCSP: true});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = (a, o) => { window.__APPCHECK = o; return {}; }; export class ReCaptchaV3Provider { constructor(k){ this.key = k; } }'}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})}; localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${lang}"'); localStorage.setItem('mfq:mode', '"${mode}"');`);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(600);
  await p.evaluate(async ([r, pr]) => { const ui = await import('./js/ui.js'); ui.go(r, pr); }, [route, params]); await p.waitForTimeout(700);
  if (act){ await act(p); await p.waitForTimeout(500); }
  if (!act) await p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; }));
  await p.waitForTimeout(150);
  const tag = {page, lang, mode: dark ? 'dark' : 'light'};
  if (act && !(await p.evaluate(() => !!document.querySelector('#sheet:not([hidden])') || !!document.querySelector('.form-err:not([hidden]), .field-err:not([hidden])'))))
    found.push({...tag, impact: 'setup', id: 'scenario', help: 'لم تظهر النافذة أو رسالة الخطأ المتوقعة', nodes: []});
  // 1) axe-core
  if (AXE){
    await p.addScriptTag({content: AXE});
    const res = await p.evaluate(async () => (await window.axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']})).violations
      .filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' '))})));
    for (const v of res) found.push({...tag, ...v});
  }
  // 2) فحوص المتصفح: الأسماء من شجرة الوصول، ثم العناوين والمراجع والأهداف والتباين
  const cdp = await ctx.newCDPSession(p);
  const {nodes} = await cdp.send('Accessibility.getFullAXTree');
  const noName = nodes.filter(n => !n.ignored && NAMED.has(n.role?.value) && !(n.name?.value || '').trim()).map(n => n.role.value);
  if (noName.length) found.push({...tag, impact: 'browser', id: 'name', help: 'عنصر بلا اسم يُقرأ: ' + [...new Set(noName)].join('، '), nodes: []});
  for (const m of await p.evaluate(domChecks)) found.push({...tag, impact: 'browser', id: 'dom', help: m, nodes: []});
  if (errs.length) found.push({...tag, impact: 'browser', id: 'pageerror', help: errs.join(' | ').slice(0, 300), nodes: []});
  checked++;
  await ctx.close();
}
await browser.close(); server.close();
if (found.length){
  console.log(`✘ ${found.length} مشكلة في ${checked} فحصاً:`);
  for (const f of found) console.log(`- [${f.impact}] ${f.id} · ${f.page} (${f.lang}, ${f.mode}): ${f.help}${f.nodes.length ? '\n    ' + f.nodes.join('\n    ') : ''}`);
  process.exit(1);
}
console.log(`✔ لا مشكلات في ${checked} فحصاً (${PAGES.length} صفحة ونافذة × لغتان × وضعان)${AXE ? '' : ' — فحوص المتصفح فقط: ثبّت axe-core لفحصه أيضاً'}.`);
