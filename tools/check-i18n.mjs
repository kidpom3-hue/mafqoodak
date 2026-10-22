// أداة فحص للمطوّر فقط (لا يحمّلها التطبيق): تفشل إذا وُجد حرف عربي في ملفات الكود خارج التعليقات.
// كل نص يراه المستخدم مكانه القاموسان js/i18n/ar.js وjs/i18n/en.js.
// مستثنى: القواميس، وconstants.js (أسماء التصنيفات والقيم المخزّنة)، وsample-data.js، وconfig.js.
// التشغيل من جذر المستودع: node tools/check-i18n.mjs
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXEMPT = new Set(['constants.js', 'sample-data.js', 'config.js']);
const files = [
  ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js') && !EXEMPT.has(f)).map(f => path.join(root, 'js', f)),
  ...fs.readdirSync(path.join(root, 'js/views')).filter(f => f.endsWith('.js')).map(f => path.join(root, 'js/views', f)),
];

// نحذف التعليقات مع مراعاة النصوص (بما فيها القوالب المتداخلة `...${`...`}...`) والتعابير النمطية
function stripComments(src){
  let out = '', i = 0; const stack = [];   // {t:'tpl'} أو {t:'expr', d:عمق الأقواس}
  const top = () => stack[stack.length - 1];
  while (i < src.length){
    const c = src[i], n = src[i + 1];
    if (top()?.t === 'tpl'){
      out += c;
      if (c === '\\'){ out += n ?? ''; i += 2; continue; }
      if (c === '`'){ stack.pop(); i++; continue; }
      if (c === '$' && n === '{'){ out += n; stack.push({t: 'expr', d: 0}); i += 2; continue; }
      i++; continue;
    }
    // داخل الكود (أو داخل ${...})
    if (c === '"' || c === "'"){
      out += c; i++;
      while (i < src.length && src[i] !== c && src[i] !== '\n'){ if (src[i] === '\\'){ out += src[i] + (src[i + 1] ?? ''); i += 2; continue; } out += src[i++]; }
      out += src[i] ?? ''; i++; continue;
    }
    if (c === '`'){ stack.push({t: 'tpl'}); out += c; i++; continue; }
    if (c === '{' && top()?.t === 'expr'){ top().d++; out += c; i++; continue; }
    if (c === '}' && top()?.t === 'expr'){ if (top().d === 0) stack.pop(); else top().d--; out += c; i++; continue; }
    if (c === '/' && n === '/'){ while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*'){ i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '/'){
      const prev = out.replace(/\s+$/, '');
      if (!prev || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\breturn$/.test(prev)){
        let cls = false; out += c; i++;
        while (i < src.length){
          const d = src[i]; out += d;
          if (d === '\\'){ out += src[i + 1] ?? ''; i += 2; continue; }
          if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls){ i++; break; } else if (d === '\n'){ i++; break; }
          i++;
        }
        continue;
      }
    }
    out += c; i++;
  }
  return out;
}

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
let bad = 0;
for (const f of files){
  const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
  lines.forEach((l, k) => { if (ARABIC.test(l)){ bad++; console.log(`${path.relative(root, f)}:${k + 1}: ${l.trim().slice(0, 120)}`); } });
}
if (bad){ console.log(`\n✘ ${bad} سطراً فيه نص عربي خارج القواميس. انقله إلى js/i18n/ar.js وأضف ترجمته في en.js.`); process.exit(1); }
console.log('✔ لا نص عربي في ملفات الكود خارج القواميس والملفات المستثناة.');

