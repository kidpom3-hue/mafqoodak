// فحص الثغرات H39 وما بعدها (للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
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
// H40 (فحص شامل للموقع المنشور والكود؛ يفشل على الإصدار 60):
// 12) قيد التسليم بالرمز في السجل (لا يُعدَّل ولا يُحذف) بلا اسم المستلم وآخر 4 من هويته؛ من استلم من checks
// 13) نتيجة مطابقة ذكية تالفة في بلاغ قديم لا توقف «طلباتي»، والقائمة التي لا غرض متاحاً فيها = «لم يجد…»
// 14) تحديث عامل الخدمة يحذف نسخ مفقودك القديمة فقط، لا مخازن المواقع الأخرى على النطاق المشترك
// 15) رسالة واضحة لرفض سياسة كلمة المرور في Firebase وللبريد المسجّل بطريقة دخول أخرى
// H41 (فحص أعمق للأخطاء البرمجية بالزاحف tools/crawl.mjs؛ يفشل على الإصدار 61):
// 16) صفحة الغرض للموظف والإدارة لا تبقى على مؤشر التحميل حين تصل وحدة staff (ولو بدأ تحميلها قبلها)
// 17) «استخدم بلاغي» في طلب الاستلام يختار زر الإجابة الصحيح في أسئلة الاختيار (الشريحة)، والقيمة القديمة بنص حر تُفهم
// 18) تعديل بلاغ قديم إجابته بنص حر («STC») يُظهرها مختارة، فلا تضيع عند الحفظ
// 19) أسماء الأماكن بالإنجليزية تبقى بترتيب العربية مع سطر فارغ في القائمتين
// 20) الأسئلة المقترحة لغرض من تصنيف قديم (قوارير) بلا مفتاح ناقص يظهر نصاً
// 21) «حذف حسابي» يمسح الجهاز كالخروج (المفاتيح والمسودات والنسخة المحلية من القاعدة) ثم يعيد التحميل برسالة التأكيد
// 22) حذف البلاغ لا يكمل إن فشل حذف صورته (لا صورة يتيمة لا يقرؤها إلا المدير)
// 23) إجراء غير متزامن يفشل (تصدير CSV دون اتصال) يُظهر رسالة، واستثناء داخل الإرسال يعيد الزر للعمل برسالة
// 24) تبديل المكتب أثناء تحميل المُسلَّم أو سجل الطلبات أو البلاغات المغلقة لا يعرض بيانات المكتب السابق في الجديد
// 25) لا تسرّب في الاشتراكات: التنقل بين الصفحات وتبديل المكتب مراراً لا يزيد المستمعين المفتوحة (حصة القراءة والذاكرة)
// 26) «حفظ» تعديل البلاغ بلا تغيير لا يكتب وقت المحتوى ولا وقت التعديل (لا يفقد البلاغ صفة «سابق للعثور»)، وتعديل الوصف يكتبهما
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
// ls (H41): مفاتيح localStorage تُكتب قبل تحميل الصفحة، مثل catMig:<office> (لا يُرحَّل التصنيف القديم أثناء الفحص)
async function open({user = null, mode = 'visitor', db = base(), fake = {}, ls = {}} = {}){
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider {}'}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user, ...fake})};
    if (sessionStorage.getItem('test:out')) window.__FAKE.user = null;
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"ar"'); localStorage.setItem('mfq:mode', '"${mode}"');
    for (const [k, v] of Object.entries(${JSON.stringify(ls)})) localStorage.setItem('mfq:' + k, JSON.stringify(v));`);
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

// ---------- 12) H40: قيد التسليم بالرمز بلا اسم المستلم وآخر 4 من هويته (السجل لا يُعدَّل ولا يُحذف أبداً) ----------
{
  const d = {...base(), 'items/h1': item('h1', {status: 'reserved', reservedFor: 'h1_zed'}), 'itemSecrets/h1': secret(),
    'claims/h1_zed': {itemId: 'h1', officeId: O, uid: 'zed', no: 'REQ-H4AA', proof: 'غلاف أحمر', claimantName: 'زيد علي', idLast4: '1234', status: 'approved',
      decidedAt: now - 3600e3, decidedBy: 'staffA', pickupBy: now + 6 * day, createdAt: now - day, delegate: {name: 'سالم خالد', last4: '5678', at: now - 600e3}}};
  const {p, ctx} = await open({user: staff, mode: 'staff', db: d});
  const r = await p.evaluate(async () => {
    const wf = await import('./js/workflow.js'), st = await import('./js/state.js');
    const c = st.S.claims.find(x => x.id === 'h1_zed');
    try { await wf.verifyHandover(c, {name: 'سالم خالد', last4: '5678'}, ['ho.generic'], 'K7M3TX9P'); } catch (e){ return {err: e.msg || e.message}; }
    const lg = Object.values(window.__FAKE.db).find(x => x?.action === 'handover' && x.claimId === 'h1_zed');
    return {lg, note: window.__FAKE.db['claims/h1_zed']?.handoverNote};
  });
  expect(!r.err, '12: التسليم بالرمز فشل: ' + r.err);
  const leak = JSON.stringify(r.lg || {});
  expect(r.lg && !leak.includes('سالم') && !leak.includes('5678') && !leak.includes('1234'), '12: قيد التسليم في السجل فيه اسم المستلم أو آخر 4 من هويته ' + leak);
  expect(r.lg?.checks?.includes('ho.byDelegate'), '12: القيد لا يذكر أن المستلم مفوَّض');
  expect(String(r.note || '').includes('سالم') && String(r.note || '').includes('5678'), '12: اسم المستلم وآخر 4 لم يُحفظا في الطلب نفسه (handoverNote)');
  // سجل الحيازة في صفحة الغرض: من استلم (المفوَّض) نصاً من القاموس، بلا الاسم
  await go(p, 'item', {id: 'h1'}); await p.waitForTimeout(500);
  const tl = await p.evaluate(async () => ({text: document.querySelector('.timeline')?.innerText || '', role: (await import('./js/i18n.js')).t('ho.byDelegate')}));
  expect(tl.text.includes(tl.role), '12: سجل الحيازة لا يذكر أن المستلم مفوَّض ' + JSON.stringify(tl.text.slice(0, 300)));
  expect(!p.errs.length, '12: أخطاء: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 13) H40: نتيجة مطابقة ذكية تالفة في بلاغ قديم لا توقف «طلباتي» ----------
{
  const d = {...base(), 'items/a1': item('a1', {status: 'returned'}),
    'reports/rx': {officeId: O, uid: 'zed', cat: 'bags', title: 'حقيبتي', status: 'open', lostDate: ds(2), createdAt: now - day, ai: {at: now - 3600e3, matches: 'x'}},
    'reports/ry': {officeId: O, uid: 'zed', cat: 'bags', title: 'حقيبة أخرى', status: 'open', lostDate: ds(2), createdAt: now - day, ai: {at: now - 3600e3, matches: [null, 'x', {id: 'a1', reason: 'تشبهها'}, {id: 'gone'}]}}};
  const {p, ctx} = await open({user: zed, db: d});
  // خطأ أثناء الرسم يصل هنا (go يرميه) لا إلى pageerror، فنسجّله مثله
  await go(p, 'mine').catch(e => p.errs.push(String(e?.message || e).split('\n')[0])); await p.evaluate(() => document.querySelectorAll('#main details').forEach(x => { x.open = true; })); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    const t = (await import('./js/i18n.js')).t;
    const card = id => document.querySelector(`details[data-card="r:${id}"]`)?.innerText || '';
    return {x: card('rx'), y: card('ry'), aiLabel: t('rc.ai'), none: t('rc.aiNone', {when: ''}).trim().slice(0, 12)};
  });
  expect(!p.errs.length, '13: «طلباتي» توقفت ببلاغ فيه نتيجة مطابقة تالفة: ' + p.errs.join(' | '));
  expect(r.x.includes('حقيبتي') && r.y.includes('حقيبة أخرى'), '13: بطاقتا البلاغين لم تُرسما');
  expect(!r.y.includes(r.aiLabel) && r.y.includes(r.none), '13: قائمة مطابقة كل أغراضها غير متاحة تعرض العنوان فوق قائمة فارغة بدل «لم يجد…»');
  await ctx.close();
}

// ---------- 14) H40: تحديث عامل الخدمة يحذف نسخ مفقودك القديمة فقط (النطاق مشترك مع مواقع GitHub Pages الأخرى) ----------
{
  const {p, ctx} = await open();
  const r = await p.evaluate(async () => {
    for (const k of ['other-site-v1', 'mafqoodak-v1', 'mafqoodak-fonts-v1']) await (await caches.open(k)).put('/x-' + k, new Response('x'));
    const reg = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    for (let k = 0; k < 40 && !reg.active; k++) await new Promise(res => setTimeout(res, 100));
    await new Promise(res => setTimeout(res, 600));
    const keys = await caches.keys(); await reg.unregister();
    return keys;
  });
  const cur = 'mafqoodak-v' + (fs.readFileSync(path.join(root, 'js/config.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
  expect(r.includes('other-site-v1'), '14: تحديث عامل الخدمة حذف مخزن موقع آخر على النطاق نفسه ' + JSON.stringify(r));
  expect(!r.includes('mafqoodak-v1') && r.includes(cur) && r.includes('mafqoodak-fonts-v1'), '14: نسخ مفقودك: القديمة لم تُحذف أو الحالية والخطوط غير موجودة ' + JSON.stringify(r));
  await ctx.close();
}

// ---------- 15) H40: رسائل الدخول لسياسة كلمة المرور في Firebase وللبريد المسجّل بطريقة أخرى ----------
{
  const {p, ctx} = await open();
  const r = await p.evaluate(async () => { const st = await import('./js/state.js'), t = (await import('./js/i18n.js')).t;
    return {pol: st.authErr({code: 'auth/password-does-not-meet-requirements'}) === t('auth.weakPass'),
      other: st.authErr({code: 'auth/account-exists-with-different-credential'}) === t('auth.otherMethod')}; });
  expect(r.pol, '15: رفض سياسة كلمة المرور يظهر «تعذّر تسجيل الدخول» بلا سبب');
  expect(r.other, '15: البريد المسجّل بطريقة دخول أخرى يظهر «تعذّر تسجيل الدخول» بلا سبب');
  await ctx.close();
}

// ---------- 16) H41: صفحة الغرض للموظف والإدارة لا تبقى على مؤشر التحميل ----------
{
  const d = {...base(), 'items/h1': item('h1'), 'itemSecrets/h1': secret()};
  for (const pre of [false, true]){
    const {p, ctx} = await open({user: {uid: 'owner', displayName: 'Owner', email: 'o@example.com'}, mode: 'admin', db: d});
    // pre: تحميل staff بدأ من زر (load) قبل أن تطلبه الصفحة؛ كان need() لا يعلّق إعادة الرسم حينها
    await p.evaluate(async ([pre]) => { if (pre) (await import('./js/lazy.js')).load('staff'); (await import('./js/ui.js')).go('item', {id: 'h1'}); }, [pre]);
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => ({loading: !!document.querySelector('#main > .loading'), edit: !!document.querySelector('#main [data-act=editItem]')}));
    expect(!r.loading && r.edit, `16: صفحة الغرض للإدارة بقيت على مؤشر التحميل${pre ? ' (والتحميل بدأ قبلها)' : ''} ` + JSON.stringify(r));
    expect(!p.errs.length, '16: ' + p.errs.join(' | '));
    await ctx.close();
  }
}

// ---------- 17) H41: «استخدم بلاغي» يختار زر الإجابة الصحيح في أسئلة الاختيار ----------
{
  for (const [sim, want] of [['stc', 'stc'], ['اس تي سي', 'stc'], ['Mobily', 'mobily']]){
    const d = {...base(), 'items/p1': item('p1', {cat: 'phones', sub: 'جوال', title: 'جوال'}), 'itemSecrets/p1': secret(),
      'reports/rp': {officeId: O, uid: 'zed', cat: 'phones', sub: 'جوال', title: 'جوالي', status: 'open', lostDate: ds(2), createdAt: now - day, details: {sim, model: 'iPhone 13'}}};
    const {p, ctx} = await open({user: zed, db: d});
    await go(p, 'claim', {id: 'p1'});
    await click(p, '[data-act=useReport]', 400);
    const r = await p.evaluate(() => { const f = document.querySelector('form[data-form=claim]'); const rs = [...f.querySelectorAll('input[name=d_sim]')];
      return {checked: rs.find(x => x.checked)?.value ?? null, unknown: rs[0]?.value, sent: new FormData(f).get('d_sim'), model: f.querySelector('[name=d_model]')?.value}; });
    expect(r.checked === want && r.sent === want, `17: الشريحة «${sim}» من البلاغ: المختار ${r.checked} والمُرسل ${r.sent} (المتوقع ${want})`);
    expect(r.unknown === '', `17: زر «لا أعرف» تغيّرت قيمته إلى «${r.unknown}»`);
    expect(r.model === 'iPhone 13', '17: إجابة نصية من البلاغ لم تُعبّأ');
    expect(!p.errs.length, '17: ' + p.errs.join(' | '));
    await ctx.close();
  }
}

// ---------- 18) H41: تعديل بلاغ قديم إجابته بنص حر ----------
{
  const d = {...base(), 'reports/rq': {officeId: O, uid: 'zed', cat: 'phones', sub: 'جوال', title: 'جوالي', status: 'open', lostDate: ds(2), createdAt: now - day, details: {sim: 'STC'}}};
  const {p, ctx} = await open({user: zed, db: d});
  await go(p, 'report', {id: 'rq'});
  const r = await p.evaluate(() => { const f = document.querySelector('form[data-form=report]'); return f && new FormData(f).get('d_sim'); });
  expect(r === 'stc', `18: تعديل بلاغ إجابته «STC»: المختار «${r}» (تضيع الإجابة عند الحفظ)`);
  expect(!p.errs.length, '18: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 19) H41: أماكن المكتب بالإنجليزية بترتيب العربية مع سطر فارغ ----------
{
  const {p, ctx} = await open({user: {uid: 'owner', displayName: 'Owner', email: 'o@example.com'}, mode: 'admin'});
  await go(p, 'officeForm', {id: O});
  await fill(p, '#o-spots', 'المكتبة\n\nالكافتيريا\nالمعامل');
  await fill(p, '#o-spotsEn', 'Library\n\nCafeteria\nLabs');
  await p.evaluate(() => document.querySelector('form[data-form=office] button[type=submit]')?.click()); await p.waitForTimeout(900);
  const o = (await db(p))['offices/tc-ahsa'];
  expect(JSON.stringify(o?.spots) === JSON.stringify(['المكتبة', 'الكافتيريا', 'المعامل']) && JSON.stringify(o?.spotsEn) === JSON.stringify(['Library', 'Cafeteria', 'Labs']),
    '19: الأماكن بالإنجليزية لا تطابق ترتيب العربية: ' + JSON.stringify([o?.spots, o?.spotsEn]));
  expect(!p.errs.length, '19: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 20) H41: الأسئلة المقترحة لغرض من تصنيف قديم (قوارير) ----------
{
  const d = {...base(), 'items/b1': item('b1', {cat: 'bottles', sub: 'قارورة ماء', title: 'قارورة ماء'}), 'itemSecrets/b1': secret(),
    'claims/b1_zed': {itemId: 'b1', officeId: O, uid: 'zed', no: 'REQ-B1AA', proof: 'قارورة زرقاء عليها ملصق', claimantName: 'زيد علي', idLast4: '1234', status: 'pending', createdAt: now - 3600e3}};
  // الترحيل إلى «أخرى» لم يتم بعد على هذا الجهاز (أو فشل): الغرض ما زال بالتصنيف القديم
  const {p, ctx} = await open({user: staff, mode: 'staff', db: d, ls: {'catMig:tc-ahsa': true}});
  const warns = []; p.on('console', m => { if (m.text().includes('[i18n] missing')) warns.push(m.text()); });
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'ask'; b.dataset.id = 'b1_zed'; document.querySelector('#main').append(b); b.click(); });
  await p.waitForTimeout(400);
  const chips = await p.evaluate(() => [...document.querySelectorAll('#sheet [data-act=qaSuggest]')].map(b => b.dataset.v));
  expect(chips.length && !chips.some(c => c.startsWith('qa.sug')), '20: اقتراح سؤال يظهر اسم مفتاح ناقص: ' + JSON.stringify(chips));
  expect(!warns.length, '20: ' + warns.join(' | '));
  await ctx.close();
}

// ---------- 21) H41: «حذف حسابي» يمسح الجهاز كالخروج ----------
{
  const g = {...zed, providerData: [{providerId: 'google.com'}]};
  const d = {...base(), 'users/zed/private/codes': {codes: {}}};
  const {p, ctx} = await open({user: g, db: d});
  const KEYS = ['snoozed', 'suggHold', 'suggAlert', 'rateAt', 'mineTab', 'codes', 'seen', 'prof', 'notify', 'staffSeen'];
  await p.evaluate(keys => { for (const k of keys) localStorage.setItem('mfq:' + k, JSON.stringify(k === 'rateAt' ? Date.now() : ['x']));
    localStorage.setItem('mfq:theme', '"dark"'); sessionStorage.setItem('mfq:codes', '{"x":"K7M3TX9P"}'); sessionStorage.setItem('mfq:draft:report', '{}');
    localStorage.removeItem('test:cleared'); }, KEYS);
  await click(p, '[data-act=account]', 400);
  await click(p, '#sheet [data-act=deleteAccount]', 400);
  // بعد إعادة التحميل يبقى المستخدم خارجاً (حذف الحساب)، فلا يُكتب ملفه المختصر (prof) من جديد
  await p.evaluate(() => { sessionStorage.setItem('test:out', '1'); document.querySelector('#sheet form[data-form=delAccount] button[type=submit]')?.click(); });
  await p.waitForTimeout(2600);
  const r = await p.evaluate(keys => ({left: keys.filter(k => localStorage.getItem('mfq:' + k) !== null), theme: localStorage.getItem('mfq:theme'),
    ss: ['mfq:codes', 'mfq:draft:report'].filter(k => sessionStorage.getItem(k) !== null), cleared: localStorage.getItem('test:cleared'),
    toast: document.querySelector('#toast')?.textContent || '', users: !!window.__FAKE.db['users/zed']}), KEYS);
  const want = await p.evaluate(async () => (await import('./js/i18n.js')).t('a.deleted'));
  expect(!r.left.length, '21: بقي على الجهاز بعد «حذف حسابي»: ' + r.left.join(', '));
  expect(!r.ss.length, '21: بقي في الجلسة بعد «حذف حسابي»: ' + r.ss.join(', '));
  expect(r.cleared === '1', '21: النسخة المحلية من القاعدة لم تُمسح بعد «حذف حسابي»');
  expect(r.theme === '"dark"', '21: «حذف حسابي» مسح المظهر (يخص الجهاز لا الحساب)');
  expect(r.toast.includes(want), '21: لا رسالة «تم حذف الحساب» بعد إعادة التحميل: ' + JSON.stringify(r.toast));
  expect(!p.errs.length, '21: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 22) H41: حذف البلاغ لا يكمل إن فشل حذف صورته ----------
{
  const d = {...base(), 'reports/rz': {officeId: O, uid: 'zed', cat: 'bags', title: 'حقيبتي', status: 'open', lostDate: ds(2), createdAt: now - day, photo: true}, 'reportPhotos/rz': {data: IMG}};
  const {p, ctx} = await open({user: zed, db: d, fake: {deny: '^reportPhotos/'}});
  await go(p, 'mine');
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'delReport'; b.dataset.id = 'rz'; document.querySelector('#main').append(b); b.click(); });
  await p.waitForTimeout(400);
  await click(p, '#sheet [data-act=confirmYes]', 900);
  const left = await db(p);
  expect(!!left['reports/rz'] && !!left['reportPhotos/rz'], '22: حُذف البلاغ وبقيت صورته وحدها (أو حُذفت الصورة رغم الرفض) ' + JSON.stringify([!!left['reports/rz'], !!left['reportPhotos/rz']]));
  expect(!p.errs.length, '22: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 23) H41: فشل إجراء غير متزامن أو استثناء داخل الإرسال ----------
{
  // أ) وحدة الإحصاءات لا تُحمَّل (انقطاع قبل حفظها في الجهاز): «تصدير CSV» يرمي داخل إجراء غير متزامن
  const {p, ctx} = await open();
  const rej = []; await p.exposeFunction('__rej', s => rej.push(s));
  await p.evaluate(() => addEventListener('unhandledrejection', e => window.__rej(String(e.reason?.message || e.reason))));
  await p.route(/\/js\/stats\.js/, r => r.abort());
  const pre = await p.evaluate(async () => !!(await import('./js/lazy.js')).mod('stats'));
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'exportCsv'; b.dataset.id = 'tc-ahsa'; document.querySelector('#main').append(b); b.click(); });
  await p.waitForTimeout(700);
  const t1 = await p.evaluate(async () => { const t = (await import('./js/i18n.js')).t; return {toast: document.querySelector('#toast')?.textContent || '', want: [t('err.load'), t('err.offlineNow')]}; });
  expect(!pre, '23: وحدة الإحصاءات محمّلة قبل الفحص (الفحص لا يختبر شيئاً)');
  expect(!rej.length, '23: فشل إجراء غير متزامن وعد مرفوض بلا معالجة: ' + rej.join(' | '));
  expect(t1.want.some(w => t1.toast.includes(w)), '23: فشل إجراء غير متزامن بلا رسالة للمستخدم: ' + JSON.stringify(t1.toast));
  await ctx.close();
}
{
  // ب) تعذّر تحميل أغراض المكتب للتصدير: رسالة خطأ لا «لا توجد أغراض للتصدير»، والضغط التالي يعيد المحاولة
  const d = {...base(), 'items/h1': item('h1'), 'itemSecrets/h1': secret()};
  const {p, ctx} = await open({user: staff, mode: 'staff', db: d});
  await p.evaluate(async () => { (await import('./js/state.js')).S.stats = {}; await (await import('./js/lazy.js')).load('stats'); window.__FAKE.listErr = '^items$'; });
  const csv = () => p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'exportCsv'; b.dataset.id = 'tc-ahsa'; document.querySelector('#main').append(b); b.click(); }).then(() => p.waitForTimeout(800));
  await csv();
  const r1 = await p.evaluate(async () => { const t = (await import('./js/i18n.js')).t; return {toast: document.querySelector('#toast')?.textContent || '', load: t('err.load'), empty: t('sx.csvEmpty')}; });
  expect(r1.toast.includes(r1.load) && !r1.toast.includes(r1.empty), '23: تعذّر تحميل الأغراض فظهر للتصدير: ' + JSON.stringify(r1.toast));
  await p.evaluate(() => { window.__FAKE.listErr = ''; document.querySelector('#toast').textContent = ''; });
  const dl = p.waitForEvent('download', {timeout: 3000}).catch(() => null);
  await csv();
  expect(!!(await dl), '23: بعد عودة الاتصال لا يعيد «تصدير CSV» المحاولة (بقي الفشل محفوظاً)');
  expect(!p.errs.length, '23: ' + p.errs.join(' | '));
  await ctx.close();
}
{
  // د) «تصدير CSV» أثناء تحميل الإحصاءات (مثل تحديثها الآلي عند فتح اللوحة) ينتظره، لا «لا توجد أغراض للتصدير»
  const d = {...base(), 'items/h1': item('h1'), 'itemSecrets/h1': secret()};
  const {p, ctx} = await open({user: staff, mode: 'staff', db: d});
  await p.evaluate(async () => { (await import('./js/state.js')).S.stats = {}; const m = await (await import('./js/lazy.js')).load('stats'); window.__FAKE.slow = 400; m.loadStats('tc-ahsa'); });
  const dl = p.waitForEvent('download', {timeout: 4000}).catch(() => null);
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'exportCsv'; b.dataset.id = 'tc-ahsa'; document.querySelector('#main').append(b); b.click(); });
  const got = await dl;
  const toast = await p.evaluate(() => document.querySelector('#toast')?.textContent || '');
  expect(!!got, '23: «تصدير CSV» أثناء تحميل الإحصاءات لم ينتظره: ' + JSON.stringify(toast));
  await ctx.close();
}
{
  // ج) استثناء غير متوقع داخل الإرسال (هنا: FormData): الزر يعود للعمل ورسالة في النموذج
  const {p, ctx} = await open({user: zed});
  const rej = []; await p.exposeFunction('__rej', s => rej.push(s));
  await p.evaluate(() => addEventListener('unhandledrejection', e => window.__rej(String(e.reason?.message || e.reason))));
  await go(p, 'report');
  const r = await p.evaluate(async () => {
    const f = document.querySelector('form[data-form=report]'); const FD = window.FormData;
    (await import('./js/actions.js')).showStep(f, 3);
    window.FormData = class { constructor(){ throw new TypeError('boom'); } };
    f.querySelector('button[type=submit]').click(); await new Promise(res => setTimeout(res, 300));
    window.FormData = FD;
    const b = f.querySelector('button[type=submit]'), e = f.querySelector('.form-err');
    return {disabled: b.disabled, err: e && !e.hidden ? e.textContent : '', want: (await import('./js/i18n.js')).t('err.save')};
  });
  expect(!rej.length, '23: استثناء داخل الإرسال وعد مرفوض بلا معالجة: ' + rej.join(' | '));
  expect(!r.disabled && r.err === r.want, '23: بعد استثناء داخل الإرسال: الزر معطّل أو لا رسالة ' + JSON.stringify(r));
  await ctx.close();
}

// ---------- 24) H41: تبديل المكتب أثناء تحميل عند الطلب ----------
{
  const d = {...base(), 'offices/apt-x': {name: 'مطار', short: 'المطار', type: 'airport', city: 'الدمام', retentionDays: 60, pickupDays: 5, spots: ['الصالة'], active: true, createdAt: 2, code: 'APX'},
    'items/r1': item('r1', {status: 'returned', returnedAt: now - day}),
    'claims/r1_zed': {itemId: 'r1', officeId: O, uid: 'zed', no: 'REQ-R1AA', proof: 'x', status: 'done', doneAt: now - day, createdAt: now - 2 * day},
    'reports/rc': {officeId: O, uid: 'zed', cat: 'bags', title: 'حقيبتي', status: 'closed', closedReason: 'self', closedAt: now - day, createdAt: now - 2 * day}};
  const {p, ctx} = await open({user: {uid: 'owner', displayName: 'Owner', email: 'o@example.com'}, mode: 'admin', db: d});
  const r = await p.evaluate(async () => {
    const st = await import('./js/state.js');
    st.setOffice('tc-ahsa', true); await new Promise(res => setTimeout(res, 300));
    window.__FAKE.slow = 400;
    st.loadExtraItems('returned'); st.loadClaimHistory(); st.loadClosedReports();
    await new Promise(res => setTimeout(res, 50));
    st.setOffice('apt-x', true);
    await new Promise(res => setTimeout(res, 1500));
    window.__FAKE.slow = 0;
    return {office: st.S.officeId, extra: (st.S.extraItems.returned || []).map(i => i.id), hist: (st.S.claimHist || []).map(c => c.id), closed: (st.S.closedReps || []).map(x => x.id)};
  });
  expect(r.office === 'apt-x', '24: لم يتبدل المكتب ' + r.office);
  expect(!r.extra.length && !r.hist.length && !r.closed.length, '24: بيانات المكتب السابق ظهرت في الجديد بعد تبديله أثناء التحميل ' + JSON.stringify(r));
  expect(!p.errs.length, '24: ' + p.errs.join(' | '));
  await ctx.close();
}

// ---------- 25) H41: لا تسرّب في الاشتراكات ----------
{
  const d = {...base(), 'offices/apt-x': {name: 'مطار', short: 'المطار', type: 'airport', city: 'الدمام', retentionDays: 60, pickupDays: 5, spots: ['الصالة'], active: true, createdAt: 2, code: 'APX'},
    'items/h1': item('h1'), 'itemSecrets/h1': secret(), 'items/h2': item('h2', {status: 'returned', returnedAt: now - day}), 'itemSecrets/h2': secret(),
    'claims/h1_zed': {itemId: 'h1', officeId: O, uid: 'zed', no: 'REQ-H1AA', proof: 'x', status: 'pending', createdAt: now - 3600e3},
    'reports/rp': {officeId: O, uid: 'zed', cat: 'bags', title: 'حقيبتي', status: 'open', lostDate: ds(2), createdAt: now - day}};
  for (const [who, mode, steps] of [[zed, 'visitor', [['browse'], ['item', {id: 'h1'}], ['mine'], ['regs'], ['report', {id: 'rp'}], ['home']]],
    [staff, 'staff', [['staff', {tab: 'items'}], ['item', {id: 'h1'}], ['item', {id: 'h2'}], ['staff', {tab: 'claims'}], ['staff', {tab: 'reports'}], ['stats', {office: O}]]],
    [{uid: 'owner', displayName: 'Owner', email: 'o@example.com'}, 'admin', 'office']]){
    const {p, ctx} = await open({user: who, mode, db: d});
    const loop = async () => {
      if (steps === 'office'){ for (const o of ['apt-x', 'tc-ahsa']){ await p.evaluate(async o => (await import('./js/state.js')).setOffice(o, true), o); await p.waitForTimeout(300); } return; }
      for (const [r, pr] of steps){ await go(p, r, pr || {}); }
    };
    await loop(); await go(p, 'home'); const a = await p.evaluate(() => window.__listeners().length);
    for (let k = 0; k < 3; k++) await loop();
    await go(p, 'home'); const b = await p.evaluate(() => window.__listeners());
    expect(b.length <= a, `25: الاشتراكات المفتوحة زادت بعد تكرار التنقل (${who.uid}/${mode}): ${a} → ${b.length}`);
    const dup = Object.entries(b.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {})).filter(([, n]) => n > 1);
    expect(!dup.length, `25: اشتراك مكرر (${who.uid}/${mode}): ` + JSON.stringify(dup));
    expect(!p.errs.length, '25: ' + p.errs.join(' | '));
    await ctx.close();
  }
}

// ---------- 26) H41: تعديل البلاغ بلا تغيير لا يجدّد وقت المحتوى ----------
{
  const C0 = now - 5 * day;
  const d = {...base(), 'reports/rq': {officeId: O, uid: 'zed', cat: 'bags', sub: 'حقيبة ظهر', color: 'black', title: 'حقيبتي السوداء', desc: 'عليها ميدالية', spot: 'المكتبة', bldg: '', room: '',
    status: 'open', lostDate: ds(6), createdAt: C0, contentAt: C0}};
  const {p, ctx} = await open({user: zed, db: d});
  await go(p, 'report', {id: 'rq'});
  await submitStep(p, 'form[data-form=report]');
  const a = (await db(p))['reports/rq'];
  const w1 = await p.evaluate(() => window.__FAKE.writes.filter(w => w[1] === 'reports/rq').length);
  expect(a.contentAt === C0 && !a.editedAt && !w1, '26: «حفظ» بلا تغيير جدّد وقت المحتوى أو التعديل ' + JSON.stringify({contentAt: a.contentAt === C0 ? 'كما هو' : a.contentAt, editedAt: a.editedAt, writes: w1}));
  await go(p, 'report', {id: 'rq'});
  await fill(p, '#r-desc', 'عليها ميدالية زرقاء');
  await submitStep(p, 'form[data-form=report]');
  const b = (await db(p))['reports/rq'];
  expect(b.desc === 'عليها ميدالية زرقاء' && b.contentAt !== C0 && b.editedAt, '26: تعديل الوصف لم يكتب وقت المحتوى والتعديل ' + JSON.stringify({desc: b.desc, contentAt: b.contentAt, editedAt: b.editedAt}));
  expect(!p.errs.length, '26: ' + p.errs.join(' | '));
  await ctx.close();
}

await browser.close(); server.close();
if (fails.length){ console.error(`✘ ${fails.length} من ${checks}:\n- ` + fails.join('\n- ')); process.exit(1); }
console.log(`✔ فحص الثغرات H39 وH40 وH41 سليم: ${checks} فحصاً (المقارنة النصية، والبلاغ السابق للعثور بوقت الخادم، والصورة المخفية، وتعديل الغرض، ورسالة الانقطاع، والطلب المجمّع، والنسخ، والخروج، وتوزيع الرموز، والقواعد v23؛ H40: سجل التسليم بلا بيانات شخصية، ونتيجة المطابقة التالفة، ومخازن عامل الخدمة، ورسائل الدخول؛ H41: صفحة الغرض للإدارة، وإجابات الاختيار من البلاغ وفي التعديل، وأماكن المكتب بالإنجليزية، والأسئلة المقترحة، وحذف الحساب، وحذف البلاغ، وفشل الإجراءات، وتبديل المكتب أثناء التحميل، وتسرّب الاشتراكات، وتعديل البلاغ بلا تغيير).`);
