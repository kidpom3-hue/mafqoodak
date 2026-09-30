// فحص الحقن والبيانات التالفة (للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
// 1) كل حقل نصي في بيانات المثال يحمل حمولة HTML/JS، وكل حمولة تنادي __x('اسم الحقل') إن نُفّذت.
// 2) بيانات بأنواع خاطئة (lostDate: 'x'، createdAt: 'x'، تصنيف غير موجود) كما كانت القواعد القديمة تسمح.
// 3) كل مسار في ROUTES (تُقرأ من js/ui.js) بأربعة أدوار (زائر، صاحب طلب، موظف، مدير) وباللغتين على عرض 320،
//    مع فتح كل <details> والنقر على كل تبويب، وروابط #item/<حمولة> و#o/<حمولة>.
// 4) مرور إضافي بسياسة CSP مفعّلة: أي مخالفة CSP في الصفحات العادية تعني أن السياسة تمنع شيئاً يحتاجه التطبيق.
// يفشل عند: تنفيذ __x، أو pageerror، أو img[src=x] في الصفحة، أو تمرير أفقي عند 320، أو مخالفة CSP.
// التشغيل: cd tools && npm run fuzz   (لمتصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run fuzz)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stub = f => fs.readFileSync(path.join(root, 'tools/a11y-stubs', f), 'utf8');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(0);
const PORT = server.address().port;

