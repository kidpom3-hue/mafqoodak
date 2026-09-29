// فحص الترشيح (H10، للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
// الحالات: بلاغ نقود + 3 مبالغ (لا اقتراح آلي للزائر، والموظف يرى صاحب المبلغ المطابق فقط)، وحقيبة سوداء مقابل زرقاء،
// وترشيح موظف نشط يُخفي الاقتراح الآلي، و«ليس غرضي» ثم غرض مشابه جديد بلا تنبيه جديد قبل 24 ساعة، وبطاقة «قد يكون لك» بلا خلفية دائرية.
// التشغيل: cd tools && npm run match   (لمتصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run match)
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

const now = Date.now(), day = 864e5, O = 'tc-ahsa';
const ds = n => new Date(now - n * day).toISOString().slice(0, 10);
const item = (id, x = {}) => ({officeId: O, ref: 'TCA-' + id.toUpperCase(), cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر', foundDate: ds(2), photo: 'blur', status: 'available', createdBy: 'staffA', createdAt: now - 3600e3, updatedAt: now, sample: false, ...x});
const secret = (x = {}) => ({officeId: O, title: 'غرض', color: '', brand: '', desc: '', spot: 'المكتبة', bldg: '', room: '', storage: '', ...x});
const base = () => ({
  'config/app': {ownerUid: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', type: 'college', city: 'الأحساء', place: 'المبنى الإداري', retentionDays: 90, pickupDays: 7, spots: ['المكتبة', 'الكافتيريا'], active: true, createdAt: 1, code: 'TCA'},
  'staff/staffA': {offices: [O]}, 'users/amy': {name: 'Amy'},
});
// بلاغ نقود بمبلغ 500، وثلاثة مبالغ في المستودع (واحد منها 500)
const cash = () => ({
  'reports/rc': {officeId: O, uid: 'amy', cat: 'cash', sub: 'نقود ورقية', title: 'مبلغ في ظرف', color: '', spot: 'المكتبة', lostDate: ds(3), status: 'open', createdAt: now - 3 * day, details: {amount: '500'}},
  ...Object.fromEntries(['200', '500', '50'].flatMap((a, k) => [[`items/c${k}`, item('c' + k, {cat: 'cash', sub: 'نقود ورقية', title: 'نقود ورقية', photo: false, createdAt: now - (k + 1) * 3600e3})],
    [`itemSecrets/c${k}`, secret({details: {amount: a}})]])),
});
// بلاغ حقيبة ظهر سوداء
const bagRep = (x = {}) => ({'reports/rb': {officeId: O, uid: 'amy', cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر سوداء', desc: '', color: 'black', spot: 'الكافتيريا', lostDate: ds(3), status: 'open', createdAt: now - 3 * day, ...x}});
const bag = (id, color, x = {}) => ({[`items/${id}`]: item(id, {pubColor: color, ...x}), [`itemSecrets/${id}`]: secret({color})});
const amy = {uid: 'amy', displayName: 'Amy', email: 'amy@example.com'}, staff = {uid: 'staffA', displayName: 'Staff', email: 's@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) fails.push(msg); };

async function open(user, mode, db, ls = {}){
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaV3Provider {}'}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})};
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"ar"'); localStorage.setItem('mfq:mode', '"${mode}"');
    if (!localStorage.getItem('mfq:staffSeen')) localStorage.setItem('mfq:staffSeen', JSON.stringify({since: ${now - 2 * day}, keys: []}));
    ${Object.entries(ls).map(([k, v]) => `if (!sessionStorage.getItem('lsSet:${k}')){ localStorage.setItem('mfq:${k}', ${JSON.stringify(JSON.stringify(v))}); sessionStorage.setItem('lsSet:${k}', '1'); }`).join('\n')}`);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(700);
  return {p, ctx, errs};
}
const go = (p, r, set = {}) => p.evaluate(async ([r, set]) => { const st = await import('./js/state.js'); Object.assign(st.S, set); (await import('./js/ui.js')).go(r, {}); }, [r, set]).then(() => p.waitForTimeout(600));
// ما يراه الزائر في بطاقة بلاغه: ترشيح الموظف، والاقتراح الآلي (عدده ومراجعه)
const mine = (p, id) => p.evaluate(id => { const c = document.querySelector(`details[data-card="r:${id}"]`); if (!c) return null;
  const auto = [...c.querySelectorAll('.maybe-box .sugg')];
  return {pick: !!c.querySelector('.pick-box:not(.maybe-box)'), auto: auto.length, refs: auto.map(s => s.querySelector('[data-act=notMine]')?.dataset.item)}; }, id);
const keys = p => p.evaluate(async () => (await import('./js/state.js')).alertKeys().filter(k => k.startsWith('m:') || k.startsWith('p:')));
const unseenM = p => p.evaluate(async () => (await import('./js/state.js')).unseenKeys().filter(k => k.startsWith('m:')));
const addDoc = (p, docPath, data) => p.evaluate(async ([docPath, data]) => {
  const fs = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'); await fs.setDoc({path: docPath}, data);
}, [docPath, data]).then(() => p.waitForTimeout(600));

// ---------- 1) نقود: لا اقتراح آلي للزائر، والموظف يرى صاحب المبلغ المطابق فقط ----------
{
  const {p, ctx, errs} = await open(amy, 'visitor', {...base(), ...cash()});
  await go(p, 'mine', {mineTab: 'reports'});
  const m = await mine(p, 'rc');
  expect(m && m.auto === 0, `نقود: ظهر للزائر اقتراح آلي (${m?.auto})`);
  expect(!(await keys(p)).length, 'نقود: تنبيه اقتراح آلي للزائر');
  expect(!errs.length, 'نقود (زائر): ' + errs.join(' | '));
  await ctx.close();
}
{
  const {p, ctx, errs} = await open(staff, 'staff', {...base(), ...cash()});
  await go(p, 'staff', {staffTab: 'reports'});
  // شارة جديد حمراء على «محتمل» قبل فتحه (تُمسح بالنقر، حسب قاعدة الشارات الموحّدة)
  const red = await p.evaluate(() => !!document.querySelector('#st-reports-likely .count'));
  expect(red, 'نقود: لا شارة جديد حمراء على «محتمل»');
  await p.evaluate(() => document.querySelector('[data-act=staffSub][data-v=likely]')?.click()); await p.waitForTimeout(400);
  expect(!(await p.evaluate(() => !!document.querySelector('#st-reports-likely .count'))), 'نقود: بقيت الشارة الحمراء بعد فتح «محتمل»');
  const r = await p.evaluate(() => { const c = document.querySelector('details[data-card="sr:rc"]'); if (!c) return null; if (!c.open) c.querySelector('summary').click();
    return {inLikely: !!document.querySelector('#sp-reports details[data-card="sr:rc"]'), picks: [...c.querySelectorAll('[data-act=pickFor]')].map(b => b.dataset.i)}; });
  expect(r?.inLikely, 'نقود: البلاغ ليس في «محتمل» عند الموظف');
  expect(r && r.picks.length === 1 && r.picks[0] === 'c1', `نقود: مرشّحو الموظف ${JSON.stringify(r?.picks)} والمتوقع c1 فقط (المبلغ 500)`);
  expect(!errs.length, 'نقود (موظف): ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 2) حقيبة سوداء: الزرقاء لا تُقترح، والسوداء اقتراح واحد ----------
{
  const {p, ctx, errs} = await open(amy, 'visitor', {...base(), ...bagRep(), ...bag('b1', 'blue')});
  await go(p, 'mine', {mineTab: 'reports'});
  let m = await mine(p, 'rb');
  expect(m && m.auto === 0, `حقيبة: اقتُرحت الحقيبة الزرقاء (${JSON.stringify(m)})`);
  await addDoc(p, 'items/b2', item('b2', {pubColor: 'black'}));
  await addDoc(p, 'items/b3', item('b3', {pubColor: 'black', createdAt: now - 60e3}));
  m = await mine(p, 'rb');
  expect(m && m.auto === 1, `حقيبة: المتوقع اقتراح واحد فقط، وظهر ${m?.auto}`);
  // شكل البطاقة: لا خلفية دائرية خضراء خلف الاقتراح
  const look = await p.evaluate(() => { const s = document.querySelector('.maybe-box .sugg'); if (!s) return null; const cs = getComputedStyle(s);
    return {bg: cs.backgroundColor, radius: cs.borderRadius}; });
  expect(look && (look.bg === 'rgba(0, 0, 0, 0)' || look.bg === 'transparent') && parseFloat(look.radius || '0') < 20, `حقيبة: خلفية أو استدارة غريبة خلف الاقتراح ${JSON.stringify(look)}`);
  expect(!errs.length, 'حقيبة: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 3) ترشيح موظف نشط: لا اقتراحات آلية ----------
{
  const {p, ctx, errs} = await open(amy, 'visitor', {...base(), ...bagRep({staffPick: 'b1', pickedAt: now - 3600e3}), ...bag('b1', 'blue'), ...bag('b2', 'black')});
  await go(p, 'mine', {mineTab: 'reports'});
  const m = await mine(p, 'rb');
  expect(m && m.pick && m.auto === 0, `ترشيح الموظف: ظهر اقتراح آلي بجانبه (${JSON.stringify(m)})`);
  expect(!(await keys(p)).some(k => k.startsWith('m:')), 'ترشيح الموظف: بقي مفتاح تنبيه آلي');
  expect(!errs.length, 'ترشيح الموظف: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- 4) «ليس غرضي» ثم غرض مشابه جديد: لا تنبيه جديد قبل 24 ساعة ----------
{
  const {p, ctx, errs} = await open(amy, 'visitor', {...base(), ...bagRep(), ...bag('b2', 'black')});
  await go(p, 'mine', {mineTab: 'reports'});
  const first = await keys(p);
  expect(first.includes('m:rb:b2'), `ليس غرضي: لا تنبيه للاقتراح الأول ${JSON.stringify(first)}`);
  await p.evaluate(async () => { const st = await import('./js/state.js'); st.markSeenKeys(st.unseenKeys()); });
  // «ليس غرضي» (يُحفظ في rejected بعد مهلة التراجع)
  await p.evaluate(() => document.querySelector('.maybe-box [data-act=notMine]')?.click()); await p.waitForTimeout(5800);
  await addDoc(p, 'items/b4', item('b4', {pubColor: 'black', foundDate: ds(1), createdAt: now}));
  const m = await mine(p, 'rb');
  expect(m && m.auto === 1 && m.refs[0] === 'b4', `ليس غرضي: لم يظهر الاقتراح التالي ${JSON.stringify(m)}`);
  expect(!(await unseenM(p)).length, `ليس غرضي: تنبيه جديد قبل 24 ساعة ${JSON.stringify(await unseenM(p))}`);
  // بعد 24 ساعة (نقدّم وقت آخر تنبيه يوماً) يصبح الاقتراح الجديد تنبيهاً
  await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('mfq:suggAlert')); a.rb.at -= 864e5 + 1000; localStorage.setItem('mfq:suggAlert', JSON.stringify(a)); });
  expect((await unseenM(p)).includes('m:rb:b4'), 'ليس غرضي: لا تنبيه حتى بعد 24 ساعة');
  expect(!errs.length, 'ليس غرضي: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- H11: الطلب المجمّع بالوصف ----------
const cashIt = (id, amount, spot, x = {}) => ({[`items/${id}`]: item(id, {cat: 'cash', sub: 'نقود ورقية', title: 'نقود ورقية', photo: false, foundDate: ds(1), ...x}),
  [`itemSecrets/${id}`]: secret({spot, details: {amount, ...(x.denoms ? {denoms: x.denoms} : {})}})});
const gclaim = (id, x = {}) => ({[`claims/${id}`]: {itemId: '', cat: 'cash', grouped: true, officeId: O, uid: 'amy', no: 'REQ-G1', proof: '', claimantName: 'آمنة', idLast4: '1234',
  lostSpot: '', lostDate: ds(2), details: {amount: '150'}, status: 'pending', codeHash: 'x', createdAt: now - 3 * day, ...x}});
const staffCard = (p, id) => p.evaluate(id => { const c = document.querySelector(`details[data-card="s:${id}"]`); if (!c) return null; if (!c.open) c.querySelector('summary').click();
  return {strong: !!c.querySelector('.hit-line'), links: [...c.querySelectorAll('[data-act=linkClaim]')].map(b => b.dataset.i), q: c.querySelector('[data-act=askSugg]')?.dataset.q || '',
    none: !!c.querySelector('.note') && c.textContent.includes('لا يوجد في المستودع ما يطابق'), approve: !!c.querySelector('[data-act=approve]')}; }, id);
// 5) زائر: 5 مبالغ = بطاقة مجمّعة واحدة، ولا بطاقة مبلغ منفردة، والرابط القديم للغرض يحوّل إلى الطلب بالوصف
{
  const five = {...cashIt('m1', '150', 'المكتبة'), ...cashIt('m2', '500', 'الكافتيريا'), ...cashIt('m3', '50', 'المكتبة'), ...cashIt('m4', '1000', 'المكتبة'), ...cashIt('m5', '220', 'المكتبة')};
  const {p, ctx, errs} = await open(amy, 'visitor', {...base(), ...five, ...bag('b1', 'blue')});
  await go(p, 'browse');
  const r = await p.evaluate(() => ({groups: document.querySelectorAll('#results .group-card').length, single: [...document.querySelectorAll('#results .card:not(.group-card)')].map(c => c.textContent).filter(x => x.includes('نقود')).length}));
  expect(r.groups === 1 && r.single === 0, `مجمّع: المتوقع بطاقة مجمّعة واحدة بلا مبالغ منفردة ${JSON.stringify(r)}`);
  await p.evaluate(async () => (await import('./js/ui.js')).go('item', {id: 'm2'})); await p.waitForTimeout(700);
  const rt = await p.evaluate(async () => (await import('./js/state.js')).S.route);
  expect(rt.name === 'gclaim' && rt.params.cat === 'cash', `مجمّع: رابط الغرض القديم لم يحوّل إلى الطلب بالوصف ${JSON.stringify(rt)}`);
  expect(!errs.length, 'مجمّع (زائر): ' + errs.join(' | '));
  await ctx.close();
}
// 6) موظف: مبلغ مطابق تماماً + المكان نفسه ولا منافس قريب = «مطابقة مؤكدة» (مرشّح واحد)، وبلا زر قبول قبل الربط
{
  const five = {...cashIt('m1', '150', 'المكتبة'), ...cashIt('m2', '500', 'الكافتيريا'), ...cashIt('m3', '50', 'المكتبة'), ...cashIt('m4', '1000', 'المكتبة'), ...cashIt('m5', '220', 'المكتبة')};
  const {p, ctx, errs} = await open(staff, 'staff', {...base(), ...five, ...gclaim('g_amy_cash_1', {lostSpot: 'المكتبة'})});
  await go(p, 'staff', {staffTab: 'claims'});
  const r = await staffCard(p, 'g_amy_cash_1');
  expect(r && r.strong && r.links.length === 1 && r.links[0] === 'm1' && !r.approve, `مجمّع: المتوقع «مطابقة مؤكدة» واحدة (m1) بلا زر قبول ${JSON.stringify(r)}`);
  expect(!errs.length, 'مجمّع (مؤكدة): ' + errs.join(' | '));
  await ctx.close();
}
// 7) مبلغان متقاربان (150 و155) بلا مكان: سؤال تحقق مقترح يفرّق بينهما (الفئات)
{
  const two = {...cashIt('m1', '150', 'المكتبة', {denoms: '100 و50'}), ...cashIt('m6', '155', 'الكافتيريا', {denoms: '50 ×3 و5'})};
  const {p, ctx, errs} = await open(staff, 'staff', {...base(), ...two, ...gclaim('g_amy_cash_2')});
  await go(p, 'staff', {staffTab: 'claims'});
  const r = await staffCard(p, 'g_amy_cash_2');
  expect(r && !r.strong && r.links.length === 2 && r.q.length > 5, `مجمّع: المتوقع مرشّحان وسؤال تحقق مقترح ${JSON.stringify(r)}`);
  expect(!errs.length, 'مجمّع (متقاربان): ' + errs.join(' | '));
  await ctx.close();
}
// 8) لا مطابقة، ثم تسجيل مبلغ جديد مطابق: يظهر للموظف جديداً (شارة حمراء على «قراري»)
{
  const {p, ctx, errs} = await open(staff, 'staff', {...base(), ...cashIt('m2', '500', 'الكافتيريا'), ...gclaim('g_amy_cash_3', {details: {amount: '300'}})});
  await go(p, 'staff', {staffTab: 'claims'});
  let r = await staffCard(p, 'g_amy_cash_3');
  expect(r && r.none && !r.links.length, `مجمّع: المتوقع «لا مرشّح» ${JSON.stringify(r)}`);
  await p.evaluate(() => document.querySelector('[data-act=staffSub][data-v=come]')?.click()); await p.waitForTimeout(300);
  await addDoc(p, 'itemSecrets/m9', secret({spot: 'المكتبة', details: {amount: '300'}}));
  await addDoc(p, 'items/m9', item('m9', {cat: 'cash', sub: 'نقود ورقية', title: 'نقود ورقية', photo: false, foundDate: ds(1), createdAt: Date.now()}));
  const red = await p.evaluate(() => { const c = document.querySelector('#st-claims-decide .count [aria-hidden]') || document.querySelector('#st-claims-decide .count'); return c ? +c.textContent : 0; });
  expect(red === 1, `مجمّع: الغرض الجديد المطابق لم يظهر جديداً (أحمر = ${red})`);
  await p.evaluate(() => document.querySelector('[data-act=staffSub][data-v=decide]')?.click()); await p.waitForTimeout(300);
  r = await staffCard(p, 'g_amy_cash_3');
  expect(r && r.links.includes('m9'), `مجمّع: الغرض الجديد ليس بين المرشّحين ${JSON.stringify(r)}`);
  expect(!errs.length, 'مجمّع (جديد): ' + errs.join(' | '));
  await ctx.close();
}

await browser.close(); server.close();
if (fails.length){ console.error('✘ فحص الترشيح فشل:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`✔ الترشيح سليم: ${checks} فحصاً (لا اقتراح آلي للتصنيفات الحساسة، دليل عام مطلوب، اقتراح واحد، ترشيح الموظف أولاً، تنبيه آلي واحد كل 24 ساعة، والطلب المجمّع بالوصف).`);
