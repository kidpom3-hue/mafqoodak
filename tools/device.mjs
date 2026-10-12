// فحص الجهاز المشترك وثبات النصوص (H29، للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
// 1) «تذكّرني على هذا الجهاز» في صفحة الدخول: محدّد افتراضياً؛ إلغاؤه = جهاز مشترك: الدخول في الجلسة فقط (browserSessionPersistence)،
//    وقائمة اختيار حساب Google دائماً، وبعد إعادة الفتح: نسخة البيانات في الذاكرة لا على القرص، وتُمسح النسخة القديمة من القرص.
//    إعادة التحديد تعيد كل شيء كما كان. ونافذة الحساب تذكر أن الجهاز مشترك.
// 2) زر «دخول» في الترويسة وأنت في صفحة الدخول: «الصفحة الحالية»، ولا يمسح وجهة العودة بعد الدخول.
// 3) نصوص لا تنكسر: «اختر صورة» في سطر واحد (كان العمود ينكمش إلى 20px)، و«2:30 م» لا ينقسم على سطرين،
//    والواجهة بلا سطر المكان والأوقات والهاتف (H30: حُذف منها بطلب المالك؛ يبقى في صفحة المكتب). على 320 و390 باللغتين، وبالخط العادي والكبير جداً.
// التشغيل: cd tools && npm run device   (لمتصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run device)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stub = f => fs.readFileSync(path.join(root, 'tools/a11y-stubs', f), 'utf8');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(0);
const PORT = server.address().port;

const O = 'tc-ahsa';
const db = {
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', nameEn: 'Technical College in Al-Ahsa', type: 'college', city: 'الأحساء',
    place: 'المبنى الإداري - الدور الأرضي', placeEn: 'Admin building - ground floor', hours: 'الأحد – الخميس، 7:30 ص – 2:30 م', hoursEn: 'Sun – Thu, 7:30 am – 2:30 pm',
    phone: '0135800000', retentionDays: 90, pickupDays: 7, spots: ['المكتبة'], active: true, createdAt: 1, code: 'TCA'},
  'users/zed': {name: 'Zed'},
};
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) fails.push(msg); };