// كل المسارات من ROUTES في js/ui.js (أي مسار جديد يُفحص تلقائياً)
const uiSrc = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const ROUTES = [...uiSrc.slice(uiSrc.indexOf('const ROUTES = {'), uiSrc.indexOf('};', uiSrc.indexOf('const ROUTES = {'))).matchAll(/^\s+(\w+):\s*\{/gm)].map(m => m[1]);

// الحمولة: تنادي __x(key) إن نُفّذت في أي مكان (سمة، أو HTML، أو SVG)
const P = k => `'"><img src=x onerror=__x('${k}')><svg onload=__x('${k}')>`;
const now = Date.now(), day = 864e5, O = 'tc-ahsa';
const ds = n => new Date(now - n * day).toISOString().slice(0, 10);
const item = (id, x = {}) => ({officeId: O, ref: P('ref'), cat: 'phones', sub: P('sub'), title: P('title'), foundDate: ds(3), photo: false, status: 'available', createdBy: 'staffA', createdAt: now - 3 * day, updatedAt: now, sample: false, ...x});
const secret = x => ({officeId: O, title: P('secret.title'), color: P('secret.color'), brand: P('secret.brand'), desc: P('secret.desc'), spot: P('secret.spot'), bldg: P('secret.bldg'), room: P('secret.room'), storage: P('secret.storage'),
  finderNote: P('secret.finderNote'), handoverNote: P('secret.handoverNote'), disposalNote: P('secret.disposalNote'), details: {amount: P('d.amount'), model: P('d.model'), lockscreen: P('d.lockscreen')}, ...x});
const claim = (id, uid, x = {}) => ({itemId: id, officeId: O, uid, no: P('no'), proof: P('proof'), color: P('claim.color'), brand: P('claim.brand'), lostSpot: P('lostSpot'), bldg: P('claim.bldg'), room: P('claim.room'),
  lostDate: ds(4), claimantName: P('claimantName'), idLast4: '1234', details: {amount: P('cd.amount')}, note: P('claim.note'), question: P('question'), askedAt: now - 3600e3, answer: P('answer'), answeredAt: now - 1800e3,
  handoverNote: P('claim.handoverNote'), status: 'pending', codeHash: 'x', createdAt: now - 7200e3, ...x});
const db = {
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: P('office.name'), short: P('office.short'), nameEn: P('office.nameEn'), shortEn: P('office.shortEn'), type: 'college', city: P('office.city'), cityEn: P('office.cityEn'),
    place: P('office.place'), placeEn: P('office.placeEn'), hours: P('office.hours'), hoursEn: P('office.hoursEn'), phone: P('office.phone'), retentionDays: 90, pickupDays: 7, reviewDays: 2,
    spots: [P('spot0'), 'المكتبة'], spotsEn: [P('spotEn0'), 'Library'], active: true, createdAt: 1, code: 'TCA'},
  'staff/staffA': {offices: [O]},
  'users/zed': {name: P('user.name'), email: P('user.email'), photo: ''}, 'users/amy': {name: P('user2.name'), email: 'amy@example.com'},
  'staffInvites/new@example.com': {offices: [O], createdBy: 'owner', createdAt: now - day},
  'items/i1': item('i1'), 'itemSecrets/i1': secret(),
  'items/i2': item('i2', {status: 'reserved', reservedFor: 'i2_zed'}), 'itemSecrets/i2': secret(),
  'items/i3': item('i3', {status: 'returned', returnedAt: now - day, fromFound: 'f0'}), 'itemSecrets/i3': secret(),
  'claims/i1_zed': claim('i1', 'zed'), 'claims/i1_amy': claim('i1', 'amy', {question: '', answer: ''}),
  'claims/i2_zed': claim('i2', 'zed', {status: 'approved', pickupBy: now + 3 * day, decidedAt: now - day}),
  'claims/i3_zed': claim('i3', 'zed', {status: 'done', doneAt: now - day, rating: 4, ratingNote: P('ratingNote'), ratedAt: now - day}),
  'reports/r1': {officeId: O, uid: 'zed', cat: 'phones', sub: P('rep.sub'), title: P('rep.title'), desc: P('rep.desc'), color: P('rep.color'), spot: P('rep.spot'), bldg: P('rep.bldg'), room: P('rep.room'),
    lostDate: ds(4), status: 'open', createdAt: now - day, staffPick: 'i1', pickedAt: now - 3600e3, details: {amount: P('rd.amount')}, rejected: [P('rejected')], pickRejected: P('pickRejected')},
  'reports/r2': {officeId: O, uid: 'amy', cat: 'keys', title: P('rep2.title'), status: 'closed', closedReason: 'self', closedAt: now - day, createdAt: now - 2 * day},
  'foundReports/f0': {officeId: O, uid: 'zed', cat: 'phones', sub: P('found.sub'), spot: P('found.spot'), bldg: P('found.bldg'), room: P('found.room'), foundDate: ds(3), note: P('found.note'), code: P('found.code'), status: 'received', itemId: 'i3', createdAt: now - 3 * day},
  'foundReports/f1': {officeId: O, uid: 'zed', cat: 'bags', sub: P('found1.sub'), note: P('found1.note'), code: 'K7M3TX', foundDate: ds(1), status: 'pending', createdAt: now - 3600e3},
  'logs/l1': {officeId: O, itemId: 'i1', claimId: 'i1_zed', reportId: '', action: 'perm:grant', by: 'owner', at: now - day, note: P('log.note')},
  'publicStats/tc-ahsa': {month: ds(0).slice(0, 7), monthReceived: 3, monthReturned: 1, totalReceived: 40, totalReturned: 28, returnRate: 70, avgDays: 3.5, avgRating: 4.5, ratings: 12, updatedAt: now},
  // بيانات بأنواع خاطئة (كانت القواعد القديمة تقبلها): يجب ألا تُعطّل أي صفحة
  'items/ib': item('ib', {cat: 'nope', foundDate: 'x', createdAt: 'x', updatedAt: 'x'}), 'itemSecrets/ib': secret({details: 'x'}),
  // H14: طلب قديم فيه موافقة أولى فقط (وحقل approvals بنوع خاطئ): يُعرض كأي طلب قيد المراجعة
  'claims/i1_old1': claim('i1', 'old1', {approvals: ['staffA']}), 'claims/i1_old2': claim('i1', 'old2', {approvals: P('approvals')}),
  'claims/ib_zed': claim('ib', 'zed', {lostDate: 'x', createdAt: 'x', askedAt: 'x', answeredAt: 9e15, editedAt: 'x', details: 'x'}),
  'claims/i1_bad': claim('i1', 'bad', {lostDate: 'x', createdAt: 'x', pickupBy: 'x'}),
  // H11: نقود (تصنيف مجمّع) وطلبات مجمّعة بالوصف: غير مربوط، ومربوط، وتصنيف خاطئ، وتفاصيل بأنواع خاطئة
  'items/ic': item('ic', {cat: 'cash'}), 'itemSecrets/ic': secret({details: {amount: P('ic.amount'), denoms: P('ic.denoms')}}),
  'claims/g_zed_cash_1': claim('', 'zed', {grouped: true, cat: 'cash', lostSpot: P('g.spot'), details: {amount: P('g.amount'), holder: P('g.holder')}}),
  'claims/g_amy_cash_2': claim('', 'amy', {grouped: true, cat: 'cash', details: {amount: '150'}}), 'claimLinks/g_amy_cash_2': {officeId: O, itemId: 'ic', by: 'staffA', at: now},
  'claims/g_zed_nope_3': claim('', 'zed', {grouped: true, cat: 'nope', details: 'x', lostDate: 'x'}),
  // H13a: طلبات يتيمة: على غرض محذوف (لا items/gone)، وعلى غرض مؤرشف، وطلب مقبول على غرض محذوف
  'claims/gone_zed': claim('gone', 'zed'), 'claims/gone2_amy': claim('gone2', 'amy', {status: 'approved', pickupBy: now + day}),
  'items/iar': item('iar', {status: 'archived'}), 'itemSecrets/iar': secret(), 'claims/iar_amy': claim('iar', 'amy'),
  'reports/rb': {officeId: O, uid: 'zed', cat: 'nope', title: P('repb.title'), lostDate: 'x', status: 'open', createdAt: 'x', renewedAt: 'x', editedAt: 'x'},
  'foundReports/fb': {officeId: O, uid: 'zed', cat: 'nope', foundDate: 'x', status: 'pending', createdAt: 'x'},
};
const users = {
  visitor: [null, 'visitor'], claimant: [{uid: 'zed', displayName: P('auth.name'), email: 'zed@example.com'}, 'visitor'],
  staff: [{uid: 'staffA', displayName: 'Staff', email: 's@example.com'}, 'staff'], admin: [{uid: 'owner', displayName: 'Owner', email: 'o@example.com'}, 'admin'],
};
const PARAMS = {item: [{id: 'i1'}, {id: 'i2'}, {id: 'ib'}], claim: [{id: 'i1'}, {id: 'i1', edit: 'i1_zed'}, {id: 'i1', report: 'r1'}], report: [{}, {id: 'r1'}], stats: [{office: O}], audit: [{office: O}],
  labels: [{ids: ['i1', 'ib']}], poster: [{office: O}], thanks: [{id: 'f0'}], service: [{}, {id: 'claim'}, {id: 'handin'}], officeForm: [{id: O}, {}], add: [{}, {id: 'i1'}, {id: 'ib'}]};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let visits = 0;
