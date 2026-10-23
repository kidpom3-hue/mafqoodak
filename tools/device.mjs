// فحص الجهاز المشترك وثبات النصوص (H29، للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
// 1) «تذكّرني على هذا الجهاز» في صفحة الدخول: محدّد افتراضياً؛ إلغاؤه = جهاز مشترك: الدخول في الجلسة فقط (browserSessionPersistence)،
//    وقائمة اختيار حساب Google دائماً، وبعد إعادة الفتح: نسخة البيانات في الذاكرة لا على القرص، وتُمسح النسخة القديمة من القرص.
//    إعادة التحديد تعيد كل شيء كما كان. ونافذة الحساب تذكر أن الجهاز مشترك.
// 2) زر «دخول» في الترويسة وأنت في صفحة الدخول: «الصفحة الحالية»، ولا يمسح وجهة العودة بعد الدخول.
// 3) نصوص لا تنكسر: «اختر صورة» في سطر واحد (كان العمود ينكمش إلى 20px)، و«2:30 م» لا ينقسم على سطرين،
//    والواجهة بلا سطر المكان والأوقات والهاتف (H30: حُذف منها بطلب المالك؛ يبقى في صفحة المكتب). على 320 و390 باللغتين، وبالخط العادي والكبير جداً.
// 4) H31: صفحة التأكيد بعد إرسال بلاغ الفقد وطلب الاستلام (المباشر وبالوصف والنقود) وإشعار التسليم: عنوانها، ورقم الطلب أو التسليم
//    كما حُفظ، والتركيز على العنوان، وعنوان التبويب، و«متابعة…» تفتح «طلباتي» والبطاقة الجديدة مفتوحة، والرجوع لا يعيد النموذج.
//    والتنقل ينقل التركيز إلى عنوان الصفحة الجديدة، والنافذة لها اسم والتركيز داخلها، وتبويبات «طلباتي» تشير إلى لوحة موجودة.
// 5) H32: «مؤشرات الأداء» لا تقول «هذا الشهر» عن شهر سابق، وتتجدد في الخلفية حين يفتح الموظف لوحته؛ وعنوان التبويب لا يكرر
//    اسم المكتب؛ وقبول طلب لا شيء فيه للمقارنة يقول ذلك بوضوح بدل «تطابق 0 من 0».
// 6) H42: الترويسة بلا خط علوي (حُذف بطلب المالك: في الآيفون كان يظهر تحت الساعة كأنه خلل)، بالوضعين الفاتح والداكن، في الجوال والحاسب.
// التشغيل: cd tools && npm run device   (لمتصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run device)
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

const O = 'tc-ahsa';
const db = {
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', nameEn: 'Technical College in Al-Ahsa', type: 'college', city: 'الأحساء',
    place: 'المبنى الإداري - الدور الأرضي', placeEn: 'Admin building - ground floor', hours: 'الأحد – الخميس، 7:30 ص – 2:30 م', hoursEn: 'Sun – Thu, 7:30 am – 2:30 pm',
    phone: '0135800000', retentionDays: 90, pickupDays: 7, spots: ['المكتبة'], active: true, createdAt: 1, code: 'TCA'},
  'users/zed': {name: 'Zed'},
  // H31: غرض متاح لطلب استلام مباشر، ومحفظة (تصنيف بالوصف)
  'items/b1': {officeId: O, ref: 'TCA-B1XX', cat: 'study', sub: 'كتاب', title: 'كتاب', foundDate: '2026-10-01', photo: false, status: 'available', createdBy: 'staffA', createdAt: 1, updatedAt: 1, sample: false, public: true},
  'items/w1': {officeId: O, ref: 'TCA-W1XX', cat: 'wallets', sub: 'محفظة رجالية', title: 'محفظة رجالية', foundDate: '2026-10-01', photo: false, status: 'available', createdBy: 'staffA', createdAt: 1, updatedAt: 1, sample: false, public: true},
};
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) fails.push(msg); };

