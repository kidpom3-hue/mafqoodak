// فحص نموذج إضافة الغرض (H37، للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs).
// 1) التصنيفات: 13 بلا «قوارير وحافظات»، 12 منها في 4 صفوف × 3، و«أخرى» آخرها بعرض الشبكة.
// 2) نموذج البلاغ ونموذج الغرض (الموظف): «اسم الغرض باختصار» بعد التصنيف مباشرة، إلزامي، 40 حرفاً مع عدّاد،
//    ومثاله يتبدّل مع التصنيف دون مسح ما كُتب؛ لا «(اختياري)»؛ سطر «تفاصيل إضافية» و«لا تظهر للعامة»؛ لكل خانة نصية مثال.
// 3) IMEI: العنوان ولوحة الأرقام ومثاله، و«سيُحفظ: ••••3809» عند لصق رقم كامل، وتلميح *#06# باقٍ. والبلاغ يحفظ آخر 4 فقط.
// 4) شركة الشريحة أزرار (STC | موبايلي | زين | سلام | ليبارا | فيرجن | لا أعرف)، والمختار يُحفظ بمعرّفه.
// 5) تباين لون الـ placeholder ≥ 4.5 في الوضعين الفاتح والداكن.
// 6) البيانات القديمة: غرض بتصنيف bottles يظهر في «أخرى» للزائر، ولوحة الموظف تنقله إلى other مع قيد recat.
// التشغيل: cd tools && npm run form
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
    retentionDays: 90, pickupDays: 7, spots: ['المكتبة'], active: true, createdAt: 1, code: 'TCA'},
  'users/zed': {name: 'Zed'}, 'users/staffA': {name: 'Staff'}, 'staff/staffA': {offices: [O]},
  // غرض قديم بالتصنيف الملغى «قوارير وحافظات»
  'items/q1': {officeId: O, ref: 'TCA-Q1XX', cat: 'bottles', sub: 'قارورة ماء', title: 'قارورة ماء', foundDate: '2026-10-01', photo: false, status: 'available',
    createdBy: 'staffA', createdAt: 1, updatedAt: 1, sample: false, public: true, keepUntil: 1e13},
};
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'};
const staffA = {uid: 'staffA', displayName: 'Staff', email: 'staff@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) fails.push(msg); };

async function open({user = null, lang = 'ar', width = 375, mode = 'visitor', dark = false} = {}){
  const ctx = await browser.newContext({viewport: {width, height: 844}, colorScheme: dark ? 'dark' : 'light'});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider {}'}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})};
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${lang}"'); localStorage.setItem('mfq:mode', '"${mode}"');`);
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(String(e)));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(700);
  return {p, ctx};
}
const go = (p, r, params = {}) => p.evaluate(async ([r, pr]) => { (await import('./js/ui.js')).go(r, pr); }, [r, params]).then(() => p.waitForTimeout(500));
const tr = (p, k, v) => p.evaluate(async ([k, v]) => (await import('./js/i18n.js')).t(k, v), [k, v]);
const pick = (p, c) => p.evaluate(c => { const i = document.querySelector(`form[data-form] input[name=cat][value=${c}]`); i.checked = true; i.dispatchEvent(new Event('change', {bubbles: true})); }, c).then(() => p.waitForTimeout(150));
const typeIn = (p, sel, v) => p.evaluate(([sel, v]) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); }, [sel, v]).then(() => p.waitForTimeout(80));
const CATS13 = ['ids', 'cash', 'wallets', 'phones', 'acc', 'keys', 'jewelry', 'glasses', 'bags', 'study', 'clothes', 'tools', 'other'];

// ---------- 1) شبكة التصنيفات ----------
for (const lang of ['ar', 'en']){
  const {p, ctx} = await open({user: zed, lang});
  await go(p, 'report');
  const g = await p.evaluate(() => {
    const labs = [...document.querySelectorAll('form[data-form=report] .catpick label')];
    return {ids: labs.map(l => l.querySelector('input').value), rows: labs.map(l => Math.round(l.getBoundingClientRect().top)), widths: labs.map(l => l.getBoundingClientRect().width),
      grid: document.querySelector('form[data-form=report] .catpick').getBoundingClientRect().width};
  });
  expect(JSON.stringify(g.ids) === JSON.stringify(CATS13), `1 (${lang}): التصنيفات ${g.ids.join(',')}`);
  const rows = [...new Set(g.rows)];
  expect(rows.length === 5 && rows.slice(0, 4).every(r => g.rows.filter(x => x === r).length === 3), `1 (${lang}): ليست 4 صفوف × 3 ثم «أخرى» (${rows.length} صفوف)`);
  expect(Math.abs(g.widths[12] - g.grid) < 2, `1 (${lang}): «أخرى» ليست بعرض الشبكة (${g.widths[12]} من ${g.grid})`);
  expect(!p.errs.length, `1 (${lang}): أخطاء: ${p.errs.join(' | ')}`);
  await ctx.close();
}