async function open({user = null, lang = 'ar', width = 390, text = ''} = {}){
  const ctx = await browser.newContext({viewport: {width, height: 844}});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaV3Provider {}'}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})};
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${lang}"'); localStorage.setItem('mfq:mode', '"visitor"');
    ${text ? `localStorage.setItem('mfq:text', '"${text}"');` : ''}`);
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(700);
  return {p, ctx};
}
const go = (p, r, params = {}) => p.evaluate(async ([r, pr]) => { (await import('./js/ui.js')).go(r, pr); }, [r, params]).then(() => p.waitForTimeout(500));
const fake = (p, k) => p.evaluate(k => window.__FAKE[k] ?? null, k);
const ls = (p, k) => p.evaluate(k => localStorage.getItem(k), k);

// ---------- 1) «تذكّرني على هذا الجهاز» ----------
{
  const {p, ctx} = await open();
  expect(await fake(p, 'cache') === 'persistent', '1: الجهاز العادي: نسخة البيانات على القرص (persistentLocalCache)');
  await go(p, 'report'); await go(p, 'login', {next: {name: 'report', params: {}}});
  expect(await p.evaluate(() => document.querySelector('#l-remember')?.checked === true), '1: «تذكّرني» محدّد افتراضياً');
  expect(await p.evaluate(() => { const i = document.querySelector('#l-remember'), h = document.getElementById(i?.getAttribute('aria-describedby') || ''); return !!h && !i.closest('label').contains(h); }), '1: التلميح مربوط بالخيار (aria-describedby) وخارج اسمه');
  await p.click('#l-remember'); await p.waitForTimeout(200);
  expect(await ls(p, 'mfq:shared') === 'true', '1: إلغاء «تذكّرني» يعلّم الجهاز مشتركاً (mfq:shared)');
  expect(await fake(p, 'persistence') === 'session', '1: إلغاء «تذكّرني» = الدخول في الجلسة فقط (browserSessionPersistence)');
  await p.click('[data-act=google]'); await p.waitForTimeout(200);
  expect((await fake(p, 'popupParams'))?.prompt === 'select_account', '1: Google في الجهاز المشترك: قائمة اختيار الحساب دائماً (prompt=select_account)');
  await p.reload(); await p.waitForTimeout(900);
  expect(await fake(p, 'cache') === 'memory', '1: بعد إعادة الفتح في الجهاز المشترك: نسخة البيانات في الذاكرة لا على القرص (memoryLocalCache)');
  expect(await fake(p, 'persistence') === 'session', '1: بعد إعادة الفتح: الدخول في الجلسة فقط');
  expect(await ls(p, 'test:cleared') === '1', '1: بعد إعادة الفتح: تُمسح النسخة القديمة من القرص (clearIndexedDbPersistence)');
  await go(p, 'login');
  expect(await p.evaluate(() => document.querySelector('#l-remember')?.checked === false), '1: في الجهاز المشترك يظهر «تذكّرني» غير محدّد');
  await p.click('#l-remember'); await p.waitForTimeout(200);
  expect(await ls(p, 'mfq:shared') === null, '1: إعادة تحديد «تذكّرني» تزيل علامة الجهاز المشترك');
  expect(await fake(p, 'persistence') === 'local', '1: إعادة التحديد = الدخول محفوظ (browserLocalPersistence)');
  await p.click('[data-act=google]'); await p.waitForTimeout(200);
  expect(await fake(p, 'popupParams') === null, '1: Google في الجهاز العادي بلا معاملات إضافية');
  await p.evaluate(() => localStorage.removeItem('test:cleared')); await p.reload(); await p.waitForTimeout(900);
  expect(await fake(p, 'cache') === 'persistent' && await ls(p, 'test:cleared') === null, '1: بعد إعادة التحديد وإعادة الفتح: النسخة على القرص كما كانت ولا مسح');
  expect(!p.errs.length, '1: أخطاء في الصفحة: ' + p.errs.join(' | '));
  await ctx.close();
}
// الجهاز المشترك بلا مستخدم داخل: ما بقي من المستخدم السابق في localStorage يُمسح (والمكان والمظهر يبقيان)؛ ومع مستخدم داخل لا يُمسح شيء
for (const user of [null, zed]){
  const {p, ctx} = await open({user});
  await p.evaluate(() => { localStorage.setItem('mfq:shared', 'true'); for (const k of ['seen', 'prof', 'codes', 'suggHold']) localStorage.setItem('mfq:' + k, '["x"]'); });
  await p.reload(); await p.waitForTimeout(900);
  const left = await p.evaluate(() => ['seen', 'prof', 'codes', 'suggHold'].filter(k => localStorage.getItem('mfq:' + k) !== null));
  const office = await ls(p, 'mfq:office');
  if (!user) expect(!left.length && office, `1: جهاز مشترك بلا مستخدم: بقي من السابق: ${left.join('، ') || '—'}${office ? '' : ' (وضاع المكان المختار)'}`);
  else expect(left.length === 4, `1: جهاز مشترك ومستخدم داخل: مُسح ما يخصه (${4 - left.length} مفاتيح)`);
  await ctx.close();
}
// نافذة الحساب تذكر أن الجهاز مشترك (وتنبّه إلى حساب Google في المتصفح)
for (const shared of [false, true]){
  const {p, ctx} = await open({user: zed});
  if (shared){ await p.evaluate(() => localStorage.setItem('mfq:shared', 'true')); await p.reload(); await p.waitForTimeout(900); }
  await p.click('.avatar-btn'); await p.waitForTimeout(300);
  const txt = await p.evaluate(() => document.querySelector('#sheet')?.textContent || '');
  const want = await p.evaluate(async k => (await import('./js/i18n.js')).t(k), shared ? 'acc.sharedOn' : 'acc.shared');
  expect(txt.includes(want), `1: نافذة الحساب (${shared ? 'جهاز مشترك' : 'جهاز عادي'}) تعرض: ${want}`);
  await ctx.close();
}

// ---------- 2) زر «دخول» في الترويسة داخل صفحة الدخول ----------
{
  const {p, ctx} = await open();
  await go(p, 'login', {next: {name: 'report', params: {}}});
  expect(await p.evaluate(() => document.querySelector('.login-btn')?.getAttribute('aria-current') === 'page'), '2: زر «دخول» في صفحة الدخول مُعلَّم «الصفحة الحالية»');
  await p.click('.login-btn'); await p.waitForTimeout(300);
  const r = await p.evaluate(async () => { const st = await import('./js/state.js'); return [st.S.route.name, st.S.route.params.next?.name || '']; });
  expect(r[0] === 'login' && r[1] === 'report', `2: الضغط عليه في صفحة الدخول لا يمسح وجهة العودة (وُجد: ${r.join(' ← ') || 'لا شيء'})`);
  await go(p, 'home');
  expect(await p.evaluate(() => !document.querySelector('.login-btn')?.hasAttribute('aria-current')), '2: خارج صفحة الدخول بلا «الصفحة الحالية»');
  await ctx.close();
}

// ---------- 3) نصوص لا تنكسر ----------
for (const lang of ['ar', 'en']) for (const width of [320, 390]) for (const text of ['', 'xl']){
  const tag = `${lang} ${width}${text ? ' xl' : ''}`;
  const {p, ctx} = await open({lang, width, text});
  // النص داخل الزر في سطر واحد: عدد الأسطر = عدد مواضع البداية المختلفة لمستطيلات النص (Range)
  await go(p, 'report');
  const lines = await p.evaluate(() => { const e = document.querySelector('.photo-drop .filebtn'); if (!e) return -1;
    const tn = [...e.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (!tn) return -1;
    const rg = document.createRange(); rg.selectNodeContents(tn);
    return new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size; });
  expect(lines === 1, `3 (${tag}): زر «اختر صورة» في البلاغ على ${lines < 0 ? 'لا شيء (غير موجود)' : lines + ' أسطر'} بدل سطر واحد`);
  await go(p, 'office');
  const hours = await p.evaluate(() => [...document.querySelectorAll('dd')].map(d => d.textContent).filter(x => /\d:\d\d/.test(x)));
  expect(hours.length && hours.every(x => !/\d:\d\d[ \t]+\p{L}/u.test(x)), `3 (${tag}): وقت العمل ينقسم بين الرقم وص/م: ${hours.join(' | ')}`);
  // والفترة كلها («7:30 ص – 2:30 م») في سطر واحد كما تُرسم فعلاً (مستطيلات النص من أول وقت إلى آخره)
  const rangeLines = await p.evaluate(() => { const d = [...document.querySelectorAll('dd')].find(x => /\d:\d\d/.test(x.textContent)); if (!d) return -1;
    const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode()) && !/\d:\d\d/.test(n.textContent));
    if (!n) return -1; const s = n.textContent, a = s.search(/\d{1,2}:\d\d/), m = [...s.matchAll(/\d{1,2}:\d\d\S*\s?\S*/gu)].pop();
    const rg = document.createRange(); rg.setStart(n, a); rg.setEnd(n, m.index + m[0].length);
    return new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size; });
  // (بالخط الكبير جداً على 320 قد لا تتسع الفترة لعرض العمود فتلتف، وهذا أفضل من تمرير أفقي)
  if (!text) expect(rangeLines === 1, `3 (${tag}): فترة العمل على ${rangeLines} أسطر بدل سطر واحد`);
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `3 (${tag}): تمرير أفقي في صفحة المكتب`);
  await go(p, 'home');
  // H30: لا مكان ولا أوقات ولا هاتف في الواجهة (لا السطر القديم .hh-info ولا رابط اتصال ولا أيقونات الموقع والساعة)
  const heroInfo = await p.evaluate(() => { const h = document.querySelector('.hero-home'); if (!h) return 'لا واجهة';
    return [h.querySelector('.hh-info') && '.hh-info', h.querySelector('a.tel, a[href^="tel:"]') && 'رابط الهاتف'].filter(Boolean).join('، '); });
  expect(heroInfo === '', `3 (${tag}): سطر المكان والأوقات والهاتف ما زال في الواجهة (${heroInfo})`);
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `3 (${tag}): تمرير أفقي في الواجهة`);
  // ويبقى في صفحة المكتب (المكان والأوقات ورابط الاتصال)
  await go(p, 'office');
  expect(await p.evaluate(() => !!document.querySelector('a.tel[href^="tel:"]')), `3 (${tag}): صفحة المكتب بلا رابط هاتف المكتب`);
  expect(!p.errs.length, `3 (${tag}): أخطاء في الصفحة: ${p.errs.join(' | ')}`);
  await ctx.close();
}

await browser.close(); server.close();
if (fails.length){
  console.log(`✘ فشل ${fails.length} من ${checks} فحصاً:`);
  for (const f of fails) console.log('- ' + f);
  process.exit(1);
}
console.log(`✔ الجهاز المشترك وثبات النصوص: ${checks} فحصاً («تذكّرني»، والدخول في الجلسة، والنسخة في الذاكرة، وزر الدخول، و«اختر صورة»، والأوقات، والواجهة بلا سطر المكتب).`);
