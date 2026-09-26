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