// القاموسان متطابقان في المفاتيح، وكل مفتاح ثابت مستخدم في الكود موجود فيهما
const {AR} = await import(new URL('../js/i18n/ar.js', import.meta.url));
const {EN} = await import(new URL('../js/i18n/en.js', import.meta.url));
const miss = [];
for (const k of Object.keys(AR)) if (!(k in EN)) miss.push(`en.js ينقصه: ${k}`);
for (const k of Object.keys(EN)) if (!(k in AR)) miss.push(`ar.js ينقصه: ${k}`);
// صيغ الجمع: نفس النوع (نص أو كائن) في القاموسين
for (const k of Object.keys(AR)) if (k in EN && typeof AR[k] !== typeof EN[k]) miss.push(`نوع مختلف بين القاموسين: ${k}`);
const used = new Set();
for (const f of [...files, path.join(root, 'js/constants.js')]){
  for (const m of stripComments(fs.readFileSync(f, 'utf8')).matchAll(/\bt[pA]?r?\(\s*'([\w.]+)'\s*[,)]/g)) used.add(m[1]);
}
for (const k of used) if (!(k in AR)) miss.push(`مفتاح مستخدم وغير موجود: ${k}`);
if (miss.length){ console.log(miss.join('\n') + `\n✘ ${miss.length} مشكلة في مفاتيح القاموسين.`); process.exit(1); }
console.log(`✔ القاموسان متطابقان (${Object.keys(AR).length} مفتاحاً)، وكل المفاتيح المستخدمة (${used.size}) موجودة.`);