async function open({user = null, lang = 'ar', width = 390, text = '', mode = 'visitor', extra = {}, scheme = 'light'} = {}){
  const ctx = await browser.newContext({viewport: {width, height: 844}, colorScheme: scheme});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider {}'}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db: {...db, ...extra}, reads: [], writes: [], user})};
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${lang}"'); localStorage.setItem('mfq:mode', '"${mode}"');
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

// ---------- 4) H31: صفحة التأكيد، والتركيز، وعنوان التبويب، والنوافذ ----------
const tr = (p, k, v) => p.evaluate(async ([k, v]) => (await import('./js/i18n.js')).t(k, v), [k, v]);
// يملأ النموذج ثم يرسله من الخطوة الأخيرة (كما يفعل زر «إرسال»)
async function send(p, sel, fill){
  await p.evaluate(fill);
  await p.evaluate(sel => { const f = document.querySelector(sel); f.dataset.step = f.dataset.steps || 1; f.requestSubmit(); }, sel);
  await p.waitForTimeout(1200);
  return p.evaluate(async () => { const {S} = await import('./js/state.js'); const a = document.activeElement;
    return {route: S.route.name, p: S.route.params, h1: document.querySelector('#main h1')?.textContent.trim() || '', onH1: !!a?.matches('#main h1'),
      num: document.querySelector('.done-num-v')?.textContent.trim() || '', title: document.title, err: document.querySelector('.form-err:not([hidden])')?.textContent || ''}; });
}
const pick = (cat) => `const f = document.querySelector('form[data-form]'); const c = f.querySelector('input[name=cat][value=${cat}]'); if (c){ c.checked = true; c.dispatchEvent(new Event('change', {bubbles: true})); }`;
const ident = `const f = document.querySelector('form[data-form=claim]'); const set = (n, v) => { const el = f.querySelector('[name=' + n + ']'); if (el) el.value = v; };
  set('proof', 'كتاب عليه اسمي في الصفحة الأولى بخط أزرق'); set('claimantName', 'Zed Test'); set('idLast4', '1234'); set('d_amount', '200'); const pl = f.querySelector('[name=pledge]'); if (pl) pl.checked = true;
  f.querySelectorAll('[required]').forEach(el => { if (!el.value && !['radio', 'checkbox'].includes(el.type)) el.value = el.type === 'number' || el.inputMode === 'numeric' ? '200' : 'نص'; });
  f.querySelectorAll('input[type=radio][required]').forEach(el => { if (!f.querySelector('input[name=' + el.name + ']:checked')) el.checked = true; });`;
for (const lang of ['ar', 'en']){
  const cases = [
    ['report', 'report', {}, 'form[data-form=report]', `${pick('bags')} f.querySelector('[name=title]').value = 'حقيبة لابتوب رمادية';`, 'reports'],
    ['claim', 'claim', {id: 'b1'}, 'form[data-form=claim]', ident, 'claims'],
    ['gclaim', 'gclaim', {cat: 'wallets'}, 'form[data-form=claim]', ident, 'claims'],
    ['cash', 'gclaim', {cat: 'cash'}, 'form[data-form=claim]', ident, 'claims'],
    ['handin', 'handin', {}, 'form[data-form=handin]', pick('other'), 'foundReports'],
  ];
  for (const [kind, route, params, sel, fill, col] of cases){
    const tag = `4 (${lang} ${kind})`;
    const {p, ctx} = await open({user: zed, lang});
    await go(p, route, params);
    const r = await send(p, sel, new Function(fill));
    expect(r.route === 'done' && r.p.kind === kind, `${tag}: بعد الإرسال المتوقع صفحة التأكيد، ووُجد: ${r.route} ${r.p.kind || ''} ${r.err}`);
    if (r.route !== 'done'){ await ctx.close(); continue; }
    expect(r.h1 === await tr(p, 'done.t.' + kind), `${tag}: عنوان صفحة التأكيد «${r.h1}»`);
    expect(r.onH1, `${tag}: التركيز ليس على عنوان صفحة التأكيد`);
    expect(r.title.startsWith(r.h1) && r.title.includes(await tr(p, 'app.name')), `${tag}: عنوان التبويب لا يبدأ باسم الصفحة: ${r.title}`);
    // الرقم المعروض هو المحفوظ فعلاً: رقم الطلب (no) أو رقم التسليم (code)؛ البلاغ بلا رقم
    const saved = await p.evaluate(([col, id]) => window.__FAKE.db[col + '/' + id] || null, [col, r.p.id]);
    expect(!!saved, `${tag}: لم يُحفظ ${col}/${r.p.id}`);
    const want = kind === 'report' ? '' : kind === 'handin' ? saved?.code : saved?.no;
    expect(r.num === (want || ''), `${tag}: الرقم المعروض «${r.num}» والمحفوظ «${want || ''}»`);
    if (kind === 'handin') expect(await p.evaluate(() => !!document.querySelector('.done-where a.tel[href^="tel:"]')), `${tag}: مكان التسليم بلا هاتف المكتب`);
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: تمرير أفقي في صفحة التأكيد`);
    // «متابعة…» تفتح «طلباتي» والبطاقة الجديدة مفتوحة
    await p.click('[data-act=doneGo][data-r=mine]'); await p.waitForTimeout(500);
    const m = await p.evaluate(async id => { const {S} = await import('./js/state.js'); return {route: S.route.name, open: [...document.querySelectorAll('details.mcard[open]')].map(d => d.dataset.card.slice(2)), onH1: !!document.activeElement?.matches('#main h1')}; }, r.p.id);
    expect(m.route === 'mine' && m.open.includes(r.p.id), `${tag}: «متابعة» لم تفتح البطاقة الجديدة في «طلباتي» (${m.route}، المفتوحة: ${m.open.join('، ') || 'لا شيء'})`);
    expect(m.onH1, `${tag}: بعد الانتقال إلى «طلباتي» التركيز ليس على عنوانها`);
    // الرجوع من «طلباتي» لا يعيد صفحة التأكيد ولا النموذج المرسَل
    await p.evaluate(() => history.back()); await p.waitForTimeout(500);
    const back = await p.evaluate(async () => (await import('./js/state.js')).S.route.name);
    expect(!['done', route].includes(back), `${tag}: الرجوع أعاد «${back}»`);
    expect(!p.errs.length, `${tag}: أخطاء في الصفحة: ${p.errs.join(' | ')}`);
    await ctx.close();
  }
}
// التنقل: التركيز إلى عنوان الصفحة الجديدة، وعنوان التبويب باسمها؛ والرئيسية بالعنوان العام
{
  const {p, ctx} = await open({user: zed});
  await p.click('#nav [data-r=browse]'); await p.waitForTimeout(500);
  const b = await p.evaluate(() => ({onH1: !!document.activeElement?.matches('#main h1'), h1: document.querySelector('#main h1')?.textContent.trim(), title: document.title}));
  expect(b.onH1, '4: بعد الضغط على «المفقودات» في الشريط السفلي التركيز ليس على عنوان الصفحة');
  expect(b.title.startsWith(b.h1), `4: عنوان التبويب في صفحة المفقودات: ${b.title}`);
  await p.click('#nav [data-r=home]'); await p.waitForTimeout(500);
  const office = await p.evaluate(async () => { const {curOffice} = await import('./js/state.js'); const {oName} = await import('./js/constants.js'); return oName(curOffice()); });
  expect((await p.evaluate(() => document.title)).replace(/^\(\d+\) /, '') === await tr(p, 'app.titleOf', {office}), '4: عنوان التبويب في الرئيسية تغيّر');
  // تبويبات «طلباتي» تشير إلى لوحة موجودة
  await go(p, 'mine');
  expect(await p.evaluate(() => [...document.querySelectorAll('[role=tab][aria-controls]')].every(b => document.getElementById(b.getAttribute('aria-controls')))), '4: تبويب في «طلباتي» يشير إلى لوحة غير موجودة');
  // النافذة: اسمها أول عنوان فيها، والتركيز ينتقل إليها، ويعود إلى زر الحساب بعد إغلاقها
  await p.click('.avatar-btn'); await p.waitForTimeout(300);
  const d = await p.evaluate(() => { const s = document.querySelector('#sheet .sheet-panel'); const l = s && document.getElementById(s.getAttribute('aria-labelledby') || '');
    return {named: !!l?.textContent.trim(), inside: !!s?.contains(document.activeElement)}; });
  expect(d.named, '4: نافذة الحساب بلا اسم (aria-labelledby)');
  expect(d.inside, '4: التركيز لم ينتقل إلى نافذة الحساب');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  expect(await p.evaluate(() => !!document.activeElement?.matches('.avatar-btn')), '4: بعد إغلاق النافذة لم يعد التركيز إلى زر الحساب');
  expect(!p.errs.length, '4: أخطاء في الصفحة: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 5) H32: المؤشرات القديمة، وعنوان التبويب، و«لا تفاصيل للمقارنة» ----------
{
  const ym = d => new Date(d).toISOString().slice(0, 7);
  const now = new Date(); const cur = await (async () => { const {p, ctx} = await open(); const v = await p.evaluate(async () => (await import('./js/utils.js')).today().slice(0, 7)); await ctx.close(); return v; })();
  const [cy, cm] = cur.split('-').map(Number), prev = ym(Date.UTC(cy, cm - 2, 15));
  const stats = month => ({'publicStats/tc-ahsa': {month, monthReceived: 3, monthReturned: 2, totalReceived: 10, totalReturned: 8, returnRate: 80, avgDays: 2, avgRating: 4.5, ratings: 2, updatedAt: Date.now() - 13 * 864e5}});
  for (const [month, want] of [[prev, 'num.monthOf'], [cur, 'num.month']]){
    const {p, ctx} = await open({extra: stats(month)});
    await go(p, 'numbers'); await p.waitForTimeout(400);
    const h = await p.evaluate(() => document.querySelector('[data-view=numbers] h2.section-title')?.textContent.trim() || '');
    const head = await tr(p, want, {month: '__'});
    expect(h.startsWith(head.split('__')[0]), `5: مؤشرات شهر ${month === cur ? 'الحالي' : 'سابق'}: العنوان «${h}» والمتوقع يبدأ بـ «${head.split('__')[0]}»`);
    await ctx.close();
  }
  // الموظف يفتح لوحته والمؤشرات من شهر سابق: تُحسب وتُنشر في الخلفية (مرة في اليوم لكل جهاز)
  {
    const {p, ctx} = await open({user: {uid: 'staffA', displayName: 'Staff', email: 's@example.com'}, mode: 'staff', extra: {...stats(prev), 'staff/staffA': {offices: [O]}}});
    await go(p, 'staff'); await p.waitForTimeout(1500);
    const ps = await p.evaluate(() => window.__FAKE.db['publicStats/tc-ahsa']);
    expect(ps?.month === cur && Date.now() - ps.updatedAt < 60000, `5: فتح لوحة الموظف لم يجدد المؤشرات القديمة (${ps?.month})`);
    expect(!p.errs.length, '5 (لوحة الموظف): أخطاء في الصفحة: ' + p.errs.join(' | '));
    await ctx.close();
  }
  // عنوان التبويب: اسم المكتب مرة واحدة (المفقودات وصفحة المكتب فيهما اسم المكتب أصلاً)
  {
    const {p, ctx} = await open();
    const office = await p.evaluate(async () => { const {curOffice} = await import('./js/state.js'); const {oName} = await import('./js/constants.js'); return oName(curOffice()); });
    for (const r of ['browse', 'office', 'mine', 'report']){
      await go(p, r);
      const title = await p.evaluate(() => document.title);
      expect(title.split(office).length - 1 === 1, `5: عنوان تبويب «${r}» يكرر اسم المكتب أو لا يذكره: ${title}`);
    }
    await ctx.close();
  }
  // قبول طلب لا شيء فيه للمقارنة: «لا تفاصيل للمقارنة» (كانت «تطابق 0 من 0 فقط»)
  {
    const extra = {'staff/staffA': {offices: [O]}, 'itemSecrets/b1': {officeId: O, title: 'كتاب'},
      'claims/b1_zed': {itemId: 'b1', officeId: O, uid: 'zed', no: 'REQ-B1ZZ', proof: 'كتاب عليه اسمي', claimantName: 'Zed', idLast4: '1234', lostDate: '2026-10-01', status: 'pending', createdAt: Date.now() - 3600e3}};
    const {p, ctx} = await open({user: {uid: 'staffA', displayName: 'Staff', email: 's@example.com'}, mode: 'staff', extra});
    await go(p, 'staff', {tab: 'claims'}); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    const sum = await p.evaluate(() => document.querySelector('.cmp-sum')?.textContent.trim() || '');
    expect(sum.startsWith(await tr(p, 'st.cmpSumNone')), `5: ملخص المقارنة بلا تفاصيل: «${sum}»`);
    await p.evaluate(() => document.querySelector('[data-act=approve][data-id="b1_zed"]')?.click()); await p.waitForTimeout(700);
    const h = await p.evaluate(() => document.querySelector('#sheet h2')?.textContent.trim() || '');
    expect(h === await tr(p, 'a.noCmpQ'), `5: نافذة القبول بلا تفاصيل للمقارنة: «${h}»`);
    expect(!p.errs.length, '5 (القبول): أخطاء في الصفحة: ' + p.errs.join(' | '));
    await ctx.close();
  }
}

// ---------- 6) H42: الترويسة بلا خط علوي ----------
// كان أول 3px من خلفية الترويسة بلون --hero-bg؛ في الآيفون تأخذ منطقة الساعة لون الترويسة فيظهر الخط تحتها كأنه خلل
for (const width of [390, 1280]) for (const scheme of ['light', 'dark']){
  const tag = `${width} ${scheme}`;
  const {p, ctx} = await open({width, scheme});
  const r = await p.evaluate(() => {
    const h = document.querySelector('header.top'); if (!h) return null;
    // لون المتغيّر كما يحسبه المتصفح (rgb) لمقارنته بتدرّج الخلفية
    const col = v => { const i = document.createElement('i'); i.style.color = `var(${v})`; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; };
    const cs = getComputedStyle(h);
    return {src: cs.borderImageSource, shadow: cs.boxShadow, hero: col('--hero-bg'), surface: col('--surface')};
  });
  expect(r && !r.src.includes(r.hero) && r.shadow === 'none', `6 (${tag}): خط علوي بلون الواجهة في الترويسة (${r?.src} | ${r?.shadow})`);
  expect(r && r.src.startsWith(`linear-gradient(${r.surface}`), `6 (${tag}): أعلى الترويسة ليس بلون خلفيتها (${r?.src})`);
  expect(!p.errs.length, `6 (${tag}): أخطاء في الصفحة: ${p.errs.join(' | ')}`);
  await ctx.close();
}

await browser.close(); server.close();
if (fails.length){
  console.log(`✘ فشل ${fails.length} من ${checks} فحصاً:`);
  for (const f of fails) console.log('- ' + f);
  process.exit(1);
}
console.log(`✔ الجهاز المشترك وثبات النصوص وصفحة التأكيد: ${checks} فحصاً («تذكّرني»، والدخول في الجلسة، والنسخة في الذاكرة، وزر الدخول، و«اختر صورة»، والأوقات، والواجهة بلا سطر المكتب، وصفحة التأكيد ورقمها، والتركيز وعنوان التبويب، والنوافذ، والمؤشرات القديمة، و«لا تفاصيل للمقارنة»، والترويسة بلا خط علوي).`);