// ---------- 2–4) نموذج البلاغ ----------
for (const lang of ['ar', 'en']){
  const {p, ctx} = await open({user: zed, lang});
  await go(p, 'report');
  const tag = `2 (${lang} بلاغ)`;
  await pick(p, 'phones');
  const order = await p.evaluate(() => [...document.querySelector('form[data-form=report] .step[data-n="1"], form[data-form=report] .step').children]
    .map(el => el.querySelector?.('.catpick') ? 'cat' : el.querySelector?.('#r-title') ? 'title' : el.id === 'subs-field' ? 'subs' : el.id === 'cat-fields' ? 'fields' : '').filter(Boolean));
  expect(order.join(',') === 'cat,title,subs,fields', `${tag}: الترتيب ${order.join(',')}`);
  const ttl = await p.evaluate(() => { const i = document.querySelector('#r-title'); return {req: i.required, max: i.maxLength, ph: i.placeholder, star: !!i.closest('.field').querySelector('label .req-mark'),
    hint: document.getElementById('r-title-h')?.textContent || '', n: document.getElementById('r-title-n')?.textContent}; });
  expect(ttl.req && ttl.max === 40 && ttl.star, `${tag}: اسم الغرض ليس إلزامياً بنجمة و40 حرفاً`);
  expect(ttl.ph === await tr(p, 'nm.ph.phones'), `${tag}: مثال اسم الغرض للجوالات «${ttl.ph}»`);
  expect(ttl.hint === await tr(p, 'nm.hint'), `${tag}: نص المساعدة تحت اسم الغرض`);
  await typeIn(p, '#r-title', 'آيفون 13');
  expect(await p.evaluate(() => document.getElementById('r-title-n').textContent) === '8/40', `${tag}: العدّاد لا يعدّ`);
  await pick(p, 'bags');
  const after = await p.evaluate(() => ({v: document.querySelector('#r-title').value, ph: document.querySelector('#r-title').placeholder}));
  expect(after.v === 'آيفون 13' && after.ph === await tr(p, 'nm.ph.bags'), `${tag}: تغيير التصنيف: القيمة «${after.v}» والمثال «${after.ph}»`);
  // لكل تصنيف: لا «(اختياري)»، ولكل خانة نصية مثال، وسطر «تفاصيل إضافية» و«لا تظهر للعامة» حين توجد خانات
  const opt = await tr(p, 'c.optional');
  for (const c of CATS13.filter(c => c !== 'cash')){
    await pick(p, c);
    const r = await p.evaluate(opt => { const f = document.querySelector('form[data-form=report]');
      return {opt: f.textContent.includes(opt), noPh: [...f.querySelectorAll('#cat-fields input:not([type=radio]):not([type=hidden]), #cat-fields textarea')].filter(i => !i.placeholder).map(i => i.name),
        head: !!f.querySelector('#cat-fields .xd-h'), lock: !!f.querySelector('#cat-fields .xd-lock'), secret: f.querySelectorAll('#cat-fields [name^=d_]').length,
        ph: f.querySelector('#r-title').placeholder}; }, opt);
    expect(!r.opt, `${tag} ${c}: ما زال «${opt}» في النموذج`);
    expect(!r.noPh.length, `${tag} ${c}: خانات بلا مثال: ${r.noPh.join(',')}`);
    expect(r.ph === await tr(p, 'nm.ph.' + c), `${tag} ${c}: مثال اسم الغرض «${r.ph}»`);
    if (r.secret) expect(r.head && r.lock, `${tag} ${c}: لا سطر «تفاصيل إضافية» أو «لا تظهر للعامة»`);
    expect(!/#[0-9a-f]{3,6}|أسود|أبيض|أزرق|أحمر|بني|رمادي|black|white|blue|red|brown|grey/i.test(r.ph), `${tag} ${c}: لون في مثال اسم الغرض «${r.ph}»`);
  }
  // IMEI
  await pick(p, 'phones');
  const imei = await p.evaluate(() => { const i = document.querySelector('#cf-serial'); return {lab: document.querySelector('label[for=cf-serial]').textContent.trim(), im: i.inputMode, ph: i.placeholder,
    save: document.getElementById('cf-serial-save').hidden, hint: i.closest('.field').textContent.includes('*#06#')}; });
  expect(imei.lab === await tr(p, 'df.phones.serial'), `3 (${lang}): عنوان خانة IMEI «${imei.lab}»`);
  expect(imei.im === 'numeric' && imei.ph === await tr(p, 'df.serial.ph') && imei.save && imei.hint, `3 (${lang}): IMEI: لوحة الأرقام والمثال وتلميح *#06#`);
  await typeIn(p, '#cf-serial', '35 693803 564380 9');
  const sv = await p.evaluate(() => { const b = document.getElementById('cf-serial-save'); return {hidden: b.hidden, t: b.textContent}; });
  expect(!sv.hidden && sv.t.includes('••••3809'), `3 (${lang}): بعد لصق رقم كامل لا يظهر «سيُحفظ: ••••3809» (${sv.t})`);
  await typeIn(p, '#cf-serial', '3809');
  expect(await p.evaluate(() => document.getElementById('cf-serial-save').hidden), `3 (${lang}): «سيُحفظ» ظاهر لأربع خانات فقط`);
  await typeIn(p, '#cf-serial', '356938035643809');
  // الشريحة
  const sims = await p.evaluate(() => [...document.querySelectorAll('input[name=d_sim]')].map(i => [i.value, i.closest('label').textContent.trim(), i.checked]));
  const want = [['', await tr(p, 'df.pickUnknown')], ...await Promise.all(['stc', 'mobily', 'zain', 'salam', 'lebara', 'virgin'].map(async k => [k, await tr(p, 'df.sim.' + k)]))];
  expect(JSON.stringify(sims.map(s => s.slice(0, 2))) === JSON.stringify(want), `4 (${lang}): أزرار الشريحة ${JSON.stringify(sims)}`);
  expect(sims[0][2] === true, `4 (${lang}): «لا أعرف» ليس المختار افتراضياً`);
  expect(!(await p.evaluate(() => !!document.querySelector('select[name=d_sim], input[type=text][name=d_sim]'))), `4 (${lang}): ما زال حقل نصي للشريحة`);
  await p.evaluate(() => { const i = document.querySelector('input[name=d_sim][value=zain]'); i.checked = true; i.dispatchEvent(new Event('change', {bubbles: true})); });
  // تغيير التصنيف والعودة: المختار والمكتوب باقيان
  await pick(p, 'acc'); await pick(p, 'phones');
  const kept = await p.evaluate(() => ({sim: document.querySelector('input[name=d_sim]:checked')?.value, serial: document.querySelector('#cf-serial').value, title: document.querySelector('#r-title').value}));
  expect(kept.sim === 'zain' && kept.serial === '356938035643809' && kept.title === 'آيفون 13', `4 (${lang}): بعد تغيير التصنيف والعودة: ${JSON.stringify(kept)}`);
  // الإرسال: آخر 4 فقط، والشريحة بمعرّفها
  await p.evaluate(() => { const f = document.querySelector('form[data-form=report]'); f.dataset.step = 3; f.requestSubmit(); }); await p.waitForTimeout(1200);
  const saved = await p.evaluate(() => Object.entries(window.__FAKE.db).find(([k]) => k.startsWith('reports/'))?.[1] || null);
  expect(saved?.details?.serial === '3809' && saved?.details?.sim === 'zain' && saved?.cat === 'phones', `3–4 (${lang}): البلاغ المحفوظ ${JSON.stringify(saved?.details)}`);
  expect(!p.errs.length, `${tag}: أخطاء: ${p.errs.join(' | ')}`);
  await ctx.close();
}

// ---------- 2) نموذج الغرض (الموظف) ----------
for (const lang of ['ar', 'en']){
  const {p, ctx} = await open({user: staffA, lang, mode: 'staff'});
  await go(p, 'add');
  const tag = `2 (${lang} غرض)`;
  await pick(p, 'phones');
  const r = await p.evaluate(() => { const f = document.querySelector('form[data-form=item]'); const kids = [...f.children];
    const iCat = kids.findIndex(el => el.id === 'cat-field'), iT = kids.findIndex(el => el.querySelector?.('#f-title'));
    return {next: iT === iCat + 1, ph: f.querySelector('#f-title').placeholder, max: f.querySelector('#f-title').maxLength, sum: f.querySelector('#if-more summary').textContent.trim(),
      txt: f.textContent, noPh: [...f.querySelectorAll('#cat-fields input:not([type=radio]), #cat-fields-opt input:not([type=radio])')].filter(i => !i.placeholder).map(i => i.name)}; });
  expect(r.next, `${tag}: اسم الغرض ليس بعد التصنيف مباشرة`);
  expect(r.ph === await tr(p, 'nm.ph.phones') && r.max === 40, `${tag}: مثال اسم الغرض «${r.ph}» وحدّه ${r.max}`);
  expect(r.sum === await tr(p, 'xd.head'), `${tag}: عنوان «تفاصيل إضافية» «${r.sum}»`);
  expect(!r.txt.includes(await tr(p, 'c.optional')), `${tag}: ما زال «(اختياري)»`);
  expect(!r.noPh.length, `${tag}: خانات بلا مثال: ${r.noPh.join(',')}`);
  expect(!p.errs.length, `${tag}: أخطاء: ${p.errs.join(' | ')}`);
  await ctx.close();
}

// ---------- 5) تباين الـ placeholder ----------
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
for (const dark of [false, true]){
  const {p, ctx} = await open({user: zed, dark});
  await go(p, 'report');
  const c = await p.evaluate(() => { const i = document.querySelector('#r-title'); return {fg: getComputedStyle(i, '::placeholder').color, bg: getComputedStyle(i).backgroundColor}; });
  const [a, b] = [lum(c.fg), lum(c.bg)], ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  expect(ratio >= 4.5, `5 (${dark ? 'داكن' : 'فاتح'}): تباين الـ placeholder ${ratio.toFixed(2)} (${c.fg} على ${c.bg})`);
  await ctx.close();
}

// ---------- 6) البيانات القديمة (bottles) ----------
{
  const {p, ctx} = await open({user: zed});
  await go(p, 'browse');
  await p.evaluate(async () => { const {S} = await import('./js/state.js'); S.filter.cat = 'other'; (await import('./js/views/visitor.js')).updateBrowse?.(); });
  await p.waitForTimeout(300);
  const ids = await p.evaluate(async () => { const {S} = await import('./js/state.js'); return S.items.map(i => i.id); });
  expect(ids.includes('q1'), '6: الغرض القديم غير محمّل للزائر');
  expect(await p.evaluate(() => document.querySelector('#main').textContent.includes('TCA-Q1XX') || !!document.querySelector('[data-id=q1]')), '6: الغرض القديم (قوارير) لا يظهر تحت «أخرى» للزائر');
  await ctx.close();
}
{
  const {p, ctx} = await open({user: staffA, mode: 'staff'});
  await go(p, 'staff'); await p.waitForTimeout(1500);
  const w = await p.evaluate(() => window.__FAKE.writes.filter(x => x[1] === 'items/q1' || (x[1] || '').startsWith('logs/')));
  const upd = w.find(x => x[1] === 'items/q1'), lg = w.find(x => x[1].startsWith('logs/') && x[2]?.action === 'recat');
  expect(upd?.[2]?.cat === 'other' && upd?.[2]?.lastLog, `6: لوحة الموظف لم تنقل الغرض إلى other مع lastLog (${JSON.stringify(upd)})`);
  expect(!!lg && lg[2].itemId === 'q1' && upd?.[2]?.lastLog === lg[1].split('/')[1], `6: لا قيد recat للغرض نفسه (${JSON.stringify(lg)})`);
  expect(await p.evaluate(() => localStorage.getItem('mfq:catMig:tc-ahsa')) === 'true', '6: علامة الترحيل catMig لم تُحفظ');
  expect(!p.errs.length, `6: أخطاء: ${p.errs.join(' | ')}`);
  await ctx.close();
}

await browser.close(); server.close();
if (fails.length){ console.error(`✘ نموذج إضافة الغرض: ${fails.length} من ${checks}:\n- ` + fails.join('\n- ')); process.exit(1); }
console.log(`✔ نموذج إضافة الغرض سليم: ${checks} فحصاً (12 تصنيفاً في 4×3 و«أخرى» بعرض الشبكة، اسم الغرض بعد التصنيف ومثاله حسب التصنيف مع العدّاد، لا «(اختياري)»، مثال لكل خانة، IMEI وآخر 4، أزرار الشريحة، تباين الـ placeholder، ونقل «قوارير» القديمة إلى «أخرى»).`);