// H6: رقم الإصدار في js/config.js (APP_VERSION) يساوي رقم CACHE في sw.js، فيُرفعان معاً في كل Pull Request
const ver = (fs.readFileSync(path.join(root, 'js/config.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
const cache = (fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/CACHE\s*=\s*'mafqoodak-v([^']+)'/) || [])[1];
if (!ver || ver !== cache){ console.log(`✘ رقم الإصدار غير متطابق: APP_VERSION في js/config.js = ${ver}، وCACHE في sw.js = v${cache}. ارفعهما معاً إلى الرقم نفسه.`); process.exit(1); }
console.log(`✔ رقم الإصدار ${ver} متطابق في js/config.js وsw.js.`);

// H7: بصمة السكربت المضمّن في <head> (المظهر واللغة وحجم الخط) موجودة في سياسة CSP؛ وإلا يُمنع تشغيله
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const { createHash } = await import('crypto');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => 'sha256-' + createHash('sha256').update(m[1]).digest('base64'));
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  const missing = inline.filter(h => !csp.includes(`'${h}'`));
  if (!csp || missing.length){ console.log(`✘ سياسة CSP في index.html ${csp ? 'لا تحوي بصمة السكربت المضمّن: ' + missing.join(' ') : 'غير موجودة'}. انسخ البصمة إلى script-src.`); process.exit(1); }
  if (/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<!--[\s\S]*?-->/g, ''))){ console.log('✘ معالج أحداث مضمّن (onclick/onload…) في index.html: CSP يمنعه. استخدم addEventListener في الكود.'); process.exit(1); }
  // H27: CSP يسمح بمجلد Firebase بإصداره فقط؛ فكل رابط firebasejs في الكود وفي index.html بالإصدار نفسه الذي في CSP،
  // وإلا مُنعت مكتبة Firebase وتوقف التطبيق كله بعد رفع الإصدار
  const cspVer = (csp.match(/https:\/\/www\.gstatic\.com\/firebasejs\/([\d.]+)\//) || [])[1];
  const srcs = [html, ...['js/firebase.js', 'js/ai.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8'))].join('\n');
  const vers = [...new Set([...srcs.replace(csp, '').matchAll(/gstatic\.com\/firebasejs\/([\d.]+)\//g)].map(m => m[1]))];
  if (!cspVer || vers.length !== 1 || vers[0] !== cspVer){ console.log(`✘ إصدار Firebase غير متطابق: CSP = ${cspVer || 'غير موجود'}، والروابط = ${vers.join(', ') || 'لا شيء'}. غيّرها كلها إلى الإصدار نفسه (index.html وjs/firebase.js وjs/ai.js).`); process.exit(1); }
  // H40: مع App Check (مفتاح reCAPTCHA في js/config.js) تحوي CSP ما توصي به Google لـ reCAPTCHA Enterprise في كل توجيه.
  // كان connect-src ينقصه www.google.com/recaptcha/ فتمنع السياسة طلبات reCAPTCHA في كل فتح للموقع الحي (أخطاء في وحدة التحكم)
  const siteKey = (fs.readFileSync(path.join(root, 'js/config.js'), 'utf8').match(/siteKey:\s*'([^']*)'/) || [])[1] || '';
  if (siteKey){
    const dir = n => ((csp.match(new RegExp(`(?:^|;)\\s*${n}\\s+([^;]*)`)) || [])[1] || '').split(/\s+/);
    const need = {'script-src': ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
      'frame-src': ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com'], 'connect-src': ['https://www.google.com/recaptcha/']};
    // https://recaptcha.google.com (الموقع كله) يشمل https://recaptcha.google.com/recaptcha/ الذي في توصية Google
    const lack = Object.entries(need).flatMap(([n, us]) => us.filter(u => !dir(n).some(v => v === u || (u.endsWith('.com') && v.startsWith(u + '/')))).map(u => `${n} ${u}`));
    if (lack.length){ console.log(`✘ سياسة CSP ينقصها ما يحتاجه reCAPTCHA (App Check): ${lack.join('، ')}.`); process.exit(1); }
  }
  console.log(`✔ سياسة CSP تحوي بصمة ${inline.length} سكربت مضمّن، ولا معالجات مضمّنة في index.html، وإصدار Firebase ${cspVer} متطابق فيها وفي الكود${siteKey ? '، وكل مصادر reCAPTCHA (App Check)' : ''}.`);
}

// H31: قواعد الصياغة (H24) في القاموسين، حتى لا يعود نص مخالف مع أي إضافة:
// لا «!»، ولا «كود» (بل «رمز»)، ولا صيغة المتكلم الجمع (نحن، أرسلنا، سنخبرك… / we, our, us)،
// وكل «اضغط «…»» يقتبس نص زر موجوداً في القاموس نفسه حرفياً (عدا أزرار نظام iPhone في خطوات التثبيت، والمتغيرات {…})
{
  const flat = o => Object.entries(o).flatMap(([k, v]) => typeof v === 'string' ? [[k, v]] : Object.entries(v).map(([f, s]) => [`${k}#${f}`, s]));
  const ar = flat(AR), en = flat(EN), bad = [];
  const plain = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');
  for (const [k, v] of [...ar, ...en]) if (plain(v).includes('!')) bad.push(`«!» في ${k}: ${v.slice(0, 60)}`);
  for (const [k, v] of ar) if (/كود/.test(v)) bad.push(`«كود» (اكتب «رمز») في ${k}`);
  // حدود الكلمة العربية: بداية/نهاية النص أو مسافة أو علامة ترقيم (\b لا يعمل مع الحروف العربية)
  const B = '(?:^|[\\s«»"\'(،.؛:؟—–-])', E = '(?=$|[\\s«»"\')،.؛:؟—–-])';
  const WE_AR = new RegExp(B + '(?:و|ف)?(?:نحن|لدينا|عندنا|يسعدنا|نرجو|نعتذر|نشكرك|نأسف|سن(?:خبر|نبّه|نبه|رسل|راجع|تواصل|ساعد)[\\u0600-\\u06FF]*|ن(?:خبر|نبّه|نبه|رسل|راجع|تواصل)[\\u0600-\\u06FF]*|(?:أرسل|سجّل|سجل|استلم|راجع|حفظ|أضف|وجد|تلقّي|تلقي)نا)' + E, 'u');
  for (const [k, v] of ar) if (WE_AR.test(plain(v))) bad.push(`صيغة المتكلم الجمع في ${k}: ${plain(v).slice(0, 60)}`);
  for (const [k, v] of en) if (/\b(?:we|we'll|we've|we're|our|ours|us)\b/i.test(plain(v))) bad.push(`first person plural in ${k}: ${plain(v).slice(0, 60)}`);
  const OS = new Set(['إضافة', 'إضافة إلى الشاشة الرئيسية', 'Add', 'Add to Home Screen']);
  for (const [list, re] of [[ar, /(?:اضغط|اختر) «([^»]+)»/g], [en, /\b(?:[Tt]ap|[Pp]ress|[Cc]lick|[Ss]elect|[Cc]hoose) “([^”]+)”/g]]){
    const labels = new Set(list.map(([, v]) => plain(v).trim()));
    for (const [k, v] of list) for (const m of v.matchAll(re)){ const q = m[1].trim(); if (!labels.has(q) && !OS.has(q) && !/^\{\w+\}$/.test(q)) bad.push(`${k}: «${q}» ليس نص زر في القاموس (اقتبس نص الزر الحالي حرفياً)`); }
  }
  if (bad.length){ console.log(bad.join('\n') + `\n✘ ${bad.length} مخالفة لقواعد الصياغة (CLAUDE.md، H24).`); process.exit(1); }
  console.log('✔ قواعد الصياغة: لا «!» ولا «كود» ولا صيغة المتكلم الجمع، وكل «اضغط «…»» يقتبس زراً موجوداً.');
}

// H31: سرعة الفتح والعمل دون اتصال:
// 1) قائمة <link rel="modulepreload"> في index.html = الوحدات الفورية (كل ما يستورده main.js مباشرة أو بالتسلسل) بلا زيادة ولا نقص:
//    الناقصة تُنزَّل متأخرة على التتابع، والزائدة (وحدة كسولة من lazy.js) تُنزَّل بلا حاجة في كل زيارة
// 2) قائمة SHELL في sw.js فيها كل ملفات js (الفورية والكسولة) وكل ملف شعار في BRANDS، ليعمل التطبيق كاملاً دون اتصال
{
  const eager = new Set();
  const walk = f => { if (eager.has(f)) return; eager.add(f);
    for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/^import\s(?:[^'"]*?\sfrom\s)?['"](\.{1,2}\/[^'"]+)['"]/gm)) walk(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]))); };
  walk('js/main.js');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const pre = new Set([...html.matchAll(/rel="modulepreload" href="(js\/[^"]+)"/g)].map(m => m[1]));
  const bad = [...[...eager].filter(f => !pre.has(f)).map(f => `ينقص modulepreload في index.html: ${f}`), ...[...pre].filter(f => !eager.has(f)).map(f => `modulepreload لوحدة غير فورية (كسولة أو غير مستخدمة): ${f}`)];
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const shell = new Set([...(sw.match(/const SHELL = \[([\s\S]*?)\];/) || [, ''])[1].matchAll(/'\.\/([^']+)'/g)].map(m => m[1]));
  const jsAll = ['js', 'js/views', 'js/i18n'].flatMap(d => fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));
  for (const f of jsAll) if (!shell.has(f)) bad.push(`ينقص SHELL في sw.js: ./${f}`);
  const logos = [...fs.readFileSync(path.join(root, 'js/constants.js'), 'utf8').matchAll(/'(icons\/college\/[^']+)'/g)].map(m => m[1]);
  for (const f of new Set(logos)){ if (!shell.has(f)) bad.push(`ينقص SHELL في sw.js: ./${f}`); if (!fs.existsSync(path.join(root, f))) bad.push(`ملف شعار غير موجود: ${f}`); }
  for (const f of shell) if (f && !fs.existsSync(path.join(root, f))) bad.push(`في SHELL ملف غير موجود: ./${f}`);
  if (bad.length){ console.log(bad.join('\n') + `\n✘ ${bad.length} مشكلة في التحميل المسبق أو قائمة العمل دون اتصال.`); process.exit(1); }
  console.log(`✔ modulepreload = الوحدات الفورية (${eager.size})، وSHELL فيه كل ملفات js (${jsAll.length}) والشعارات.`);
}