const fail = (where, msg) => { if (fails.length < 60) fails.push(`${where}: ${msg}`); };

async function open(user, mode, lang, {csp = false, hash = ''} = {}){
  // bypassCSP: نفحص هروب النصوص (esc) وحده دون حماية CSP. المرور الثاني يفعّل CSP ليتأكد أنها لا تمنع ما يحتاجه التطبيق
  const ctx = await browser.newContext({viewport: {width: 320, height: 700}, bypassCSP: !csp});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaV3Provider {}'}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await ctx.addInitScript(`window.__hits = []; window.__x = k => window.__hits.push(String(k)); window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})};
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${lang}"'); localStorage.setItem('mfq:mode', '"${mode}"');`);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/${hash}`); await p.waitForTimeout(700);
  return {p, ctx, errs};
}
// فحص الصفحة الحالية: تنفيذ الحمولة، وأخطاء الصفحة، وصور src=x، والتمرير الأفقي عند 320
async function check(p, errs, where){
  const r = await p.evaluate(() => ({hits: window.__hits.splice(0), csp: window.__csp.splice(0), img: document.querySelectorAll('img[src="x"]').length,
    over: document.documentElement.scrollWidth - innerWidth}));
  if (r.hits.length) fail(where, `نُفّذت حمولة حقن من الحقل: ${[...new Set(r.hits)].join('، ')}`);
  if (r.img) fail(where, `في الصفحة ${r.img} صورة img[src=x] (نص غير مهرَّب)`);
  if (r.over > 0) fail(where, `تمرير أفقي ${r.over}px عند عرض 320`);
  if (r.csp.length) fail(where, `مخالفة CSP: ${[...new Set(r.csp)].join(' | ')}`);
  for (const e of errs.splice(0)) fail(where, `خطأ في الصفحة (pageerror): ${e.slice(0, 160)}`);
}
// فتح كل <details> والنقر على كل تبويب داخل الصفحة (لا تبويبات الوضع في الشريط العلوي)
async function expand(p){
  await p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; })).catch(() => {});
  const n = await p.locator('#main [role=tab]').count();
  for (let k = 0; k < n; k++){ await p.locator('#main [role=tab]').nth(k).click({timeout: 1500}).catch(() => {}); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; })).catch(() => {}); }
}
// خطأ أثناء الرسم (مثل RangeError من تاريخ تالف) يصل هنا لا إلى pageerror، فنسجّله مثله
const go = (p, r, params, errs) => p.evaluate(async ([r, pr]) => { (await import('./js/ui.js')).go(r, pr); }, [r, params])
  .catch(e => errs?.push(String(e.message || e).split('\n')[0])).then(() => p.waitForTimeout(350));

