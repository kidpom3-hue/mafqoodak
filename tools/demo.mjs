// H38: اختبار مقطع «خطوات الخدمة» في واجهة الصفحة الرئيسية (للمطوّر فقط؛ لا يحمّله التطبيق).
// يشغّل التطبيق من هذا المستودع مع بدائل Firebase (tools/a11y-stubs) ويتأكد من: تزامن الحركات الثلاثين بعد أكثر من دورة،
// وأن التحديث الحي ووصول غرض جديد لا يعيدان رسم المقطع (ولا يُلغيان الإيقاف)، والإيقاف والاستئناف، وترتيب Tab ومساحة اللمس،
// واللغتين والمظهر الداكن والتنقل، و«تقليل الحركة»، وعدم التمرير الأفقي في عروض وأحجام خط مختلفة،
// وكلفة المعالج الرئيسي (الحركات transform/opacity فقط)، والعمل دون اتصال عبر عامل الخدمة (يحتاج openssl لخادم https محلي).
// التشغيل: cd tools && npm run demo
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mfq-demo-'));
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'};
const handler = root => (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
};
const listen = s => new Promise(r => s.listen(0, () => r(s.address().port)));
const PORT = await listen(http.createServer(handler(ROOT)));
const stub = f => fs.readFileSync(path.join(ROOT, 'tools/a11y-stubs', f), 'utf8');

