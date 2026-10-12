// فحص إثبات الملكية (H33، للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
// الحالات: «سجل أغراضي» (تسجيل بوقت الخادم، ورفض بلا معرّف، ولا نقود ولا وثائق)، وطلب استلام يرفق نسخة السجل،
// وقوة الإثبات للموظف (قوي بالرقم التسلسلي والسجل السابق، وضعيف مع تنبيه أحمر عند اختلافه)، وسبب مكتوب لقبول الثمين الضعيف،
// والتفويض بالاستلام (لا في الوثائق الرسمية)، والتسليم لصاحب الطلب أو مفوَّضه فقط، وإيصال التسليم المطبوع.
// التشغيل: cd tools && npm run proof   (لمتصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run proof)
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
const item = (id, x = {}) => ({officeId: O, ref: 'TCA-' + id.toUpperCase(), cat: 'phones', sub: 'جوال', title: 'جوال', foundDate: ds(2), photo: false, status: 'available', createdBy: 'staffA', createdAt: now - day, updatedAt: now, sample: false, keepUntil: now + 90 * day, ...x, public: (x.cat ?? 'phones') !== 'cash'});
const secret = (x = {}) => ({officeId: O, title: 'جوال', color: '', brand: '', desc: '', spot: 'المكتبة', bldg: '', room: '', storage: '', ...x});
const claim = (itemId, uid, x = {}) => ({itemId, officeId: O, uid, no: 'REQ-' + itemId.toUpperCase().slice(0, 4), proof: 'x', color: '', brand: '', lostSpot: '', lostDate: ds(3), claimantName: 'Zed', idLast4: '1234', status: 'pending', createdAt: now - 3600e3, ...x});
const base = () => ({
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', type: 'college', city: 'الأحساء', place: 'المبنى الإداري', retentionDays: 90, pickupDays: 7, reviewDays: 2, spots: ['المكتبة', 'الكافتيريا'], active: true, createdAt: 1, code: 'TCA'},
  'staff/staffA': {offices: [O]}, 'users/zed': {name: 'Zed'}, 'users/staffA': {name: 'Staff'},
});
const SERIAL = 'F2LXK9ABCD';
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'}, staff = {uid: 'staffA', displayName: 'Staff', email: 's@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) fails.push(msg); };

async function open(user, mode, db){
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider {}'}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})};
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"ar"'); localStorage.setItem('mfq:mode', '"${mode}"');`);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(700);
  return {p, ctx, errs};
}
const go = (p, r, params = {}, set = {}) => p.evaluate(async ([r, params, set]) => { const st = await import('./js/state.js'); Object.assign(st.S, set); (await import('./js/ui.js')).go(r, params); }, [r, params, set]).then(() => p.waitForTimeout(700));
const db = p => p.evaluate(() => window.__FAKE.db);
const T = (p, k, v) => p.evaluate(async ([k, v]) => (await import('./js/i18n.js')).t(k, v), [k, v]);
const fill = (p, sel, v) => p.evaluate(([sel, v]) => { const e = document.querySelector(sel); if (e){ e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); } return !!e; }, [sel, v]);
const tick = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (e){ e.checked = true; e.dispatchEvent(new Event('change', {bubbles: true})); } return !!e; }, sel);
const click = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); e?.click(); return !!e; }, sel).then(ok => p.waitForTimeout(500).then(() => ok));
const submit = (p, sel) => p.evaluate(sel => { const f = document.querySelector(sel); f?.requestSubmit(); return !!f; }, sel).then(ok => p.waitForTimeout(900).then(() => ok));
const text = (p, sel) => p.evaluate(sel => document.querySelector(sel)?.textContent || '', sel);
const err = (p, scope = '') => p.evaluate(s => { const e = document.querySelector(s + ' .form-err'); return e && !e.hidden ? e.textContent : ''; }, scope);

