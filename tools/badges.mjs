// فحص الشارات الرقمية (للمطوّر فقط؛ لا يحمّله التطبيق): Playwright مع بديل Firebase التجريبي (tools/a11y-stubs) وبيانات مثال.
// القاعدة: رقم واحد فقط في أي مكان — أحمر (.count) بعدد الجديد غير المقروء، وإلا رمادي (.tab-n) بعدد العناصر، ولا شيء عند الصفر.
// التشغيل: cd tools && npm run badges   (لمتصفح مثبّت مسبقاً: CHROMIUM_PATH=/path/to/chromium npm run badges)
// يفشل برسالة عربية واضحة لكل حالة لم تتحقق. يُشغَّل قبل كل Pull Request مع a11y وcheck-i18n.
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

// بيانات مثال: طلب قيد المراجعة لـ zed، وبلاغ جديد بلا ترشيح (r1)، وبلاغ فيه ترشيح بانتظار صاحبه دون ردّ (r2)
const now = Date.now(), day = 864e5, O = 'tc-ahsa';
const ds = n => new Date(now - n * day).toISOString().slice(0, 10);
const item = (id, x = {}) => ({officeId: O, ref: 'TCA-' + id.toUpperCase(), cat: 'phones', sub: 'جوال', title: 'جوال', foundDate: ds(3), photo: false, status: 'available', createdBy: 'staffA', createdAt: now - 3 * day, updatedAt: now, sample: false, ...x, public: 'public' in x ? x.public : (x.cat ?? 'phones') !== 'cash'});   // H16: الغرض العام فيه public: true (والنقود false)
const db = {
  'config/app': {ownerUid: 'owner'}, 'admins/owner': {role: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', type: 'college', city: 'الأحساء', place: 'المبنى الإداري', retentionDays: 90, pickupDays: 7, spots: ['المكتبة'], active: true, createdAt: 1, code: 'TCA'},
  'staff/staffA': {offices: [O]}, 'users/zed': {name: 'Zed'}, 'users/amy': {name: 'Amy'},
  'staffInvites/new@example.com': {offices: [O], createdBy: 'owner', createdAt: now - day},
  'items/i1': item('i1'), 'itemSecrets/i1': {officeId: O, title: 'جوال أسود', spot: 'المكتبة'},
  'items/i2': item('i2', {cat: 'keys', sub: 'مفتاح سيارة', title: 'مفتاح سيارة'}), 'itemSecrets/i2': {officeId: O, title: 'مفتاح', spot: 'المكتبة'},
  'claims/i1_zed': {itemId: 'i1', officeId: O, uid: 'zed', no: 'REQ-7K3M', proof: 'غلاف أحمر', status: 'pending', codeHash: 'x', createdAt: now - 2 * 3600e3},
  'reports/r1': {officeId: O, uid: 'amy', cat: 'bags', title: 'حقيبتي', status: 'open', lostDate: ds(2), createdAt: now - 3600e3},
  'reports/r2': {officeId: O, uid: 'amy', cat: 'keys', title: 'مفاتيحي', status: 'open', lostDate: ds(4), createdAt: now - 3 * day, staffPick: 'i2', pickedAt: now - 3600e3},
};
const zed = {uid: 'zed', displayName: 'Zed', email: 'zed@example.com'}, staff = {uid: 'staffA', displayName: 'Staff', email: 's@example.com'}, owner = {uid: 'owner', displayName: 'Owner', email: 'o@example.com'};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = []; let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) fails.push(msg); };