const now = Date.now(), O = 'tc-ahsa';
const db = {
  'config/app': {ownerUid: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', nameEn: 'Technical College in Al-Ahsa', type: 'college', city: 'الأحساء', place: 'المبنى الإداري', hours: 'الأحد – الخميس', phone: '0135000000', retentionDays: 90, pickupDays: 7, reviewDays: 2, spots: ['المكتبة'], active: true, createdAt: 1, code: 'TCA'},
  'items/i1': {officeId: O, ref: 'TCA-I1', cat: 'phones', sub: 'جوال', title: 'جوال', foundDate: '2026-10-15', photo: false, status: 'available', createdBy: 'staffA', createdAt: now - 864e5, updatedAt: now, public: true},
};
const results = []; const ok = (name, pass, info = '') => { results.push(pass); console.log(`${pass ? '✔' : '✘'} ${name}${info ? ' — ' + info : ''}`); };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const consoleErrs = [];
async function open({w = 390, scheme = 'light', reduced = false, lang = 'ar', text = '', port = PORT, b = browser, base = 'http', ctxOpts = {}} = {}){
  const ctx = await b.newContext({viewport: {width: w, height: 900}, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', ...ctxOpts});
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('firestore.js')}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider { constructor(k){ this.key = k; } }'}));
  await ctx.addInitScript(`window.__FAKE = ${JSON.stringify({db, reads: [], writes: [], user: null})}; localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${lang}"'); localStorage.setItem('mfq:mode', '"visitor"');${text ? ` localStorage.setItem('mfq:text', '"${text}"');` : ''}`);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  await p.goto(`${base}://localhost:${port}/`); await p.waitForTimeout(900);
  return {ctx, p, errs};
}
const md = `document.getAnimations().filter(a => (a.animationName || '').startsWith('md-'))`;

// 1) التزامن بعد أكثر من دورة كاملة: كل الحركات على اللحظة نفسها
{
  const {ctx, p, errs} = await open();
  await p.waitForTimeout(12500);
  const r = await p.evaluate(`(() => { const a = ${md}; const ts = a.map(x => x.currentTime % 10000); return {n: a.length, spread: Math.max(...ts) - Math.min(...ts), states: [...new Set(a.map(x => x.playState))]}; })()`);
  ok('1. الحركات الـ30 متزامنة بعد 12.5 ثانية (دورة وربع)', r.n === 30 && r.spread < 40 && r.states.join() === 'running', JSON.stringify(r));
  ok('   بلا أخطاء في الصفحة', !errs.length, errs.join(' | '));
  await ctx.close();
}
// 2) التحديث الحي وإضافة غرض جديد لا يعيدان رسم المقطع ولا يبدآنه من جديد، وحالة الإيقاف تبقى
{
  const {ctx, p, errs} = await open();
  await p.evaluate(`window.__d = document.querySelector('.mfq-demo')`);
  const t0 = await p.evaluate(`${md}[0].currentTime`);
  await p.evaluate(async () => { (await import('./js/ui.js')).refresh(); });
  await p.waitForTimeout(400);
  const r1 = await p.evaluate(`({same: window.__d === document.querySelector('.mfq-demo'), t: ${md}[0].currentTime})`);
  ok('2. refresh() (تحديث حي) يبقي المقطع نفسه ويكمل من حيث كان', r1.same && r1.t > t0, `t0=${Math.round(t0)} t1=${Math.round(r1.t)}`);
  await p.click('.md-pause'); await p.waitForTimeout(100);
  await p.evaluate(async (n) => {
    const m = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    await m.setDoc(m.doc({}, 'items/i9'), {officeId: 'tc-ahsa', ref: 'TCA-B9', cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة ظهر', foundDate: '2026-10-17', photo: false, status: 'available', createdBy: 'staffA', createdAt: n, updatedAt: n, public: true});
  }, Date.now());
  await p.waitForTimeout(800);
  const r2 = await p.evaluate(`({same: window.__d === document.querySelector('.mfq-demo'), checked: document.querySelector('#md-pause').checked, paused: ${md}.every(a => a.playState === 'paused'), latest: document.querySelector('#home-latest')?.textContent || ''})`);
  ok('   غرض جديد يصل من قاعدة البيانات: يظهر في «أحدث المفقودات» والمقطع لم يُعَد رسمه والإيقاف باقٍ', r2.same && r2.checked && r2.paused && /حقيبة/.test(r2.latest), JSON.stringify({...r2, latest: r2.latest.slice(0, 60)}));
  ok('   بلا أخطاء', !errs.length, errs.join(' | '));
  await ctx.close();
}
// 3) الإيقاف المؤقت والاستئناف
{
  const {ctx, p} = await open();
  await p.click('.md-pause'); await p.waitForTimeout(80);
  const a = await p.evaluate(`({s: [...new Set(${md}.map(x => x.playState))], t: ${md}[0].currentTime})`);
  await p.waitForTimeout(900);
  const b2 = await p.evaluate(`${md}[0].currentTime`);
  await p.click('.md-pause'); await p.waitForTimeout(500);
  const c = await p.evaluate(`({s: [...new Set(${md}.map(x => x.playState))], t: ${md}[0].currentTime})`);
  ok('3. زر الإيقاف يوقف الحركات الـ30 كلها ويستأنفها', a.s.join() === 'paused' && Math.abs(b2 - a.t) < 1 && c.s.join() === 'running' && c.t > b2 + 300, `paused=${a.s} frozen=${Math.round(a.t)}→${Math.round(b2)} resumed=${c.s} ${Math.round(c.t)}`);
  await ctx.close();
}
// 4) ترتيب Tab يطابق ما يُرى: البحث ← الزرّان ← زر الإيقاف (هاتف وكمبيوتر)
for (const w of [390, 1280]){
  const {ctx, p} = await open({w});
  await p.focus('#hq');
  const seq = [];
  for (let i = 0; i < 4; i++){ await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement; return e.id || e.dataset.r || e.className || e.tagName; })); }
  ok(`4. ترتيب Tab عند ${w}px`, seq.join(' > ') === 'btn > report > found > md-pause', seq.join(' > '));
  const vis = await p.evaluate(() => { const r = document.querySelector('.md-pause').getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); });
  ok(`   مساحة لمس زر الإيقاف ≥ 36px عند ${w}px`, vis >= 36, vis + 'px');
  await ctx.close();
}
// 5) تبديل اللغة والمظهر والتنقل ذهاباً وإياباً
{
  const {ctx, p, errs} = await open();
  await p.evaluate(async () => { const i = await import('./js/i18n.js'); await i.setLang('en'); (await import('./js/ui.js')).renderAll(); });
  await p.waitForTimeout(500);
  const en = await p.evaluate(() => ({dir: document.documentElement.dir, d: getComputedStyle(document.querySelector('.mfq-demo')).getPropertyValue('--md-d').trim(), cap: document.querySelector('.md-c1').textContent, q: document.querySelector('.md-q').textContent, label: document.querySelector('label.md-pause').textContent.trim()}));
  ok('5. الإنجليزية: الاتجاه ونصوص المقطع', en.dir === 'ltr' && en.d === '-1' && /Search or file a report/.test(en.cap) && en.q === 'Wallet' && en.label === 'Pause animation', JSON.stringify(en));
  await p.evaluate(async () => { const i = await import('./js/i18n.js'); await i.setLang('ar'); (await import('./js/ui.js')).renderAll(); });
  await p.waitForTimeout(400);
  const ar = await p.evaluate(() => ({dir: document.documentElement.dir, d: getComputedStyle(document.querySelector('.mfq-demo')).getPropertyValue('--md-d').trim(), cap: document.querySelector('.md-c1').textContent}));
  ok('   العودة للعربية', ar.dir === 'rtl' && ar.d === '1' && /البحث/.test(ar.cap), JSON.stringify(ar));
  await p.evaluate(async () => { (await import('./js/theme.js')).setTheme('dark'); });
  await p.waitForTimeout(200);
  const dk = await p.evaluate(() => ({theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.querySelector('.md-screen')).backgroundColor}));
  ok('   المظهر الداكن يغيّر ألوان المقطع', dk.theme === 'dark' && dk.bg === 'rgb(16, 28, 30)', JSON.stringify(dk));
  await p.evaluate(async () => { (await import('./js/theme.js')).setTheme('auto'); });
  await p.evaluate(async () => { const u = await import('./js/ui.js'); u.go('browse'); }); await p.waitForTimeout(600);
  const gone = await p.evaluate(() => document.querySelectorAll('.mfq-demo').length);
  await p.evaluate(async () => { const u = await import('./js/ui.js'); u.go('home'); }); await p.waitForTimeout(700);
  const back = await p.evaluate(`({n: document.querySelectorAll('.mfq-demo').length, ids: document.querySelectorAll('#md-pause').length, anims: ${md}.length})`);
  ok('   التنقل: المقطع في الرئيسية فقط، ومرة واحدة بعد العودة', gone === 0 && back.n === 1 && back.ids === 1 && back.anims === 30, `browse=${gone} ${JSON.stringify(back)}`);
  ok('   بلا أخطاء طوال ذلك', !errs.length, errs.join(' | '));
  await ctx.close();
}
// 6) تقليل الحركة: لا حركة إطلاقاً (ولا في ::before/::after)، والخطوات الثلاث ظاهرة كقائمة
{
  const {ctx, p} = await open({reduced: true});
  const r = await p.evaluate(`(() => { const caps = [...document.querySelectorAll('.md-cap')].map(c => ({o: +getComputedStyle(c).opacity, y: Math.round(c.getBoundingClientRect().top)})); return {anims: document.getAnimations().filter(a => (a.animationName||'').startsWith('md-')).length, caps, pauseShown: getComputedStyle(document.querySelector('.md-pause')).display !== 'none'}; })()`);
  ok('6. تقليل الحركة: صفر حركات، والخطوات الثلاث مرئية تحت بعضها، وزر الإيقاف مخفي', r.anims === 0 && r.caps.every(c => c.o === 1) && new Set(r.caps.map(c => c.y)).size === 3 && !r.pauseShown, JSON.stringify(r));
  await ctx.close();
}
// 7) أحجام الخط والعروض الضيقة: لا تمرير أفقي
for (const [w, text] of [[320, ''], [320, 'l'], [320, 'xl'], [360, 'xl'], [390, 'xl'], [768, ''], [820, ''], [1024, 'l'], [1440, '']]){
  const {ctx, p} = await open({w, text});
  const r = await p.evaluate(() => ({sx: document.documentElement.scrollWidth - innerWidth, demoW: Math.round(document.querySelector('.mfq-demo').getBoundingClientRect().width)}));
  ok(`7. عرض ${w}px${text ? ' وخط ' + text : ''}: لا تمرير أفقي`, r.sx <= 0, JSON.stringify(r));
  await ctx.close();
}
// 8) الأداء: وقت المعالج الرئيسي في الصفحة الرئيسية خلال 10 ثوانٍ (كان ≈ 77ms من كل ثانية قبل تحويل الحركات إلى transform/opacity)
const perf = async port => {
  const {ctx, p} = await open({port});
  await p.waitForTimeout(1500);
  const s = await ctx.newCDPSession(p); await s.send('Performance.enable');
  const get = async () => Object.fromEntries((await s.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const a = await get(); await p.waitForTimeout(10000); const b2 = await get();
  await ctx.close();
  const d = k => (b2[k] - a[k]) * 1000 / 10;   // ms لكل ثانية
  return {task: +d('TaskDuration').toFixed(1), layout: +d('LayoutDuration').toFixed(1), style: +d('RecalcStyleDuration').toFixed(1), script: +d('ScriptDuration').toFixed(1)};
};
{
  const r = await perf(PORT);
  ok('8. الأداء: أقل من 5ms من كل ثانية على المعالج الرئيسي، وبلا إعادة حساب للأنماط أو التخطيط', r.task < 5 && r.style < 1 && r.layout < 1, JSON.stringify(r));
}
// 9) العمل دون اتصال: عامل الخدمة (https) يحفظ الإصدار الحالي ويعرض الرئيسية بالمقطع دون شبكة
let ssl = true; try { execSync('openssl version', {stdio: 'ignore'}); } catch (e) { ssl = false; console.log('⚠ تخطّي اختبار العمل دون اتصال: openssl غير متاح'); }
if (ssl){
  try {
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${TMP}/k.pem -out ${TMP}/c.pem -days 1 -subj "/CN=localhost" 2>/dev/null`);
    const sp = await listen(https.createServer({key: fs.readFileSync(`${TMP}/k.pem`), cert: fs.readFileSync(`${TMP}/c.pem`)}, handler(ROOT)));
    const b3 = await chromium.launch({args: ['--ignore-certificate-errors']});
    const {ctx, p, errs} = await open({b: b3, port: sp, base: 'https', ctxOpts: {ignoreHTTPSErrors: true}});
    const ver = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8').match(/APP_VERSION = '(\d+)'/)[1];
    const sw = await p.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready.then(() => 'ready'), new Promise(x => setTimeout(() => x('timeout'), 8000))]); return r; });
    await p.waitForTimeout(1500);
    const cached = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('mafqoodak-v'))); const css = await (await c.match('./css/styles.css'))?.text(); const js = await (await c.match('./js/views/home.js'))?.text(); return {keys: ks, css: /mfq-demo/.test(css || ''), js: /howDemo/.test(js || '')}; });
    await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(1500);
    const off = await p.evaluate(`({demo: !!document.querySelector('.mfq-demo'), anims: ${md}.length, h1: document.querySelector('#main h1')?.textContent || ''})`);
    ok(`9. دون اتصال: الإصدار ${ver} محفوظ (styles.css وhome.js بالمقطع) والرئيسية تعمل به`, sw === 'ready' && cached.keys.includes('mafqoodak-v' + ver) && cached.css && cached.js && off.demo && off.anims === 30, JSON.stringify({sw, ...cached, ...off}));
    ok('   بلا أخطاء دون اتصال', !errs.length, errs.join(' | '));
    await ctx.close(); await b3.close();
  } catch (e) { ok('9. العمل دون اتصال', false, 'تعذّر الاختبار: ' + e.message); }
}
ok('أخطاء console خلال كل الاختبارات', consoleErrs.length === 0, consoleErrs.slice(0, 5).join(' | '));
await browser.close(); fs.rmSync(TMP, {recursive: true, force: true});
console.log(results.every(Boolean) ? `\nالنتيجة: نجحت كل الفحوص (${results.length})` : `\nالنتيجة: فشل ${results.filter(x => !x).length} من ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
