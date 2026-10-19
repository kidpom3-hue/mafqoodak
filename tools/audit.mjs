// فحص الثغرات H39 (للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
// كل حالة هنا كانت ثغرة أو عيباً قبل H39 (يفشل الفحص على الإصدار 58):
//  1) مقارنة الإجابات النصية: حرف واحد أو قائمة كلمات/أعداد طويلة لا تأخذ ✓ (والنقش لا يصير «إثباتاً قوياً» بحرف)
//  2) «البلاغ السابق للعثور» بوقت محتواه من الخادم (contentAt)، والبلاغ القديم بفارق يوم كامل، والمعدَّل بعد الغرض ليس سابقاً
//  3) البلاغ وتعديله يكتبان contentAt، ومع القواعد القديمة (v22) يُرسل البلاغ بدونه
//  4) «مخفية» تحذف الصورة العامة ولو تعذّر جلب الأصل
//  5) زر «تعديل» الغرض يجلب تفاصيله السرية قبل رسم النموذج (لا أدلة فارغة تُحفظ فوق الحقيقية)
//  6) تعذّر قراءة إعداد المنصة أو المواقع: رسالة انقطاع لا صفحة «الإعداد الأول»، و«غير موجود» من النسخة المحلية وحدها ليس حكماً
//  7) الإنهاء الآلي للطلب المجمّع لا يعمل قبل وصول روابطه
//  8) «نسخ» بلا واجهة الحافظة لا يرمي خطأً
//  9) «تسجيل الخروج» يمسح كل ما يخص الحساب والمسودتين
// 10) رمز الاستلام ورقم القيد بتوزيع متساوٍ للأحرف
// 11) القواعد v23: بنيتها سليمة، وفيها حراسات H39 (فحص ثابت؛ سلوكها في tools/rules.test.mjs على المحاكي)
// التشغيل: cd tools && npm run audit   (لمتصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run audit)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { lintRules } from './rules-lint.mjs';

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
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
const item = (id, x = {}) => ({officeId: O, ref: 'TCA-' + id.toUpperCase(), cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر', foundDate: ds(1), photo: false, status: 'available', createdBy: 'staffA', createdAt: now - 3600e3, updatedAt: now, sample: false, keepUntil: now + 90 * day, public: true, ...x});
const secret = (x = {}) => ({officeId: O, title: 'حقيبة ظهر سوداء', color: 'black', brand: '', desc: 'غلاف أحمر', spot: 'المكتبة', bldg: '', room: '', storage: 'الخزانة 1', ...x});
const base = () => ({
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', type: 'college', city: 'الأحساء', place: 'المبنى الإداري', retentionDays: 90, pickupDays: 7, reviewDays: 2, spots: ['المكتبة', 'الكافتيريا'], active: true, createdAt: 1, code: 'TCA'},
  'staff/staffA': {offices: [O]}, 'users/zed': {name: 'Zed'}, 'users/staffA': {name: 'Staff'},
});
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'}, staff = {uid: 'staffA', displayName: 'Staff', email: 's@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) fails.push(msg); };

// fake: خيارات البديل التجريبي (snapErr, cacheOnly, denyField, getErr). بعد «تسجيل الخروج» (test:out في الجلسة) يبقى المستخدم خارجاً
async function open({user = null, mode = 'visitor', db = base(), fake = {}} = {}){
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider {}'}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user, ...fake})};
    if (sessionStorage.getItem('test:out')) window.__FAKE.user = null;
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"ar"'); localStorage.setItem('mfq:mode', '"${mode}"');`);
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(800);
  return {p, ctx};
}
const go = (p, r, params = {}) => p.evaluate(async ([r, pr]) => { (await import('./js/ui.js')).go(r, pr); }, [r, params]).then(() => p.waitForTimeout(600));
const db = p => p.evaluate(() => window.__FAKE.db);
const fill = (p, sel, v) => p.evaluate(([sel, v]) => { const e = document.querySelector(sel); if (e){ e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); } return !!e; }, [sel, v]);
const click = (p, sel, wait = 600) => p.evaluate(sel => { const e = document.querySelector(sel); e?.click(); return !!e; }, sel).then(ok => p.waitForTimeout(wait).then(() => ok));
const submitStep = (p, sel) => p.evaluate(async sel => { const f = document.querySelector(sel); if (!f) return false;
  if (f.dataset.steps) (await import('./js/actions.js')).showStep(f, Number(f.dataset.steps)); f.requestSubmit(); return true; }, sel).then(ok => p.waitForTimeout(1200).then(() => ok));