// صفحة جديدة لمستخدم وعرض (visitor/staff/admin). أحداث البيانات المضافة تُحفظ في sessionStorage فتبقى بعد تحديث الصفحة
async function open(user, mode){
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaV3Provider {}'}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  // staffSeen.since قبل يومين: أحداث اليوم (البلاغ r1 والطلب) جديدة للموظف
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user})};
    try { const x = sessionStorage.getItem('badgesDb'); if (x) Object.assign(window.__FAKE.db, JSON.parse(x)); } catch {}
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"ar"'); localStorage.setItem('mfq:mode', '"${mode}"');
    if (!localStorage.getItem('mfq:staffSeen')) localStorage.setItem('mfq:staffSeen', JSON.stringify({since: ${now - 2 * day}, keys: []}));`);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(700);
  return {p, ctx};
}
const go = (p, r, params = {}, set = {}) => p.evaluate(async ([r, pr, set]) => { const st = await import('./js/state.js'); Object.assign(st.S, set); (await import('./js/ui.js')).go(r, pr); }, [r, params, set]).then(() => p.waitForTimeout(600));
// حدث جديد في البيانات (تحديث مستند) يُحفظ ليبقى بعد تحديث الصفحة
const change = (p, docPath, patch) => p.evaluate(async ([docPath, patch]) => {
  const fs = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  await fs.updateDoc({path: docPath}, patch);
  const saved = JSON.parse(sessionStorage.getItem('badgesDb') || '{}'); saved[docPath] = window.__FAKE.db[docPath]; sessionStorage.setItem('badgesDb', JSON.stringify(saved));
}, [docPath, patch]).then(() => p.waitForTimeout(600));
const reload = async p => { await p.reload(); await p.waitForTimeout(900); };
// رقم التبويب: {red, grey}
const tabNum = (p, sel) => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) return null;
  const c = b.querySelector('.count [aria-hidden]') || b.querySelector('.count'), g = b.querySelector('.tab-n');
  return {red: c ? +c.textContent : 0, grey: g ? +g.textContent : 0}; }, sel);
const navNum = (p, label) => p.evaluate(label => { const b = [...document.querySelectorAll('nav.bottom button')].find(x => x.textContent.includes(label));
  const c = b?.querySelector('.count [aria-hidden]') || b?.querySelector('.count'); return c ? +c.textContent : 0; }, label);
// الحالة 1: لا زر ولا عنوان فيه .count و.tab-n معاً
const doubles = p => p.evaluate(() => [...document.querySelectorAll('.count')].map(c => c.closest('button, [role=tab], h1, h2, h3, .section-title, summary, .sec-head'))
  .filter(el => el && el.querySelector('.tab-n')).map(el => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)));
const reds = p => p.evaluate(() => [...document.querySelectorAll('#main .count, #nav .count, #hdr .count')].map(c => (c.closest('button, h2, h3, .section-title') || c).textContent.trim().replace(/\s+/g, ' ').slice(0, 40)));

// ---------- الحالة 1 و5: كل الصفحات (زائر، موظف، إدارة) ----------
{
  const pages = [
    [zed, 'visitor', [['home'], ['browse'], ['mine']]],
    [staff, 'staff', [['staff', {}, {staffTab: 'items'}], ['staff', {}, {staffTab: 'claims'}], ['staff', {}, {staffTab: 'reports'}]]],
    [owner, 'admin', [['admin', {}, {adminTab: 'overview'}], ['admin', {}, {adminTab: 'offices'}], ['admin', {}, {adminTab: 'people'}]]],
  ];
  for (const [user, mode, list] of pages){
    const {p, ctx} = await open(user, mode);
    for (const [r, params, set] of list){
      await go(p, r, params, set);
      const d = await doubles(p);
      expect(!d.length, `الحالة 1 (${mode} · ${r}${set ? ' ' + JSON.stringify(set) : ''}): رقمان متجاوران (أحمر ورمادي) في: ${d.join(' | ')}`);
      if (mode === 'admin'){
        const rr = await reds(p);
        expect(!rr.length, `الحالة 5 (الإدارة · ${set.adminTab}): شارة حمراء لعدد ثابت لا جديد فيه: ${rr.join(' | ')}`);
      }
    }
    await ctx.close();
  }
}

// ---------- الحالة 2: زائر يصله سؤال جديد من الموظف ----------
{
  const {p, ctx} = await open(zed, 'visitor');
  const T = '#mt-claims';
  await go(p, 'mine');
  await change(p, 'claims/i1_zed', {question: 'ما خلفية الشاشة؟', askedAt: Date.now(), askedBy: 'staffA'});
  let n = await tabNum(p, T);
  expect(n?.red === 1 && !n.grey, `الحالة 2: بعد سؤال جديد يجب أن يكون تبويب «الطلبات» أحمر 1 فقط، والموجود: ${JSON.stringify(n)}`);
  await p.click(T); await p.waitForTimeout(400);
  n = await tabNum(p, T);
  expect(n?.red === 0 && n.grey === 1, `الحالة 2: بعد النقر على التبويب يجب أن يختفي الأحمر ويظهر الرمادي 1، والموجود: ${JSON.stringify(n)}`);
  expect(await p.evaluate(() => document.querySelectorAll('.attn-list li').length) === 1, 'الحالة 2: السؤال يجب أن يبقى مهمة في «يحتاج انتباهك» بعد قراءته');
  await reload(p); await go(p, 'mine');
  n = await tabNum(p, T);
  expect(n?.red === 0 && n.grey === 1, `الحالة 2: بعد تحديث الصفحة يجب أن يبقى رمادياً 1 بلا أحمر، والموجود: ${JSON.stringify(n)}`);
  await change(p, 'claims/i1_zed', {question: 'ما لون الغلاف؟', askedAt: Date.now() + 1000});
  n = await tabNum(p, T);
  expect(n?.red === 1 && !n.grey, `الحالة 2: بعد حدث جديد (سؤال آخر) يجب أن يعود أحمر 1، والموجود: ${JSON.stringify(n)}`);
  await ctx.close();
}

// ---------- الحالة 3 و4: موظف عنده بلاغ جديد، وبلاغ فيه ترشيح بانتظار الرد ----------
{
  const {p, ctx} = await open(staff, 'staff');
  const OPEN = '#st-reports-open', PICKED = '#st-reports-picked';
  await go(p, 'staff', {}, {staffTab: 'items'});
  expect(await navNum(p, 'البلاغات') === 1, `الحالة 3: شارة «البلاغات» في الشريط السفلي يجب أن تكون 1 (بلاغ جديد) خارج الصفحة، والموجود: ${await navNum(p, 'البلاغات')}`);
  await go(p, 'staff', {}, {staffTab: 'reports'});
  expect(await navNum(p, 'البلاغات') === 0, 'الحالة 3: شارة «البلاغات» في الشريط السفلي يجب أن تكون 0 داخل صفحة البلاغات');
  let n = await tabNum(p, OPEN);
  expect(n?.red === 1 && !n.grey, `الحالة 3: تبويب «مفتوحة» يجب أن يكون أحمر 1 فقط، والموجود: ${JSON.stringify(n)}`);
  n = await tabNum(p, PICKED);
  expect(n?.red === 0, `الحالة 4: ترشيح بانتظار صاحب البلاغ دون ردّ جديد يجب ألا يكون أحمر، والموجود: ${JSON.stringify(n)}`);
  await p.click(OPEN); await p.waitForTimeout(400);
  n = await tabNum(p, OPEN);
  expect(n?.red === 0 && n.grey === 1, `الحالة 3: بعد النقر على «مفتوحة» يجب أن يختفي الأحمر ويظهر الرمادي 1، والموجود: ${JSON.stringify(n)}`);
  expect(!(await p.evaluate(() => document.querySelector('.mcard.new'))), 'الحالة 3: بعد النقر على التبويب يجب ألا تبقى بطاقة بحدّ «جديد»');
  await reload(p); await go(p, 'staff', {}, {staffTab: 'items'});
  expect(await navNum(p, 'البلاغات') === 0, 'الحالة 3: بعد تحديث الصفحة يجب ألا تعود شارة «البلاغات» في الشريط السفلي');
  await go(p, 'staff', {}, {staffTab: 'reports', staffSub: {reports: 'open'}});
  n = await tabNum(p, OPEN);
  expect(n?.red === 0, `الحالة 3: بعد تحديث الصفحة يجب أن تبقى «مفتوحة» بلا أحمر، والموجود: ${JSON.stringify(n)}`);
  await ctx.close();
}

// ---------- H18: الترتيب بآخر حدث، الأحدث في الأعلى («قراري» و«الحضور» عند الموظف، و«طلباتي» عند الزائر) ----------
{
  const amy = {uid: 'amy', displayName: 'Amy', email: 'amy@example.com'};
  const seed = p => p.evaluate(async ([now, day, O]) => { const fs = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    const c = (it, no, x) => ({itemId: it, officeId: O, uid: 'amy', no, proof: 'x', status: 'pending', codeHash: 'x', ...x});
    await fs.setDoc({path: 'claims/i2_old'}, c('i2', 'REQ-OLD1', {createdAt: now - 3 * day}));                        // أقدم طلب
    await fs.setDoc({path: 'claims/i1_new'}, c('i1', 'REQ-NEW1', {createdAt: now - 60e3}));                          // أُرسل قبل دقيقة
    await fs.setDoc({path: 'claims/i2_ans'}, c('i2', 'REQ-ANS1', {createdAt: now - 4 * day, question: 'q', askedAt: now - 3 * day, answer: 'a', answeredAt: now - 20e3}));   // قديم لكن أُجيب الآن
    await fs.setDoc({path: 'claims/i1_ap1'}, c('i1', 'REQ-AP01', {status: 'approved', createdAt: now - 5 * day, decidedAt: now - 2 * day, pickupBy: now + day}));
    await fs.setDoc({path: 'claims/i2_ap2'}, c('i2', 'REQ-AP02', {status: 'approved', createdAt: now - 5 * day, decidedAt: now - 3600e3, pickupBy: now + 5 * day}));
  }, [now, day, O]).then(() => p.waitForTimeout(600));
  const order = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel)].map(d => d.dataset.card.split(':')[1]), sel);
  const {p, ctx} = await open(staff, 'staff'); await seed(p);
  await go(p, 'staff', {}, {staffTab: 'claims', staffSub: {claims: 'decide'}});
  let o = await order(p, 'details[data-card^="s:"]');
  expect(o.join() === 'i2_ans,i1_new,i1_zed,i2_old', `H18: «قراري» بآخر حدث (الأحدث أولاً)، والموجود: ${o.join()}`);
  expect(await p.evaluate(() => [...document.querySelectorAll('details[data-card^="s:"] summary')].every(s => /ينتظر قرارك/.test(s.textContent))), 'H18: مدة الانتظار يجب أن تبقى ظاهرة على كل بطاقة في «قراري»');
  await go(p, 'staff', {}, {staffTab: 'claims', staffSub: {claims: 'come'}});
  o = await order(p, 'details[data-card^="s:"]');
  expect(o.join() === 'i2_ap2,i1_ap1', `H18: «الحضور» بآخر حدث (آخر قبول أولاً)، والموجود: ${o.join()}`);
  await ctx.close();
  const v = await open(amy, 'visitor'); await seed(v.p);
  await go(v.p, 'mine');
  o = await order(v.p, 'details[data-card^="c:"]');
  expect(o.slice(0, 3).join() === 'i2_ans,i1_new,i2_ap2', `H18: «طلباتي» بآخر حدث (الأحدث أولاً)، والموجود: ${o.join()}`);
  await v.ctx.close();
}

await browser.close(); server.close();
if (fails.length){
  console.log(`✘ فشل ${fails.length} من ${checks} فحصاً للشارات:`);
  for (const f of fails) console.log('- ' + f);
  process.exit(1);
}
console.log(`✔ الشارات سليمة: ${checks} فحصاً (رقم واحد في كل مكان، والأحمر للجديد فقط ويختفي بالقراءة ويبقى مختفياً بعد التحديث).`);
