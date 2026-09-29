// فحص إمكانية الوصول الآلي (للمطوّر فقط؛ لا يحمّله التطبيق): axe-core عبر Playwright.
// يشغّل التطبيق من هذا المستودع مع بديل تجريبي لـ Firebase (tools/a11y-stubs) وبيانات مثال،
// ويفحص الصفحات الأساسية باللغتين في الوضعين الفاتح والداكن، ويفشل عند أي خطأ serious أو critical.
// التشغيل: cd tools && npm install && npx playwright install chromium && npm run a11y
// (لاستخدام متصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run a11y)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stub = f => fs.readFileSync(path.join(root, 'tools/a11y-stubs', f), 'utf8');
const AXE = fs.readFileSync(path.join(root, 'tools/node_modules/axe-core/axe.min.js'), 'utf8');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(0);
const PORT = server.address().port;

// بيانات مثال: مكتب، وأغراض، وطلب مكتمل، وبلاغ
const now = Date.now(), day = 864e5, O = 'tc-ahsa';
const ds = n => new Date(now - n * day).toISOString().slice(0, 10);
const item = (id, x = {}) => ({officeId: O, ref: 'TCA-' + id.toUpperCase(), cat: 'phones', sub: 'جوال', title: 'جوال', foundDate: ds(3), photo: false, status: 'available', createdBy: 'staffA', createdAt: now - day, updatedAt: now, sample: false, ...x});
const db = {
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', type: 'college', city: 'الأحساء', place: 'المبنى الإداري', hours: 'الأحد – الخميس، 7:30 ص – 2:30 م', phone: '0135000000', retentionDays: 90, pickupDays: 7, reviewDays: 2, spots: ['المكتبة', 'الكافتيريا'], active: true, createdAt: 1, code: 'TCA'},
  'staff/staffA': {offices: [O]}, 'users/zed': {name: 'Zed'},
  'items/i1': item('i1'), 'itemSecrets/i1': {officeId: O, title: 'جوال أسود', color: 'black', spot: 'المكتبة'},
  'items/i2': item('i2', {cat: 'wallets', sub: 'محفظة رجالية', title: 'محفظة رجالية'}), 'itemSecrets/i2': {officeId: O, title: 'محفظة', spot: 'الكافتيريا'},
  'items/i3': item('i3', {status: 'returned', returnedAt: now - day}),
  'claims/i1_zed': {itemId: 'i1', officeId: O, uid: 'zed', no: 'REQ-7K3M', proof: 'غلاف أحمر', color: 'black', lostSpot: 'المكتبة', lostDate: ds(4), claimantName: 'Zed', idLast4: '1234', status: 'pending', codeHash: 'x', createdAt: now},
  'claims/i3_zed': {itemId: 'i3', officeId: O, uid: 'zed', no: 'REQ-4PRX', proof: 'x', status: 'done', doneAt: now - day, codeHash: 'x', createdAt: now - 3 * day},
  'reports/r1': {officeId: O, uid: 'zed', cat: 'phones', title: 'جوالي', status: 'open', lostDate: ds(4), createdAt: now - day},
  'publicStats/tc-ahsa': {month: ds(0).slice(0, 7), monthReceived: 3, monthReturned: 1, totalReceived: 40, totalReturned: 28, returnRate: 70, avgDays: 3.5, avgRating: 4.5, ratings: 12, updatedAt: now},
};
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'}, staff = {uid: 'staffA', displayName: 'Staff', email: 's@example.com'};
const PAGES = [
  ['home', null, 'visitor', {}], ['browse', null, 'visitor', {}], ['item', null, 'visitor', {id: 'i1'}], ['privacy', null, 'visitor', {}],
  ['service', null, 'visitor', {id: 'claim'}], ['numbers', null, 'visitor', {}], ['a11y', null, 'visitor', {}],
  ['claim', zed, 'visitor', {id: 'i2'}], ['mine', zed, 'visitor', {}], ['report', zed, 'visitor', {}],
  ['staff', staff, 'staff', {}], ['stats', staff, 'staff', {office: O}],
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const found = []; let checked = 0;
for (const lang of ['ar', 'en']) for (const dark of [false, true]) for (const [route, user, mode, params] of PAGES){
  // bypassCSP: لحقن axe-core في الصفحة فقط (سياسة CSP في index.html تمنع السكربتات المضمّنة، وهذا المقصود في التطبيق)
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, colorScheme: dark ? 'dark' : 'light', bypassCSP: true});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = (a, o) => { window.__APPCHECK = o; return {}; }; export class ReCaptchaV3Provider { constructor(k){ this.key = k; } }'}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})}; localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${lang}"'); localStorage.setItem('mfq:mode', '"${mode}"');`);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(600);
  await p.evaluate(async ([r, pr]) => { const ui = await import('./js/ui.js'); ui.go(r, pr); }, [route, params]); await p.waitForTimeout(700);
  await p.addScriptTag({content: AXE});
  const res = await p.evaluate(async () => (await window.axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']})).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' '))})));
  checked++;
  for (const v of res) found.push({page: route, lang, mode: dark ? 'dark' : 'light', ...v});
  await ctx.close();
}
await browser.close(); server.close();
if (found.length){
  console.log(`✘ ${found.length} مشكلة (serious/critical) في ${checked} فحصاً:`);
  for (const f of found) console.log(`- [${f.impact}] ${f.id} · ${f.page} (${f.lang}, ${f.mode}): ${f.help}\n    ${f.nodes.join('\n    ')}`);
  process.exit(1);
}
console.log(`✔ لا أخطاء serious أو critical في ${checked} فحصاً (${PAGES.length} صفحة × لغتان × وضعان).`);
