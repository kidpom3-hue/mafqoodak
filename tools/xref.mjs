// فحص المراجع المتقاطعة في الكود (للمطوّر فقط؛ لا يحمّله التطبيق). بلا متصفح ولا حزم: يقرأ الملفات نصاً بمحلّل صغير
// (نصوص وقوالب ${…} وتعليقات وتعابير نمطية)، ويفشل عند أي مرجع لا يقابله شيء:
//  1) data-act="x" في القوالب ← دالة ACT.x في actions.js (زر بلا عمل)، وdata-form="x" ← فرع kind === 'x' في submitForm
//  2) المسارات: go('x') وdata-r="x" ← ROUTES في ui.js؛ ومسار كسول ← وحدة في lazy.js تُصدِّر دوال v/update/after
//  3) mod('x')/need('x')/load('x') ← LOADERS في lazy.js، وما يُستدعى منها (SM().f، mod('x')?.f، (await load('x')).f) ← تصدير فعلي
//  4) icon('x') ← أيقونة في P (constants.js)؛ الاسم المجهول كان يرسم صندوقاً بدل الأيقونة بلا أي خطأ
//  5) النصوص: كل {x} في نص القاموس تمرّره كل دعوة t/tAr/tp/tIn له (وإلا ظهر «{x}» حرفياً)، والقاموسان بالمتغيرات نفسها لكل مفتاح،
//     وكل مفتاح بصيغ العدد فيه other، والمفاتيح المركّبة ('qa.sug.' + cat…) موجودة لكل قيمة معروفة لها
//  6) القوائم المكررة بين js/constants.js وfirestore.rules: DETAIL_KEYS، HIGH_VALUE، GROUP_CATS، HIDDEN_CATS، REG_BLOCK، DELEGATE_BLOCK،
//     ومدة حفظ التصنيفات (retentionDays ↔ keepDays)
//  7) H41: كل اسم مستورد مستخدم في ملفه، وكل دالة أو ثابت في أعلى الملف مستدعى (لا كود ميت)
// التشغيل: cd tools && npm run xref
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rel = f => path.relative(root, f);
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
const FILES = walk(path.join(root, 'js')).filter(f => !f.includes(`${path.sep}i18n${path.sep}`));
const SRC = Object.fromEntries(FILES.map(f => [rel(f), fs.readFileSync(f, 'utf8')]));
const fails = [];
const fail = (where, msg) => fails.push(`${where}: ${msg}`);
let checks = 0;

