// صور التثبيت (screenshots في manifest.webmanifest) من الواجهة الحالية (للمطوّر فقط؛ لا يحمّله التطبيق).
// H40: الصور السابقة من سبتمبر (الواجهة القديمة ورمز استلام من 6 أرقام)، ويراها كل من يثبّت المنصة على Android.
// أعد تشغيله بعد أي تغيير كبير في الواجهة: cd tools && npm run shots
// بيانات مثال فقط (لا بيانات حقيقية): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs)، والمظهر الفاتح، والعربية.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stub = f => fs.readFileSync(path.join(root, 'tools/a11y-stubs', f), 'utf8');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(0);
const PORT = server.address().port;

const now = Date.now(), day = 864e5, O = 'tc-ahsa';
const ds = n => new Date(now - n * day).toISOString().slice(0, 10);
const item = (id, cat, sub, n, x = {}) => ({officeId: O, ref: 'TCA-' + id, cat, sub, title: sub, foundDate: ds(n), photo: false, status: 'available', createdBy: 'staffA',
  createdAt: now - n * day - 3600e3, updatedAt: now - n * day, sample: false, public: cat !== 'cash', keepUntil: now + 80 * day, ...x});
const db = {
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', nameEn: 'Technical College in Al-Ahsa', type: 'college', city: 'الأحساء', place: 'المبنى الإداري — مكتب شؤون الطلاب',
    hours: 'الأحد – الخميس، 7:30 ص – 2:30 م', phone: '0135000000', retentionDays: 90, pickupDays: 7, reviewDays: 2, spots: ['المكتبة', 'الكافتيريا', 'المسجد'], active: true, createdAt: 1, code: 'TCA'},
  'items/K7M3': item('K7M3', 'bags', 'حقيبة ظهر', 0), 'items/P4RX': item('P4RX', 'phones', 'جوال', 1), 'items/W9TE': item('W9TE', 'study', 'آلة حاسبة', 1),
  'items/H3CF': item('H3CF', 'glasses', 'نظارة طبية', 2), 'items/N6YD': item('N6YD', 'clothes', 'جاكيت', 3), 'items/A4MK': item('A4MK', 'acc', 'سماعات لاسلكية', 4),
  'items/J7UV': item('J7UV', 'keys', 'مفاتيح سيارة', 5), 'items/T3PA': item('T3PA', 'study', 'كتاب', 6),
  'items/R9KC': item('R9KC', 'bags', 'حقيبة لابتوب', 9, {status: 'reserved', reservedFor: 'R9KC_zed'}),
  // مُعادة لأصحابها (تظهر في العدد «أُعيد لأصحابه» فقط)
  ...Object.fromEntries(['M2QF', 'C8VK', 'D5NE', 'E7HX', 'F3TU'].map((id, k) => ['items/' + id, item(id, 'study', 'دفتر', 12 + k, {status: 'returned', returnedAt: now - (10 + k) * day})])),
  'claims/R9KC_zed': {itemId: 'R9KC', officeId: O, uid: 'zed', no: 'REQ-7K3M', proof: 'ملصق على الجيب الأمامي', claimantName: 'محمد علي', idLast4: '1234', status: 'approved',
    decidedAt: now - 2 * 3600e3, decidedBy: 'staffA', pickupBy: now + 6 * day, createdAt: now - day},
  'users/zed/private/codes': {codes: {R9KC_zed: 'K7MATX9P'}},
  'reports/r1': {officeId: O, uid: 'zed', cat: 'phones', title: 'سماعة بلوتوث', status: 'open', lostDate: ds(2), createdAt: now - 2 * day},
  'publicStats/tc-ahsa': {month: ds(0).slice(0, 7), monthReceived: 14, monthReturned: 9, totalReceived: 96, totalReturned: 71, returnRate: 74, avgDays: 2.8, avgRating: 4.7, ratings: 38, updatedAt: now},
};
const zed = {uid: 'zed', displayName: 'محمد', email: 'student@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
async function shot(file, {user = null, w = 360, h = 640, scale = 3, route = 'home', params = {}, before} = {}){
  const ctx = await browser.newContext({viewport: {width: w, height: h}, deviceScaleFactor: scale, colorScheme: 'light', reducedMotion: 'reduce'});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider {}'}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})};
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"ar"'); localStorage.setItem('mfq:theme', '"light"');
    localStorage.setItem('mfq:installOff', JSON.stringify(Date.now()));`);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(900);
  if (route !== 'home') await p.evaluate(async ([r, pr]) => { (await import('./js/ui.js')).go(r, pr); }, [route, params]);
  await p.waitForTimeout(700);
  if (before) await before(p);
  await p.evaluate(() => document.fonts?.ready).catch(() => {});
  await p.waitForTimeout(300);
  await p.screenshot({path: path.join(root, 'screenshots', file)});
  if (errs.length) throw new Error(file + ': ' + errs.join(' | '));
  await ctx.close();
  console.log('✔ screenshots/' + file);
}
await shot('home.png');
await shot('browse.png', {route: 'browse'});
await shot('mine.png', {user: zed, route: 'mine', before: p => p.evaluate(() => {
  // بطاقة الطلب المقبول مفتوحة ورمز الاستلام في أعلى الشاشة
  document.querySelector('details[data-card="c:R9KC_zed"]')?.setAttribute('open', '');
  document.querySelector('.code-hero, .code-card, [data-card="c:R9KC_zed"]')?.scrollIntoView({block: 'start'}); scrollBy(0, -90);
}).then(() => p.waitForTimeout(300))});
await shot('wide.png', {w: 1280, h: 800, scale: 1});
await browser.close(); server.close();