// ---------- 1) «سجل أغراضي»: تسجيل بوقت الخادم، ومعرّف إلزامي، ولا نقود ولا وثائق ----------
{
  const {p, ctx, errs} = await open(zed, 'visitor', base());
  await go(p, 'regs');
  expect(await p.evaluate(() => !!document.querySelector('[data-view=regs] .empty')), 'السجل: لا رسالة «لا أغراض مسجّلة» في البداية');
  await go(p, 'regAdd');
  expect(await p.evaluate(() => !document.querySelector('form[data-form=reg] input[name=cat][value=cash]') && !document.querySelector('form[data-form=reg] input[name=cat][value=ids]')), 'السجل: النقود أو الوثائق في قائمة التصنيفات');
  await click(p, 'form[data-form=reg] input[name=cat][value=phones]');
  expect(await p.evaluate(() => !document.querySelector('#subs-field').hidden), 'السجل: أنواع التصنيف لم تظهر بعد اختياره');
  await fill(p, '#rg-title', 'جوال الدراسة'); await fill(p, '#rg-brand', 'Apple');
  await submit(p, 'form[data-form=reg]');
  expect((await err(p)) === await T(p, 'rg.needId'), 'السجل: قُبل بلا رقم تسلسلي ولا علامة');
  await fill(p, '#rg-serial', ' f2lx k9abcd ');
  await submit(p, 'form[data-form=reg]');
  const d = await db(p), regs = Object.entries(d).filter(([k]) => k.startsWith('belongings/'));
  expect(regs.length === 1, `السجل: عدد التسجيلات ${regs.length}`);
  const g = regs[0]?.[1] || {};
  expect(g.uid === 'zed' && g.cat === 'phones' && g.serial === SERIAL && g.brand === 'Apple' && typeof g.at === 'number', 'السجل: بيانات التسجيل غير صحيحة ' + JSON.stringify(g));
  expect(!!d['rate/zed'], 'السجل: بلا حدّ الإغراق (rate)');
  expect(await p.evaluate(() => document.querySelector('#main')?.firstElementChild?.dataset.view) === 'regs', 'السجل: لم يعد إلى صفحة السجل بعد الحفظ');
  expect((await text(p, '.reg-card')).includes(SERIAL), 'السجل: البطاقة لا تعرض الرقم التسلسلي');
  expect(!errs.length, 'السجل: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 2) طلب استلام يرفق نسخة من السجل ويعبّئ صفاته ----------
{
  const reg = {uid: 'zed', cat: 'phones', title: 'جوال الدراسة', brand: 'Apple', model: 'iPhone 13', serial: SERIAL, at: now - 10 * day};
  const {p, ctx, errs} = await open(zed, 'visitor', {...base(), 'items/p1': item('p1'), 'itemSecrets/p1': secret(), 'belongings/g1': reg, 'items/b1': item('b1', {cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر'})});
  await go(p, 'claim', {id: 'b1'});
  expect(await p.evaluate(() => !document.querySelector('[data-act=useReg]')), 'الطلب: زر السجل ظهر في تصنيف آخر (حقيبة)');
  await go(p, 'claim', {id: 'p1'});
  expect(await p.evaluate(() => !!document.querySelector('#cf-serial') && !document.querySelector('#cf-serial').closest('#cl-more')), 'الطلب: خانة الرقم التسلسلي ليست ظاهرة في الخطوة الأولى');
  expect(await click(p, '[data-act=useReg][data-id=g1]'), 'الطلب: زر «سجل أغراضي» لم يظهر');
  expect(await p.evaluate(() => document.querySelector('#cf-serial')?.value) === SERIAL && await p.evaluate(() => document.querySelector('#cf-brand')?.value) === 'Apple', 'الطلب: لم تُعبّأ الصفات من السجل');
  // النموذج بثلاث خطوات: «إرسال» في الخطوة الأخيرة فقط (قبلها ينقل إلى التالية)
  await p.evaluate(async () => { const f = document.querySelector('form[data-form=claim]'); (await import('./js/actions.js')).showStep(f, 3); });
  await fill(p, '#c-last4', '1234'); await tick(p, '#pledge');
  await submit(p, 'form[data-form=claim]');
  const c = (await db(p))['claims/p1_zed'];
  expect(!!c, 'الطلب: لم يُرسل ' + (await err(p)));
  expect(c?.reg?.id === 'g1' && c.reg.at === reg.at && c.reg.serial === SERIAL && c.reg.cat === 'phones' && !('uid' in (c.reg || {})), 'الطلب: نسخة السجل غير مطابقة ' + JSON.stringify(c?.reg));
  expect(c?.details?.serial === 'ABCD', 'الطلب: الرقم التسلسلي لم يُحفظ آخر 4 خانات ' + JSON.stringify(c?.details));
  expect(!errs.length, 'الطلب: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 3) قوة الإثبات عند الموظف، وسبب مكتوب لقبول الثمين الضعيف ----------
{
  const regSnap = {id: 'g1', at: now - 10 * day, cat: 'phones', title: 'جوال الدراسة', serial: SERIAL};
  const {p, ctx, errs} = await open(staff, 'staff', {...base(),
    'items/s1': item('s1'), 'itemSecrets/s1': secret({details: {serial: 'ABCD'}}),
    'items/s2': item('s2'), 'itemSecrets/s2': secret({details: {serial: 'ZZ99'}}),
    'items/s3': item('s3'), 'itemSecrets/s3': secret({color: 'black'}),
    'items/s4': item('s4', {cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر'}), 'itemSecrets/s4': secret({color: 'black'}),
    'claims/s1_zed': claim('s1', 'zed', {details: {serial: 'ABCD'}, reg: regSnap}),
    'claims/s2_amy': claim('s2', 'amy', {details: {serial: 'ABCD'}}),
    'claims/s3_bo': claim('s3', 'bo', {color: 'red'}),
    'claims/s4_cy': claim('s4', 'cy', {color: 'red'})});
  await go(p, 'staff', {tab: 'claims'});
  await p.evaluate(() => document.querySelectorAll('details.mcard').forEach(d => { d.open = true; })); await p.waitForTimeout(300);
  const card = id => p.evaluate(id => { const c = document.querySelector(`details[data-card="s:${id}"]`); if (!c) return null;
    return {strength: c.querySelector('.strength .pill')?.textContent || '', miss: !!c.querySelector('.uniq-miss'), regPill: [...c.querySelectorAll('.pill.prior')].map(x => x.textContent).join('|'), regAt: c.querySelector('.cmp-reg-at')?.className || ''}; }, id);
  const s1 = await card('s1_zed'), s2 = await card('s2_amy'), s3 = await card('s3_bo');
  expect(s1?.strength === await T(p, 'st.str.strong'), 'القوة: الرقم التسلسلي المطابق مع السجل ليس «إثبات قوي»: ' + s1?.strength);
  expect(s1?.regPill.includes(await T(p, 'st.regPill')) && s1?.regAt.includes('ok'), 'القوة: «مسجّل قبل العثور» لم يظهر');
  expect(s2?.miss && s2?.strength === await T(p, 'st.str.weak'), 'القوة: رقم تسلسلي مختلف بلا تنبيه أحمر أو ليس ضعيفاً');
  expect(s3?.strength === await T(p, 'st.str.weak'), 'القوة: لون مختلف فقط ليس ضعيفاً');
  // قبول: المعرّف المختلف والثمين الضعيف يطلبان سبباً، وغير الثمين الضعيف تأكيداً فقط
  await click(p, '[data-act=approve][data-id=s2_amy]');
  expect((await text(p, '#sheet h2')).includes(await T(p, 'a.uniqMissTitle')) && await p.evaluate(() => !!document.querySelector('#sheet form[data-form=approveWhy]')), 'القبول: معرّف مختلف بلا نافذة السبب');
  await p.evaluate(async () => (await import('./js/ui.js')).closeSheet()); await p.waitForTimeout(300);
  await click(p, '[data-act=approve][data-id=s3_bo]');
  expect((await text(p, '#sheet h2')).includes(await T(p, 'a.weakHvTitle')), 'القبول: جوال بإثبات ضعيف بلا نافذة السبب');
  await p.evaluate(async () => (await import('./js/ui.js')).closeSheet()); await p.waitForTimeout(300);
  await click(p, '[data-act=approve][data-id=s4_cy]');
  expect(await p.evaluate(() => !document.querySelector('#sheet form[data-form=approveWhy]') && !!document.querySelector('#sheet [data-act=confirmYes]')), 'القبول: حقيبة بإثبات ضعيف طلبت سبباً بدل التأكيد');
  await p.evaluate(async () => (await import('./js/ui.js')).closeSheet()); await p.waitForTimeout(300);
  await click(p, '[data-act=approve][data-id=s1_zed]');
  const st = (await db(p))['claims/s1_zed']?.status;
  expect(st === 'approved', 'القبول: الإثبات القوي لم يُقبل مباشرة (' + st + ')');
  expect(!errs.length, 'القوة: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 4) التفويض بالاستلام (صاحب الطلب) ----------
const appr = (itemId, x = {}) => claim(itemId, 'zed', {status: 'approved', decidedAt: now - 3600e3, decidedBy: 'staffA', pickupBy: now + 6 * day, ...x});
const db4 = () => ({...base(),
  'items/d1': item('d1', {cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر', status: 'reserved', reservedFor: 'd1_zed'}), 'itemSecrets/d1': secret(),
  'claims/d1_zed': appr('d1'), 'users/zed/private/codes': {codes: {d1_zed: 'K7M3TX9P'}},
  'items/id1': item('id1', {cat: 'ids', sub: 'بطاقة متدرب', title: 'بطاقة متدرب', status: 'reserved', reservedFor: 'g_zed_ids_1'}),
  'claims/g_zed_ids_1': appr('id1', {grouped: true, cat: 'ids'})});
let afterDelegate = null;
{
  const {p, ctx, errs} = await open(zed, 'visitor', db4());
  await go(p, 'mine', {}, {});
  await p.evaluate(() => document.querySelectorAll('details.mcard').forEach(d => { d.open = true; })); await p.waitForTimeout(300);
  expect(await p.evaluate(() => !document.querySelector('details[data-card="c:g_zed_ids_1"] [data-act=delegate]')), 'التفويض: ظهر زر التفويض لوثيقة رسمية');
  expect(await click(p, 'details[data-card="c:d1_zed"] [data-act=delegate]'), 'التفويض: لا زر «تفويض شخص بالاستلام»');
  await fill(p, '#dg-name', 'سالم أخو زد'); await fill(p, '#dg-4', '1234'); await tick(p, '#sheet input[name=pledge]');
  await submit(p, 'form[data-form=delegate]');
  expect((await err(p, '#sheet')) === await T(p, 'dg.sameAsYou'), 'التفويض: قُبلت آخر 4 أرقام صاحب الطلب نفسه');
  await fill(p, '#dg-4', '5678'); await submit(p, 'form[data-form=delegate]');
  afterDelegate = await db(p);
  const dl = afterDelegate['claims/d1_zed']?.delegate;
  expect(dl?.name === 'سالم أخو زد' && dl?.last4 === '5678' && typeof dl?.at === 'number', 'التفويض: لم يُحفظ ' + JSON.stringify(dl));
  expect((await text(p, 'details[data-card="c:d1_zed"] .deleg')).includes('5678'), 'التفويض: لا يظهر المفوَّض في البطاقة');
  expect(!errs.length, 'التفويض: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 5) التسليم لصاحب الطلب أو مفوَّضه فقط، ثم الإيصال ----------
{
  const {p, ctx, errs} = await open(staff, 'staff', afterDelegate);
  await go(p, 'staff', {tab: 'claims'});
  await p.evaluate(() => document.querySelectorAll('details.mcard').forEach(d => { d.open = true; })); await p.waitForTimeout(300);
  expect((await text(p, 'details[data-card="s:d1_zed"] .deleg')).includes('5678'), 'التسليم: الموظف لا يرى المفوَّض في البطاقة');
  expect(await click(p, '[data-act=verify][data-id=d1_zed]'), 'التسليم: لا زر «تحقق وسلّم»');
  expect(await p.evaluate(() => document.querySelector('#vf-4')?.value === ''), 'التسليم: آخر 4 أرقام معبّأة مسبقاً');
  expect(await p.evaluate(() => !document.querySelector('#sheet input[name=override]')), 'التسليم: مربع تجاوز الإدارة ظهر لموظف');
  await fill(p, '#sheet input[name=code]', 'K7M3-TX9P'); await fill(p, '#vf-name', 'سالم'); await fill(p, '#vf-4', '9999');
  await p.evaluate(() => document.querySelectorAll('#sheet input[type=checkbox][required]').forEach(x => { x.checked = true; x.dispatchEvent(new Event('change', {bubbles: true})); }));
  await submit(p, 'form[data-form=verify]');
  expect((await err(p, '#sheet')) === await T(p, 'wf.receiverMismatchD'), 'التسليم: سُلّم لهوية لا تطابق صاحب الطلب ولا المفوَّض');
  expect((await db(p))['claims/d1_zed']?.status === 'approved', 'التسليم: تغيّرت حالة الطلب رغم عدم التطابق');
  await fill(p, '#vf-4', '5678'); await submit(p, 'form[data-form=verify]');
  const d = await db(p), c = d['claims/d1_zed'];
  expect(c?.status === 'done' && String(c.handoverNote || '').startsWith('استلمه المفوَّض'), 'التسليم: لم يُسلَّم للمفوَّض ' + JSON.stringify({s: c?.status, n: c?.handoverNote, e: await err(p, '#sheet')}));
  const lg = Object.values(d).find(x => x?.action === 'handover' && x.claimId === 'd1_zed');
  expect(lg?.checks?.includes('ho.byDelegate'), 'التسليم: السجل لا يذكر أن المستلم مفوَّض');
  await go(p, 'receipt', {id: 'd1_zed', s: 1});
  const r = await text(p, '.rcpt');
  expect(r.includes(await T(p, 'rcp.howDelegate')) && r.includes('TCA-D1') && r.includes(await T(p, 'rcp.staff')), 'الإيصال (الموظف): ناقص');
  expect(!errs.length, 'التسليم: ' + errs.join(' | '));
  await ctx.close();
  // الإيصال لصاحب الطلب: بلا اسم الموظف
  const z = await open(zed, 'visitor', d);
  await go(z.p, 'receipt', {id: 'd1_zed'});
  const rz = await text(z.p, '.rcpt'), dts = await z.p.evaluate(() => [...document.querySelectorAll('.rcpt-facts dt')].map(x => x.textContent));
  expect(rz.includes(await T(z.p, 'rcp.docTitle')) && rz.includes(await T(z.p, 'rcp.howDelegate')) && !dts.includes(await T(z.p, 'rcp.staff')), 'الإيصال (صاحب الطلب): ناقص أو فيه اسم الموظف');
  expect(!z.errs.length, 'الإيصال: ' + z.errs.join(' | '));
  await z.ctx.close();
}

// ---------- 6) المدير يتجاوز اختلاف آخر 4 أرقام بإقرار يُعلَّم في السجل ----------
{
  const owner = {uid: 'owner', displayName: 'Owner', email: 'o@example.com'};
  const {p, ctx, errs} = await open(owner, 'staff', {...db4(), 'staff/owner': {offices: [O]}});
  await go(p, 'staff', {tab: 'claims'});
  await p.evaluate(() => document.querySelectorAll('details.mcard').forEach(d => { d.open = true; })); await p.waitForTimeout(300);
  await click(p, '[data-act=verify][data-id=d1_zed]');
  expect(await p.evaluate(() => !!document.querySelector('#sheet input[name=override]')), 'التجاوز: لا مربع تجاوز للمدير');
  await fill(p, '#sheet input[name=code]', 'K7M3TX9P'); await fill(p, '#vf-name', 'Zed'); await fill(p, '#vf-4', '4321');
  await p.evaluate(() => document.querySelectorAll('#sheet input[type=checkbox][required]').forEach(x => { x.checked = true; x.dispatchEvent(new Event('change', {bubbles: true})); }));
  expect(await p.evaluate(() => !document.querySelector('#sheet form[data-form=verify] [type=submit]').disabled), 'التجاوز: زر التسليم معطّل رغم المربعات الإلزامية');
  await submit(p, 'form[data-form=verify]');
  expect((await db(p))['claims/d1_zed']?.status === 'approved', 'التجاوز: سُلّم دون الإقرار');
  await tick(p, '#sheet input[name=override]'); await submit(p, 'form[data-form=verify]');
  const d = await db(p), c = d['claims/d1_zed'], lg = Object.values(d).find(x => x?.action === 'handover' && x.claimId === 'd1_zed');
  expect(c?.status === 'done' && String(c.handoverNote || '').startsWith('استلمه بتجاوز الإدارة') && lg?.checks?.includes('ho.override'), 'التجاوز: لم يُسجَّل ' + JSON.stringify({s: c?.status, n: c?.handoverNote}));
  expect(!errs.length, 'التجاوز: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 7) H34: تاريخ ظاهر لكل تحديث على الطلب ----------
{
  const h = 3600e3;
  const tl = {
    'items/t1': item('t1', {cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر', status: 'returned', returnedAt: now - 2 * h}), 'itemSecrets/t1': secret(),
    // طلب مكتمل: أُرسل، سُئل وأجاب، عُدّل، قُبل، فُوّض شخص، سُلّم، قُيّم
    'claims/t1_zed': claim('t1', 'zed', {createdAt: now - 9 * h, editedAt: now - 8.5 * h, question: 'ما لون الميدالية؟', askedAt: now - 8 * h, askedBy: 'staffA', answer: 'زرقاء', answeredAt: now - 7 * h,
      status: 'done', decidedAt: now - 6 * h, decidedBy: 'staffA', delegate: {name: 'سالم', last4: '5678', at: now - 5 * h}, doneAt: now - 2 * h, doneBy: 'staffA',
      handoverNote: 'استلمه المفوَّض: سالم — آخر 4: 5678', rating: 5, ratedAt: now - h}),
    // قيود السجل: قُبل ثم أُلغي القبول ثم قُبل من جديد، وسؤال، وتسليم (السجل يحفظ كل قرار؛ الطلب يحفظ آخر قرار فقط)
    'logs/l1': {officeId: O, itemId: 't1', claimId: 't1_zed', reportId: '', action: 'ask', by: 'staffA', at: now - 8 * h, note: 'ما لون الميدالية؟'},
    'logs/l2': {officeId: O, itemId: 't1', claimId: 't1_zed', reportId: '', action: 'approve', by: 'staffA', at: now - 6.8 * h, note: ''},
    'logs/l3': {officeId: O, itemId: 't1', claimId: 't1_zed', reportId: '', action: 'reject', by: 'staffA', at: now - 6.5 * h, note: 'خطأ'},
    'logs/l4': {officeId: O, itemId: 't1', claimId: 't1_zed', reportId: '', action: 'reactivate', by: 'staffA', at: now - 6.2 * h, note: ''},
    'logs/l5': {officeId: O, itemId: 't1', claimId: 't1_zed', reportId: '', action: 'approve', by: 'staffA', at: now - 6 * h, note: ''},
    'logs/l6': {officeId: O, itemId: 't1', claimId: 't1_zed', reportId: '', action: 'handover', by: 'staffA', at: now - 2 * h, note: 'استلمه المفوَّض: سالم — آخر 4: 5678', checks: ['ho.generic', 'ho.byDelegate']},
  };
  // صاحب الطلب: كل حدث بتاريخ ظاهر (<time datetime>)، و«آخر تحديث» في الملخّص
  const z = await open(zed, 'visitor', {...base(), ...tl});
  await go(z.p, 'mine');
  const mz = await z.p.evaluate(() => { const c = document.querySelector('details[data-card="c:t1_zed"]'); if (!c) return null;
    return {upd: !!c.querySelector('summary .upd time[title]'), rows: [...c.querySelectorAll('.ctl li')].map(li => ({t: li.querySelector('b')?.textContent, d: !!li.querySelector('time[datetime]')}))}; });
  expect(mz?.upd, 'المسار: لا «آخر تحديث» في ملخّص بطاقة الطلب');
  expect(mz?.rows.length === 8 && mz.rows.every(r => r.d), 'المسار (صاحب الطلب): ليس كل حدث بتاريخ ظاهر ' + JSON.stringify(mz?.rows));
  const zl = (mz?.rows || []).map(r => r.t);
  for (const k of ['ctl.sent', 'ctl.edited', 'ctl.asked', 'ctl.answered', 'ctl.dec.approved', 'ctl.delegated', 'ctl.done', 'ctl.rated'])
    expect(zl.includes(await T(z.p, k)), 'المسار (صاحب الطلب): ينقص ' + k);
  expect(!z.errs.length, 'المسار (صاحب الطلب): ' + z.errs.join(' | '));
  await z.ctx.close();
  // الموظف: كل قرار من السجل (قبول، رفض، إعادة، قبول، تسليم) بتاريخه ومن قام به، بلا تكرار للقرار الأخير
  const s = await open(staff, 'staff', {...base(), ...tl});
  await go(s.p, 'staff', {tab: 'claims'});
  await s.p.evaluate(() => document.querySelector('#st-claims-ended')?.click()); await s.p.waitForTimeout(400);
  await s.p.evaluate(() => document.querySelector('[data-act=claimHist]')?.click()); await s.p.waitForTimeout(700);
  // فتح البطاقة بالنقر على ملخّصها كما يفعل الموظف (يقرأ قيود السجل لهذا الطلب)
  await s.p.evaluate(() => document.querySelector('details[data-card="s:t1_zed"] > summary')?.click()); await s.p.waitForTimeout(900);
  const ms = await s.p.evaluate(() => { const c = document.querySelector('details[data-card="s:t1_zed"]'); if (!c) return null;
    return [...c.querySelectorAll('.ctl li')].map(li => ({t: li.querySelector('b')?.textContent, d: !!li.querySelector('time[datetime]'), by: !!li.querySelector('.ctl-by')})); });
  const labels = ms?.map(r => r.t) || [];
  const approve = await T(s.p, 'log.approve'), reject = await T(s.p, 'log.reject'), react = await T(s.p, 'log.reactivate'), hand = await T(s.p, 'log.handover');
  expect(labels.filter(x => x === approve).length === 2 && labels.includes(reject) && labels.includes(react) && labels.includes(hand), 'المسار (الموظف): قرارات السجل ناقصة ' + JSON.stringify(labels));
  expect(!labels.includes(await T(s.p, 'ctl.dec.approved')) && !labels.includes(await T(s.p, 'ctl.done')) && !labels.includes(await T(s.p, 'ctl.asked')), 'المسار (الموظف): قرار مكرر من الطلب والسجل معاً');
  expect(labels.includes(await T(s.p, 'ctl.delegatedStaff')) && labels.includes(await T(s.p, 'ctl.ratedStaff')) && labels.includes(await T(s.p, 'ctl.answeredStaff')), 'المسار (الموظف): أحداث صاحب الطلب ناقصة');
  expect(ms?.length && ms.every(r => r.d) && ms.filter(r => r.by).length === 6, 'المسار (الموظف): حدث بلا تاريخ أو قرار بلا اسم من قام به ' + JSON.stringify(ms));
  expect(!s.errs.length, 'المسار (الموظف): ' + s.errs.join(' | '));
  await s.ctx.close();
}

await browser.close(); server.close();
if (fails.length){ console.log(`✘ ${fails.length} من ${checks}:\n- ` + fails.join('\n- ')); process.exit(1); }
console.log(`✔ إثبات الملكية سليم: ${checks} فحصاً (سجل أغراضي بوقت الخادم، ونسخته في الطلب، وقوة الإثبات وسبب قبول الثمين الضعيف، والتفويض، والتسليم لصاحب الطلب أو مفوَّضه فقط، وتجاوز الإدارة، والإيصال، وH34: تاريخ ظاهر لكل تحديث على الطلب ومسار الموظف الكامل من السجل).`);