/* ---------- محلّل صغير: رموز JavaScript بمواضعها، والقوالب بقطعها وتعابيرها ---------- */
const KW_BEFORE_RE = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
export function tokenize(s){
  const out = [], stack = []; let i = 0, depth = 0;
  const line = p => s.slice(0, p).split('\n').length;
  const regexOk = () => { const p = out[out.length - 1]; if (!p) return true;
    if (p.t === 'num' || p.t === 'str' || p.t === 'regex' || p.t === 'tplend') return false;
    if (p.t === 'id') return KW_BEFORE_RE.has(p.v);
    if (p.t === 'p') return !(p.v === ')' || p.v === ']' || p.v === '}');
    return true; };
  function tpl(j){
    let raw = '';
    while (j < s.length){
      if (s[j] === '\\'){ raw += s.slice(j, j + 2); j += 2; continue; }
      if (s[j] === '`'){ out.push({t: 'chunk', v: raw, p: j}); out.push({t: 'tplend', p: j}); return j + 1; }
      if (s[j] === '$' && s[j + 1] === '{'){ out.push({t: 'chunk', v: raw, p: j}); out.push({t: 'p', v: '${', p: j}); stack.push(depth); return j + 2; }
      raw += s[j++];
    }
    return j;
  }
  while (i < s.length){
    const c = s[i];
    if (c === '}' && stack.length && depth === stack[stack.length - 1]){ stack.pop(); out.push({t: 'p', v: '}$', p: i}); i = tpl(i + 1); continue; }
    if (/\s/.test(c)){ i++; continue; }
    if (c === '/' && s[i + 1] === '/'){ const e = s.indexOf('\n', i); i = e < 0 ? s.length : e; continue; }
    if (c === '/' && s[i + 1] === '*'){ const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; continue; }
    if (c === "'" || c === '"'){
      let j = i + 1, v = '';
      while (j < s.length && s[j] !== c){ if (s[j] === '\\'){ v += s[j + 1]; j += 2; } else v += s[j++]; }
      out.push({t: 'str', v, p: i}); i = j + 1; continue;
    }
    if (c === '`'){ out.push({t: 'tpl', p: i}); i = tpl(i + 1); continue; }
    if (/[A-Za-z_$\u0080-￿]/.test(c)){ let j = i; while (j < s.length && /[\w$\u0080-￿]/.test(s[j])) j++; out.push({t: 'id', v: s.slice(i, j), p: i}); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1]))){ let j = i; while (j < s.length && /[\w.]/.test(s[j])) j++; out.push({t: 'num', v: s.slice(i, j), p: i}); i = j; continue; }
    if (c === '/' && regexOk()){
      let j = i + 1, cls = false;
      while (j < s.length){ const d = s[j]; if (d === '\\'){ j += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; else if (d === '\n') break; j++; }
      j++; while (j < s.length && /[a-z]/.test(s[j])) j++;
      out.push({t: 'regex', v: s.slice(i, j), p: i}); i = j; continue;
    }
    const three = s.slice(i, i + 3), two = s.slice(i, i + 2);
    const v = three === '...' || three === '===' || three === '!==' ? three : ['=>', '?.', '??', '||', '&&', '==', '!=', '<=', '>=', '++', '--', '+=', '-='].includes(two) ? two : c;
    if (v === '{') depth++; else if (v === '}') depth--;
    out.push({t: 'p', v, p: i}); i += v.length;
  }
  out.line = line;
  return out;
}
// وسائط الاستدعاء الذي يبدأ قوسه عند الرمز k: قوائم رموز لكل وسيط، ونهاية الاستدعاء
function callArgs(tk, k){
  const args = [[]]; let d = 0, j = k + 1;
  for (; j < tk.length; j++){
    const x = tk[j];
    if (x.t === 'p' && ['(', '[', '{', '${'].includes(x.v)) d++;
    if (x.t === 'p' && [')', ']', '}', '}$'].includes(x.v)){ if (d === 0) break; d--; }
    if (d === 0 && x.t === 'p' && x.v === ','){ args.push([]); continue; }
    args[args.length - 1].push(x);
  }
  if (args.length === 1 && !args[0].length) args.pop();
  return {args, end: j};
}
// مفاتيح كائن حرفي {a, b: 1, 'c': 2}؛ null إن كان فيه نشر (...x) أو مفتاح محسوب، فلا يُحكم عليه
function objKeys(arg){
  if (!arg?.length || arg[0].t !== 'p' || arg[0].v !== '{') return null;
  const keys = new Set(); let d = 0, start = true;
  for (let j = 1; j < arg.length; j++){
    const x = arg[j];
    if (x.t === 'p' && ['(', '[', '{', '${'].includes(x.v)){ if (d === 0 && start && x.v === '[') return null; d++; start = false; continue; }
    if (x.t === 'p' && [')', ']', '}', '}$'].includes(x.v)){ d--; continue; }
    if (d !== 0) continue;
    if (x.t === 'p' && x.v === ','){ start = true; continue; }
    if (start){
      if (x.t === 'p' && x.v === '...') return null;
      if (x.t === 'id' || x.t === 'str' || x.t === 'num') keys.add(x.v);
      start = false;
    }
  }
  return keys;
}
// مفتاح نصي ثابت، أو نمط لمفتاح مركّب ('a.' + x، `a.${x}.b`)، أو null
function keyOf(arg){
  if (!arg?.length) return null;
  if (arg.length === 1 && arg[0].t === 'str') return {key: arg[0].v};
  if (arg[0].t === 'tpl'){
    let re = '', d = 0;
    for (const x of arg.slice(1)){
      if (x.t === 'chunk' && d === 0) re += x.v.replace(/[.*+?^()|[\]\\]/g, '\\$&');
      else if (x.t === 'p' && x.v === '${'){ if (d === 0) re += '[\\w.-]+'; d++; }
      else if (x.t === 'p' && x.v === '}$') d--;
    }
    return {re: new RegExp('^' + re + '$'), dyn: true};
  }
  if (arg[0].t === 'str' && arg[1]?.t === 'p' && arg[1].v === '+'){
    // 'a.' + x + '.b': النص الأخير بعد آخر «+» (إن كان نصاً) لاحقة ثابتة
    const n = arg.length, lit = n > 3 && arg[n - 1].t === 'str' && arg[n - 2].t === 'p' && arg[n - 2].v === '+' ? arg[n - 1].v : '';
    return {re: new RegExp('^' + arg[0].v.replace(/[.*+?^()|[\]\\]/g, '\\$&') + '[\\w.-]+' + lit.replace(/[.*+?^()|[\]\\]/g, '\\$&') + '$'), dyn: true};
  }
  return null;
}
const TK = Object.fromEntries(Object.entries(SRC).map(([f, s]) => [f, tokenize(s)]));
// كل الاستدعاءات name(...) غير المسبوقة بنقطة (لا obj.name)
function calls(names){
  const out = [];
  for (const [f, tk] of Object.entries(TK)) tk.forEach((x, k) => {
    if (x.t !== 'id' || !names.includes(x.v) || tk[k + 1]?.t !== 'p' || tk[k + 1].v !== '(') return;
    const prev = tk[k - 1]; if (prev?.t === 'p' && (prev.v === '.' || prev.v === '?.')) return;
    if (prev?.t === 'id' && (prev.v === 'function' || prev.v === 'async' && tk[k - 2]?.v === 'export')) return;
    const {args} = callArgs(tk, k + 1);
    out.push({f, line: tk.line(x.p), name: x.v, args});
  });
  return out;
}
// كل نص في القوالب والنصوص (لفحص data-act وdata-form وdata-r)
const textOf = f => TK[f].filter(x => x.t === 'chunk' || x.t === 'str').map(x => ({v: x.v, line: TK[f].line(x.p)}));
const exportsOf = s => new Set([...s.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([\w$]+)/g)].map(m => m[1])
  .concat([...s.matchAll(/export\s*\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean))));