const view = p => p.evaluate(() => document.querySelector('#main')?.firstElementChild?.dataset.view || '');

// ---------- 1) مقارنة الإجابات النصية والأعداد، وقوة الإثبات بالنقش ----------
{
  const {p, ctx} = await open({user: staff, mode: 'staff'});
  const r = await p.evaluate(async () => {
    const m = await import('./js/views/staff.js');
    const v = s => String(s).includes('ok') ? 'ok' : String(s).includes('near') ? 'near' : String(s).includes('bad') ? 'bad' : '';
    // الإجابة النصية كما تمر في المقارنة نفسها (detailCheck لسؤال نصي)
    const tc = (a, b) => v(m.detailCheck({k: 'x', type: 'text'}, a, b));
    const f = {id: 'j1', cat: 'jewelry', photo: false, createdAt: Date.now() - 864e5, details: {engraving: 'محمد 2020'}, color: 'gold', spot: '', desc: ''};
    const c = x => ({id: 'j1_zed', itemId: 'j1', uid: 'zed', color: '', lostSpot: '', proof: '', ...x});
    const weak = m.claimChecks(c({details: {engraving: 'م'}}), f), strong = m.claimChecks(c({details: {engraving: 'محمد 2020'}}), f);
    return {
      one: tc('ا', 'محمد 2020'), oneM: tc('م', 'محمد 2020'), exact: tc('محمد 2020', 'محمد 2020'), name: tc('محمد', 'محمد 2020'),
      shotgun: tc('علي محمد احمد خالد سعد فهد 2019 2020 2021 2022', 'محمد 2020'),
      part: tc('قطة بيضاء', 'صورة قطة بيضاء'), word: tc('صورة', 'صورة قطة بيضاء'), longer: tc('عليه ملصق ناسا ازرق', 'ملصق ناسا'),
      list: tc('ملصق ناسا وملصق فيفا وغطاء اسود ازرق احمر ابيض شفاف وردي ذهبي فضي سيليكون جلد', 'ملصق ناسا'),
      denoms: tc('10 20 50 100 200 500', '200 و 100'), denomsOk: tc('200 و 100', '100 و 200'),
      numOk: m.sameNumber('ايفون 13 بسعر 1500', 'ايفون 13'), numList: m.sameNumber('10 20 50 100 200 500', '100'), numYear: m.sameNumber('مكتوب عليه 2020', 'نقش 2020'),
      det: v(m.detailCheck({k: 'engraving', type: 'text', unique: true}, 'م', 'محمد 2020')),
      weak: [weak.strength, weak.uniqHit], strong: [strong.strength, strong.uniqHit],
    };
  });
  expect(r.one === '' && r.oneM === '', `1: إجابة بحرف واحد أخذت نتيجة (${r.one}/${r.oneM})`);
  expect(r.det === '', `1: النقش بحرف واحد من نقش المكتب («م») أخذ نتيجة (${r.det})`);
  expect(r.exact === 'ok' && r.name === 'ok' && r.part === 'ok' && r.longer === 'ok', `1: إجابة صحيحة لم تأخذ ✓ (${r.exact}/${r.name}/${r.part}/${r.longer})`);
  expect(r.word === 'near', `1: كلمة واحدة من الوصف ليست ≈ (${r.word})`);
  expect(r.shotgun === '' && r.list === '', `1: قائمة كلمات أخذت نتيجة (${r.shotgun}/${r.list})`);
  expect(r.denoms === '' && r.denomsOk === 'ok', `1: الفئات: القائمة الكاملة (${r.denoms}) أو الصحيحة (${r.denomsOk})`);
  expect(r.numOk && r.numYear && !r.numList, `1: sameNumber (${r.numOk}/${r.numYear}/${r.numList})`);
  expect(r.weak[0] !== 'strong' && !r.weak[1], '1: النقش بحرف واحد («م») صار «إثباتاً قوياً» ' + JSON.stringify(r.weak));
  expect(r.strong[0] === 'strong' && r.strong[1], '1: النقش المطابق ليس «إثباتاً قوياً» ' + JSON.stringify(r.strong));
  expect(!p.errs.length, '1: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 2) «البلاغ السابق للعثور» ----------
{
  const {p, ctx} = await open({user: staff, mode: 'staff'});
  const r = await p.evaluate(async () => {
    const st = await import('./js/state.js');
    const iAt = Date.now() - 864e5, D = 864e5, H = 3600e3, i = {id: 'x1', createdAt: iAt};
    st.S.reports = [
      {id: 'rA', uid: 'zed', createdAt: iAt - H, contentAt: iAt - H},              // وقت المحتوى من الخادم قبل الغرض
      {id: 'rB', uid: 'zed', createdAt: iAt - 3 * D, contentAt: iAt + H},          // بلاغ قديم عُدّل بعد تسجيل الغرض
      {id: 'rC', uid: 'zed', createdAt: iAt - H},                                  // قديم (بلا وقت خادم) قبل الغرض بساعة: قد يكون مؤرَّخاً للخلف
      {id: 'rD', uid: 'zed', createdAt: iAt - 2 * D},                              // قديم قبل الغرض بيومين
      {id: 'rE', uid: 'zed', createdAt: iAt - 3 * D, editedAt: iAt - H},           // قديم عُدّل قبل الغرض بساعة
      {id: 'rF', uid: 'zed', createdAt: iAt - H, contentAt: {toMillis: () => iAt - H}},   // Timestamp حقيقي
      {id: 'rG', uid: 'bob', createdAt: iAt - 3 * D, contentAt: iAt - 3 * D},      // بلاغ حساب آخر
    ];
    const P = id => !!st.priorReport({uid: 'zed', reportId: id}, i);
    return {A: P('rA'), B: P('rB'), C: P('rC'), D: P('rD'), E: P('rE'), F: P('rF'), G: P('rG')};
  });
  expect(r.A && r.F, '2: بلاغ بوقت محتوى من الخادم قبل الغرض ليس «سابقاً» ' + JSON.stringify(r));
  expect(!r.B, '2: بلاغ عُدّل بعد تسجيل الغرض بقي «سابقاً للعثور»');
  expect(!r.C, '2: بلاغ قديم قبل الغرض بساعة (وقته من الجهاز) عُدّ «سابقاً»');
  expect(r.D, '2: بلاغ قديم قبل الغرض بيومين لم يُعدّ «سابقاً»');
  expect(!r.E, '2: بلاغ قديم عُدّل قبل الغرض بساعة عُدّ «سابقاً»');
  expect(!r.G, '2: بلاغ حساب آخر عُدّ «سابقاً»');
  expect(!p.errs.length, '2: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 3) البلاغ وتعديله يكتبان contentAt (ومع قواعد v22 يُرسل البلاغ بدونه) ----------
async function newReport(p){
  await go(p, 'report');
  await click(p, 'form[data-form=report] input[name=cat][value=bags]', 300);
  await fill(p, '#r-title', 'حقيبة ظهر سوداء');
  await submitStep(p, 'form[data-form=report]');
  return Object.entries(await db(p)).filter(([k]) => k.startsWith('reports/'));
}
{
  const {p, ctx} = await open({user: zed});
  const reps = await newReport(p);
  expect(reps.length === 1, '3: البلاغ لم يُرسل');
  const r0 = reps[0]?.[1] || {};
  expect(typeof r0.contentAt === 'number' && r0.contentAt >= now, '3: البلاغ الجديد بلا وقت محتوى من الخادم ' + JSON.stringify(r0));
  expect(await view(p) === 'done', '3: لم تظهر صفحة التأكيد بعد البلاغ');
  expect(!p.errs.length, '3: ' + p.errs.join(' | '));
  await ctx.close();
}
{
  const {p, ctx} = await open({user: zed, fake: {denyField: 'contentAt'}});
  const reps = await newReport(p);
  expect(reps.length === 1 && !('contentAt' in (reps[0]?.[1] || {})), '3: مع القواعد القديمة (لا تعرف contentAt) لم يُرسل البلاغ بدونه');
  expect(await view(p) === 'done', '3: مع القواعد القديمة لم تظهر صفحة التأكيد');
  await ctx.close();
}
{
  const rep = {officeId: O, uid: 'zed', cat: 'bags', sub: '', title: 'حقيبة ظهر', desc: 'سوداء', spot: '', lostDate: ds(2), photo: false, status: 'open', createdAt: now - 5 * day, contentAt: now - 5 * day};
  const {p, ctx} = await open({user: zed, db: {...base(), 'reports/rE1': rep}});
  await go(p, 'report', {id: 'rE1'});
  await fill(p, '#r-desc', 'سوداء وعليها ملصق ناسا');
  await submitStep(p, 'form[data-form=report]');
  const r = (await db(p))['reports/rE1'] || {};
  expect(r.desc === 'سوداء وعليها ملصق ناسا' && typeof r.contentAt === 'number' && r.contentAt >= now, '3: تعديل البلاغ لم يجدّد وقت المحتوى ' + JSON.stringify({desc: r.desc, contentAt: r.contentAt}));
  expect(!p.errs.length, '3: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 4) «مخفية» تحذف الصورة العامة ولو تعذّر جلب الأصل ----------
{
  const d = {...base(), 'items/e1': item('e1', {photo: 'clear'}), 'itemSecrets/e1': secret(), 'itemPhotos/e1': {data: IMG}, 'itemPhotosPrivate/e1': {officeId: O, data: IMG}};
  const {p, ctx} = await open({user: staff, mode: 'staff', db: d, fake: {getErr: '^itemPhotosPrivate/'}});
  await go(p, 'add', {id: 'e1'});
  expect(await click(p, 'form[data-form=item] input[name=photoMode][value=none]', 200), '4: لا خيار «مخفية» في نموذج التعديل');
  await p.evaluate(() => document.querySelector('form[data-form=item]').requestSubmit()); await p.waitForTimeout(1500);
  const after = await db(p);
  expect(!after['itemPhotos/e1'], '4: الصورة العامة بقيت بعد اختيار «مخفية» (تعذّر جلب الأصل)');
  expect(after['items/e1']?.photo === 'none', '4: طريقة الظهور ليست «مخفية» بعد الحفظ: ' + after['items/e1']?.photo);
  expect(!!after['itemPhotosPrivate/e1'], '4: الأصل الخاص حُذف');
  expect(!p.errs.length, '4: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 5) «تعديل» الغرض يجلب تفاصيله السرية قبل رسم النموذج ----------
{
  const d = {...base(), 'items/e2': item('e2'), 'itemSecrets/e2': secret({desc: 'غلاف أحمر عليه ملصق', handoverNote: 'ملاحظة'})};
  const {p, ctx} = await open({user: staff, mode: 'staff', db: d});
  await go(p, 'item', {id: 'e2'});
  await p.evaluate(async () => { delete (await import('./js/state.js')).S.secrets.e2; });   // لم تصل بعد (الاشتراك متأخر)
  expect(await click(p, '[data-act=editItem][data-id=e2]', 900), '5: لا زر «تعديل» في صفحة الغرض');
  const v = await p.evaluate(() => ({view: document.querySelector('#main')?.firstElementChild?.dataset.view, desc: document.querySelector('#f-desc')?.value, color: document.querySelector('form[data-form=item] input[name=color]:checked')?.value}));
  expect(v.view === 'add' && v.desc === 'غلاف أحمر عليه ملصق' && v.color === 'black', '5: نموذج التعديل فُتح بأدلة فارغة ' + JSON.stringify(v));
  expect(!p.errs.length, '5: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 6) تعذّر قراءة الإعداد أو المواقع: لا صفحة «الإعداد الأول» ----------
for (const [fake, why] of [[{snapErr: '^config/'}, 'خطأ قراءة الإعداد'], [{snapErr: '^offices$'}, 'خطأ قراءة المواقع']]){
  const {p, ctx} = await open({fake});
  const r = await p.evaluate(() => ({v: document.querySelector('#main')?.firstElementChild?.dataset.view || '', retry: !!document.querySelector('[data-act=reload]'), h1: !!document.querySelector('#main h1')}));
  expect(r.v === 'loadErr' && r.retry && r.h1, `6 (${why}): لا رسالة انقطاع مع «إعادة المحاولة»: ` + JSON.stringify(r));
  expect(!p.errs.length, '6: ' + p.errs.join(' | '));
  await ctx.close();
}
{
  const {p, ctx} = await open({fake: {cacheOnly: '^config/app$'}});
  const r = await p.evaluate(() => ({v: document.querySelector('#main')?.firstElementChild?.dataset.view || '', spin: !!document.querySelector('#main .loading .spin')}));
  expect(r.v !== 'setup' && r.spin, '6: «غير موجود» من النسخة المحلية وحدها أظهر صفحة الإعداد الأول: ' + JSON.stringify(r));
  await ctx.close();
}
{
  const d = base(); delete d['config/app'];
  const {p, ctx} = await open({db: d});
  expect(await view(p) === 'setup', '6: منصة جديدة فعلاً (لا إعداد على الخادم) لم تُظهر صفحة الإعداد الأول');
  await ctx.close();
}

// ---------- 7) الإنهاء الآلي للطلب المجمّع (30 يوماً) ينتظر روابطه ----------
for (const linked of [true, false]){
  const at = now - 40 * day, id = `g_zed_wallets_${at}`;
  const d = {...base(), 'items/w1': item('w1', {cat: 'wallets', sub: 'محفظة رجالية', title: 'محفظة رجالية'}), 'itemSecrets/w1': secret({color: 'brown'}),
    ['claims/' + id]: {itemId: '', grouped: true, cat: 'wallets', officeId: O, uid: 'zed', no: 'REQ-AAAA', proof: '', claimantName: 'Zed', idLast4: '1234', status: 'pending', createdAt: at},
    ...(linked ? {['claimLinks/' + id]: {officeId: O, itemId: 'w1', by: 'staffA', at: now - day}} : {})};
  const {p, ctx} = await open({user: staff, mode: 'staff', db: d, fake: linked ? {snapErr: '^claimLinks$'} : {}});
  await go(p, 'staff', {tab: 'claims'}); await p.waitForTimeout(1200);
  const st = (await db(p))['claims/' + id]?.status;
  expect(linked ? st === 'pending' : st === 'expired', `7: طلب مجمّع ${linked ? 'مربوط (روابطه لم تصل)' : 'غير مربوط'} عمره 40 يوماً حالته ${st}`);
  expect(!p.errs.length, '7: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 8) «نسخ» بلا واجهة الحافظة ----------
{
  const {p, ctx} = await open({user: zed});
  await p.evaluate(() => { Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true});
    const b = document.createElement('button'); b.dataset.act = 'copy'; b.dataset.v = 'ACDE-3467'; b.id = 'cp-test'; document.querySelector('#main').append(b); });
  await click(p, '#cp-test', 300);
  expect(!p.errs.length, '8: «نسخ» بلا حافظة رمى خطأ: ' + p.errs.join(' | '));
  expect((await p.evaluate(() => document.querySelector('#toast')?.textContent)) === 'ACDE-3467', '8: لم يُعرض النص للنسخ اليدوي');
  await ctx.close();
}

// ---------- 9) «تسجيل الخروج» يمسح ما يخص الحساب ----------
{
  const {p, ctx} = await open({user: zed});
  const KEYS = ['snoozed', 'suggHold', 'suggAlert', 'rateAt', 'mineTab', 'codes', 'seen'];
  await p.evaluate(keys => { for (const k of keys) localStorage.setItem('mfq:' + k, JSON.stringify(k === 'rateAt' ? Date.now() : ['x']));
    localStorage.setItem('mfq:theme', '"dark"'); sessionStorage.setItem('mfq:draft:report', JSON.stringify({v: {title: ['سر']}, at: Date.now()}));
    sessionStorage.setItem('mfq:draft:handin', '{}'); sessionStorage.setItem('test:out', '1'); }, KEYS);
  await click(p, '[data-act=account]', 400);
  await p.evaluate(() => document.querySelector('[data-act=signOut]')?.click());
  await p.waitForTimeout(2000);
  const r = await p.evaluate(keys => ({left: keys.filter(k => localStorage.getItem('mfq:' + k) !== null), theme: localStorage.getItem('mfq:theme'),
    drafts: ['mfq:draft:report', 'mfq:draft:handin'].filter(k => sessionStorage.getItem(k) !== null)}), KEYS);
  expect(!r.left.length, '9: بقي بعد الخروج: ' + r.left.join(', '));
  expect(!r.drafts.length, '9: بقيت مسودة بعد الخروج: ' + r.drafts.join(', '));
  expect(r.theme === '"dark"', '9: الخروج مسح المظهر (يخص الجهاز لا الحساب)');
  await ctx.close();
}

// ---------- 10) توزيع أحرف الرموز متساوٍ ----------
{
  const {p, ctx} = await open();
  const r = await p.evaluate(async () => {
    const u = await import('./js/utils.js'), cnt = {}, N = 30000; let bad = 0;
    for (let k = 0; k < N; k++){ const c = u.refCode(8); if (c.length !== 8 || /[^ACDEFHJKMNPRTUVWXY34679]/.test(c)) bad++; for (const ch of c) cnt[ch] = (cnt[ch] || 0) + 1; }
    const vals = Object.values(cnt), mean = N * 8 / 23;
    return {bad, n: vals.length, dev: Math.max(...vals.map(v => Math.abs(v - mean) / mean))};
  });
  expect(r.bad === 0 && r.n === 23, '10: رمز بطول أو حرف غير صحيح ' + JSON.stringify(r));
  expect(r.dev < 0.04, '10: توزيع الأحرف غير متساوٍ (أكبر انحراف ' + (r.dev * 100).toFixed(1) + '%)');
  await ctx.close();
}

// ---------- 11) القواعد v23 (فحص ثابت) ----------
{
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const {errs, ver} = lintRules(rules);
  expect(!errs.length, '11: بنية القواعد: ' + errs.join(' | '));
  expect(ver === 'v23', '11: إصدار القواعد ' + ver);
  for (const [re, what] of [[/!existsAfter\(inviteDoc\(\)\)/, 'استهلاك الدعوة عند قبولها'], [/contentAt == request\.time/, 'وقت محتوى البلاغ من الخادم'],
    [/hasAny\(reportContent\(\)\)/, 'تعديل المحتوى يجدّد وقته'], [/allow read: if shownPublicly\(\)/, 'الصورة العامة للغرض العام فقط'],
    [/itemFresh\(itemId\) \|\| evidenceFromItem\(\)/, 'لا أدلة جديدة لغرض قديم'], [/request\.resource\.data\.get\('spot', ''\) == pubItem\(\)\.get\('spot', ''\)/, 'المكان الفارغ بمكان الإعلان القديم فقط'],
    [/d\.rejected\.join\(','\)\.size\(\) <= 3100/, 'حد «ليس غرضي»'], [/aiMatchOk\(d\.ai\.matches\[4\]\)/, 'حد نتائج المطابقة الذكية'], [/d\.lastSeen is number/, 'حد «آخر دخول»']])
    expect(re.test(rules), '11: القواعد بلا حراسة: ' + what);
  for (const f of ['js/state.js', 'js/firebase.js'])
    expect(!/'legacy'/.test(fs.readFileSync(path.join(root, f), 'utf8')), `11: محاولة 'legacy' الانتقالية ما زالت في ${f}`);
}

await browser.close(); server.close();
if (fails.length){ console.error(`✘ ${fails.length} من ${checks}:\n- ` + fails.join('\n- ')); process.exit(1); }
console.log(`✔ فحص الثغرات H39 سليم: ${checks} فحصاً (المقارنة النصية، والبلاغ السابق للعثور بوقت الخادم، والصورة المخفية، وتعديل الغرض، ورسالة الانقطاع، والطلب المجمّع، والنسخ، والخروج، وتوزيع الرموز، والقواعد v23).`);