// ---------- 1) كل المسارات × الأدوار × اللغتين (بلا CSP: فحص الهروب نفسه) ----------
for (const lang of ['ar', 'en']) for (const [role, [user, mode]] of Object.entries(users)){
  const {p, ctx, errs} = await open(user, mode, lang);
  await check(p, errs, `${role}/${lang}/start`);
  for (const r of ROUTES) for (const params of (PARAMS[r] || [{}])){
    const where = `${role}/${lang}/${r}${Object.keys(params).length ? JSON.stringify(params) : ''}`;
    await go(p, r, params, errs); await check(p, errs, where);
    await expand(p); await check(p, errs, where + ' (مفتوح)');
    visits++;
  }
  // تبويبات لوحة الموظف والإدارة
  if (mode === 'staff') for (const tab of ['items', 'claims', 'reports']){
    await p.evaluate(async t => { (await import('./js/state.js')).S.staffTab = t; (await import('./js/ui.js')).go('staff', {}); }, tab).catch(e => errs.push(String(e.message || e).split('\n')[0])); await p.waitForTimeout(350);
    await expand(p); await check(p, errs, `${role}/${lang}/staff:${tab}`); visits++;
  }
  if (mode === 'admin') for (const tab of ['overview', 'offices', 'people']){
    await p.evaluate(async t => { (await import('./js/state.js')).S.adminTab = t; (await import('./js/ui.js')).go('admin', {}); }, tab).catch(e => errs.push(String(e.message || e).split('\n')[0])); await p.waitForTimeout(350);
    await expand(p); await check(p, errs, `${role}/${lang}/admin:${tab}`); visits++;
  }
  await ctx.close();
}

// ---------- 2) روابط المشاركة بحمولة ----------
for (const h of [`#item/${encodeURIComponent(P('hash.item'))}`, `#item/${O}/${encodeURIComponent(P('hash.item2'))}`, `#o/${encodeURIComponent(P('hash.office'))}`,
                 `#item/"><img src=x onerror=__x('hash.raw')>`, `#o/../../x`]){
  const {p, ctx, errs} = await open(null, 'visitor', 'ar', {hash: h});
  await check(p, errs, `رابط ${h.slice(0, 30)}`); visits++;
  await ctx.close();
}

// ---------- 3) سياسة CSP مفعّلة: الصفحات العادية بلا أي مخالفة ----------
for (const [role, [user, mode], pages] of [['visitor', users.visitor, ['home', 'browse', 'item', 'service', 'numbers', 'privacy', 'login']],
                                           ['claimant', users.claimant, ['mine', 'claim', 'report', 'handin']], ['staff', users.staff, ['staff', 'add', 'stats', 'labels']], ['admin', users.admin, ['admin', 'audit', 'officeForm']]]){
  const {p, ctx, errs} = await open(user, mode, 'ar', {csp: true});
  const r0 = await p.evaluate(() => window.__csp.slice());
  for (const r of pages){ await go(p, r, (PARAMS[r] || [{}])[0], errs); await check(p, errs, `CSP/${role}/${r}`); visits++; }
  if (!r0.length && !(await p.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')))) fail('CSP', 'لا توجد سياسة CSP في index.html');
  await ctx.close();
}

await browser.close(); server.close();
if (fails.length){
  console.log(`✘ فشل فحص الحقن والبيانات التالفة (${fails.length}${fails.length >= 60 ? '+' : ''} مشكلة في ${visits} زيارة):`);
  for (const f of fails) console.log('- ' + f);
  process.exit(1);
}
console.log(`✔ لا حقن ولا أخطاء ولا تمرير أفقي ولا مخالفات CSP: ${visits} زيارة (${ROUTES.length} مساراً × 4 أدوار × لغتان، وروابط بحمولة، ومرور بسياسة CSP).`);