/* ---------- 1) الأزرار والنماذج ---------- */
const act = SRC['js/actions.js'];
const actBlock = act.slice(act.indexOf('const ACT = {'), act.indexOf('\n};', act.indexOf('const ACT = {')));
const ACT = new Set([...actBlock.matchAll(/^ {2}(?:async )?([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]));
const sfBlock = act.slice(act.indexOf('async function submitForm'), act.indexOf('const ACT = {'));
const KINDS = new Set([...sfBlock.matchAll(/kind === '(\w+)'/g)].map(m => m[1]));
const used = {act: new Map(), form: new Map(), r: new Map()};
for (const f of Object.keys(SRC)) for (const {v, line} of textOf(f)){
  for (const [k, re] of [['act', /data-act="([\w$]+)"/g], ['form', /data-form="([\w$]+)"/g], ['r', /data-r="([\w$]+)"/g]]) for (const m of v.matchAll(re)) used[k].set(m[1], `${f}:${line}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/data-act="([\w$]+)"/g)) used.act.set(m[1], 'index.html');
for (const [a, where] of used.act){ checks++; if (!ACT.has(a)) fail(where, `data-act="${a}" بلا دالة ACT.${a} في js/actions.js (الزر لا يعمل)`); }
for (const [k, where] of used.form){ checks++; if (!KINDS.has(k) && k !== 'homeSearch') fail(where, `data-form="${k}" بلا فرع kind === '${k}' في submitForm`); }
for (const k of KINDS){ checks++; if (!used.form.has(k) && !['login', 'setup'].some(x => x === k && SRC['js/views/auth.js'].includes(`data-form="${k}"`))) fail('js/actions.js', `فرع submitForm للنموذج «${k}» ولا نموذج data-form="${k}" في الواجهة`); }

/* ---------- 2) و3) المسارات والوحدات الكسولة ---------- */
const ui = SRC['js/ui.js'], lazy = SRC['js/lazy.js'];
const rBlock = ui.slice(ui.indexOf('const ROUTES = {'), ui.indexOf('\n};', ui.indexOf('const ROUTES = {')));
const ROUTES = Object.fromEntries([...rBlock.matchAll(/^\s+(\w+):\s*\{([^}]*)\}/gm)].map(m => [m[1], Object.fromEntries([...m[2].matchAll(/(\w+):\s*'([^']*)'/g)].map(x => [x[1], x[2]]))]));
const LOADERS = Object.fromEntries([...lazy.matchAll(/^\s+(\w+):\s*\(\)\s*=>\s*import\('\.\/([^']+)'\)/gm)].map(m => [m[1], 'js/' + m[2].replace(/^\.\//, '')]));
const EXP = Object.fromEntries(Object.entries(LOADERS).map(([n, f]) => [n, exportsOf(SRC[f] || '')]));
for (const [r, o] of Object.entries(ROUTES)) if (o.lazy){
  checks++;
  if (!LOADERS[o.lazy]){ fail('js/ui.js', `المسار ${r}: وحدة كسولة «${o.lazy}» غير موجودة في lazy.js`); continue; }
  for (const k of ['v', 'update', 'after']) if (o[k]){ checks++; if (!EXP[o.lazy].has(o[k])) fail('js/ui.js', `المسار ${r}: ${k}: '${o[k]}' لا تُصدّره ${LOADERS[o.lazy]}`); }
}
for (const c of calls(['go'])){
  const k = keyOf(c.args[0]); if (!k?.key) continue; checks++;
  if (!ROUTES[k.key]) fail(`${c.f}:${c.line}`, `go('${k.key}') والمسار غير موجود في ROUTES`);
}
for (const [r, where] of used.r){ checks++; if (!ROUTES[r]) fail(where, `data-r="${r}" والمسار غير موجود في ROUTES`); }
for (const c of calls(['mod', 'need', 'load'])){
  const k = keyOf(c.args[0]); if (!k?.key) continue; checks++;
  if (!LOADERS[k.key]) fail(`${c.f}:${c.line}`, `${c.name}('${k.key}') والوحدة غير موجودة في lazy.js`);
}
// ما يُستدعى من الوحدات الكسولة: SM()?.f / SM().f (staff)، mod('x')?.f، need('x')?.f، (await load('x')).f، load('x').then(m => m.f)
for (const [f, s] of Object.entries(SRC)){
  const pats = [[/\bSM\(\)\??\.([\w$]+)/g, () => 'staff'], [/\b(?:mod|need)\('(\w+)'\)\??\.([\w$]+)/g, m => m[1]],
    [/\(await load\('(\w+)'\)\)\.([\w$]+)/g, m => m[1]], [/\bload\('(\w+)'\)\.then\(\s*(\w+)\s*=>\s*\2\.([\w$]+)/g, m => m[1]]];
  for (const [re, nameOf] of pats) for (const m of s.matchAll(re)){
    const name = nameOf(m), fn = m[m.length - 1]; if (fn === 'then' || !EXP[name]) continue; checks++;
    if (!EXP[name].has(fn)) fail(`${f}:${s.slice(0, m.index).split('\n').length}`, `${m[0]}: '${fn}' لا تُصدّره ${LOADERS[name]}`);
  }
}

/* ---------- 4) الأيقونات ---------- */
const P = new Set([...SRC['js/constants.js'].slice(0, SRC['js/constants.js'].indexOf('};')).matchAll(/^\s+([\w$]+):'/gm)].map(m => m[1]));
const ICON_FIELDS = new Set([...SRC['js/constants.js'].matchAll(/icon:\s*'(\w+)'/g)].map(m => m[1]));
for (const n of ICON_FIELDS){ checks++; if (!P.has(n)) fail('js/constants.js', `icon:'${n}' في البيانات بلا أيقونة في P`); }
for (const c of calls(['icon'])){
  const a = c.args[0] || [];
  // اسم ثابت، أو نتيجتا شرط ثلاثي (cond ? 'a' : 'b'): القيم بعد ? و:
  const names = a.length === 1 && a[0].t === 'str' ? [a[0].v] : a.filter((x, j) => x.t === 'str' && a[j - 1]?.t === 'p' && (a[j - 1].v === '?' || a[j - 1].v === ':')).map(x => x.v);
  for (const n of names){ checks++; if (!P.has(n)) fail(`${c.f}:${c.line}`, `icon('${n}') ولا أيقونة بهذا الاسم في P (يُرسم صندوق)`); }
}

/* ---------- 5) النصوص ---------- */
const {AR} = await import(path.join(root, 'js/i18n/ar.js'));
const {EN} = await import(path.join(root, 'js/i18n/en.js'));
const vars = s => new Set(typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]) : Object.values(s || {}).flatMap(x => [...vars(x)]));
for (const k of Object.keys(AR)){
  checks++;
  const a = vars(AR[k]), e = vars(EN[k]);
  const onlyA = [...a].filter(x => !e.has(x)), onlyE = [...e].filter(x => !a.has(x));
  if (onlyA.length || onlyE.length) fail('js/i18n', `${k}: متغيرات مختلفة بين القاموسين (العربي فقط: ${onlyA.join('، ') || '—'}، الإنجليزي فقط: ${onlyE.join('، ') || '—'})`);
  for (const [n, D] of [['ar', AR], ['en', EN]]) if (D[k] && typeof D[k] === 'object' && !('other' in D[k])) fail('js/i18n', `${k} (${n}): صيغ العدد بلا other`);
}
const KEYS = Object.keys(AR);
for (const c of calls(['t', 'tAr', 'tp', 'tpAr', 'tIn'])){
  const ka = c.name === 'tIn' ? c.args[1] : c.args[0];
  const va = c.name === 'tIn' ? c.args[2] : c.name === 'tp' || c.name === 'tpAr' ? c.args[2] : c.args[1];
  const k = keyOf(ka); if (!k) continue;
  const keys = k.key ? [k.key] : KEYS.filter(x => k.re.test(x));
  checks++;
  if (!keys.length){ fail(`${c.f}:${c.line}`, `${c.name}(…) بمفتاح مركّب لا يطابق أي مفتاح في القاموس: ${k.re}`); continue; }
  // المفتاح المركّب بلا كائن متغيرات: لا يُعرف أي مفاتيح العائلة يُستخدم فعلاً (تفحصها famCheck بالأسفل لقوائم معروفة)
  if (k.dyn && !va) continue;
  const given = va ? objKeys(va) : new Set();
  if (!given) continue;   // متغير أو كائن فيه نشر: لا يُحكم عليه
  if (c.name === 'tp' || c.name === 'tpAr') given.add('n');
  for (const key of keys){
    const need = new Set([...vars(AR[key]), ...vars(EN[key])]);
    const miss = [...need].filter(x => !given.has(x));
    if (miss.length) fail(`${c.f}:${c.line}`, `${c.name}('${key}') بلا {${miss.join('}، {')}} (يظهر النص بالأقواس للمستخدم)`);
  }
}
// المفاتيح المركّبة من قوائم معروفة: لكل قيمة مفتاحها (وإلا ظهر اسم المفتاح نفسه)
// constants.js يستورد i18n.js (يقرأ localStorage ويضبط عنوان الصفحة): بدائل صغيرة تكفي لقراءة البيانات في Node
globalThis.localStorage ??= {getItem: () => null, setItem(){}};
globalThis.document ??= {documentElement: {}, getElementById: () => null, title: ''};
const {CATS, DETAIL_KEYS, HIGH_VALUE, GROUP_CATS, HIDDEN_CATS, REG_BLOCK, DELEGATE_BLOCK, ITEM_STATUS} = await import(path.join(root, 'js/constants.js'));
const has = k => k in AR && k in EN;
const famCheck = (where, list, mk, opt = () => false) => { for (const x of list){ checks++; const key = mk(x); if (!has(key) && !opt(x)) fail(where, `المفتاح ${key} غير موجود في القاموسين`); } };
famCheck('qa.sug.<cat> (actions.js ask)', CATS.map(c => c.id), id => 'qa.sug.' + id);
famCheck('cl.h.<cat>', CATS.filter(c => c.claim?.hint).map(c => c.claim.hint), k => k);
famCheck('sc.<cat>', CATS.filter(c => c.staffCheck).map(c => c.staffCheck), k => k);
famCheck('nm.ph.<cat>', CATS.map(c => c.id), id => 'nm.ph.' + id);
famCheck('df.<k>', [...new Set(CATS.flatMap(c => c.claim?.details || []).map(d => d.k))], k => 'df.' + k);
famCheck('df.<k>.<opt>', CATS.flatMap(c => (c.claim?.details || []).filter(d => d.type === 'pick').flatMap(d => d.opts.map(o => [d.k, o]))), ([k, o]) => `df.${k}.${o}`);
famCheck('grp.<cat>.title/cta', GROUP_CATS.flatMap(c => [`grp.${c}.title`, `grp.${c}.cta`]), k => k);
famCheck('disposal.<k>', ['donated', 'destroyed', 'authority', 'finder', 'other'], k => 'disposal.' + k);
famCheck('log.status:<s>', Object.keys(ITEM_STATUS).filter(s => s !== 'reserved'), s => 'log.status:' + s);


/* ---------- 6) القوائم المكررة بين الكود والقواعد ---------- */
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const ruleList = fn => { const m = rules.match(new RegExp(`function ${fn}\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\]`)); return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null; };
const same = (a, b) => a && b && a.length === b.length && [...a].sort().join() === [...b].sort().join();
for (const [name, js, fn] of [['DETAIL_KEYS', DETAIL_KEYS, 'detailKeys'], ['HIGH_VALUE', HIGH_VALUE, 'highValue'], ['GROUP_CATS', GROUP_CATS, 'groupCats'], ['HIDDEN_CATS', HIDDEN_CATS, 'hiddenCats']]){
  checks++; const r = ruleList(fn); if (!same(js, r)) fail('firestore.rules', `${fn}() = [${r}] لا تساوي ${name} = [${js}] في js/constants.js`);
}
{ checks++; const m = rules.match(/function regCatOk\(c\)\s*\{[^}]*!\(c in \[([^\]]*)\]\)/); const r = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null;
  if (!same(REG_BLOCK, r)) fail('firestore.rules', `regCatOk() تمنع [${r}] لا REG_BLOCK = [${REG_BLOCK}]`); }
{ checks++; const m = rules.match(/onlyChanges\(\['delegate'\]\)[\s\S]{0,400}?\) != '(\w+)'/); if (!m || !same(DELEGATE_BLOCK, [m[1]])) fail('firestore.rules', `فرع التفويض يمنع '${m?.[1]}' لا DELEGATE_BLOCK = [${DELEGATE_BLOCK}]`); }
{ checks++; const m = rules.match(/let c = \{([^}]*)\}\.get\(d\.cat/); const r = m ? Object.fromEntries([...m[1].matchAll(/'(\w+)':\s*(\d+)/g)].map(x => [x[1], +x[2]])) : {};
  for (const c of CATS) if (c.retentionDays && r[c.id] !== c.retentionDays) fail('firestore.rules', `keepDays: '${c.id}' ${r[c.id] ?? 'غير موجود'} لا retentionDays = ${c.retentionDays}`);
  for (const [id, n] of Object.entries(r)) if (CATS.some(c => c.id === id) && CATS.find(c => c.id === id).retentionDays !== n) fail('firestore.rules', `keepDays: '${id}': ${n} ولا retentionDays له في CATS`); }

/* ---------- 7) H41: استيراد لا يُستخدم، وتعريف في أعلى الملف لا يُستدعى (كود ميت يضلّل القارئ ويكبر التحميل) ---------- */
for (const [f, src] of Object.entries(SRC)){
  const uses = new Map(); for (const x of tokenize(src)) if (x.t === 'id') uses.set(x.v, (uses.get(x.v) || 0) + 1);
  for (const m of src.matchAll(/^import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/gm))
    for (const part of m[1].split(',').map(x => x.trim()).filter(Boolean)){
      const local = part.split(/\s+as\s+/).pop().trim(); checks++;
      if ((uses.get(local) || 0) <= 1) fail(f, `استيراد لا يُستخدم: ${local}`);
    }
  for (const m of src.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(|^(?:let|const)\s+(\w+)\s*=/gm)){
    const name = m[1] || m[2]; checks++;
    if ((uses.get(name) || 0) <= 1) fail(f, `تعريف لا يُستخدم: ${name}`);
  }
}

if (fails.length){ console.log(`✘ ${fails.length} مرجعاً بلا مقابل (من ${checks} فحصاً):\n- ` + fails.join('\n- ')); process.exit(1); }
console.log(`✔ المراجع المتقاطعة سليمة: ${checks} فحصاً (الأزرار والنماذج، والمسارات والوحدات الكسولة، والأيقونات، ومتغيرات النصوص في القاموسين، والقوائم المكررة في القواعد، ولا استيراد ولا تعريف بلا استخدام).`);
