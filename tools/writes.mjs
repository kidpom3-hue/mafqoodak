// H41: توافق كتابات التطبيق مع firestore.rules (للمطوّر فقط؛ لا يحمّله التطبيق، ولا يحتاج محاكي Firebase ولا Java).
// البديل التجريبي في الاختبارات (tools/a11y-stubs) يقبل أي كتابة، فحقل جديد نُسي في القواعد أو وقت بنوع خاطئ لا يظهر
// إلا في الموقع الحقيقي («ليست لديك صلاحية»). هذه الأداة تقرأ ما كتبه الزاحف فعلاً (tools/.crawl-writes.json من npm run crawl:
// كل شكل كتابة رآه: العملية والمسار والحقول وقيمها) وتطابقه مع القواعد نفسها:
//   1) الحقول: في كل مجموعة لها قوائم hasOnly/onlyChanges، كل حقل يُكتب يجب أن يكون في إحداها (وإلا رُفضت الكتابة كلها)،
//      ومفاتيح details ضمن detailKeys()
//   2) نوع الوقت: الزاحف يجعل وقت الخادم (serverTimestamp) رقماً كسره .5 ليُعرف. الحقل الذي تشترط القواعد أن يكون رقماً
//      (ts، fresh، freshIfChanged، is number) لا يُكتب بوقت الخادم؛ والذي تشترط وقت الخادم (== request.time، is timestamp)
//      لا يُكتب Date.now()
//   3) النوع العام: حقل تشترط القواعد أنه نص أو منطقي أو قائمة أو خريطة يُكتب بذلك النوع
// التشغيل: cd tools && npm run crawl && npm run writes   (أو: node writes.mjs ملف-كتابات.json)
// export: parseRules(src) و checkWrites(rules, writes) لاستخدامهما في أدوات أخرى
import fs from 'fs';
import path from 'path';

// تعليقات // خارج النصوص فقط (في القواعد روابط داخل نصوص مثل 'https://…')
export function stripComments(src){
  let out = '', q = null;
  for (let i = 0; i < src.length; i++){
    const ch = src[i];
    if (q){ out += ch; if (ch === '\\'){ out += src[++i] || ''; } else if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"'){ q = ch; out += ch; continue; }
    if (ch === '/' && src[i + 1] === '/'){ while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    out += ch;
  }
  return out;
}
// نهاية القوس المطابق لـ { في الموضع i (تتجاهل الأقواس داخل النصوص)
function closeAt(s, i){
  let d = 0, q = null;
  for (let j = i; j < s.length; j++){
    const ch = s[j];
    if (q){ if (ch === '\\') j++; else if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"'){ q = ch; continue; }
    if (ch === '{') d++;
    else if (ch === '}' && --d === 0) return j;
  }
  return -1;
}
const lits = s => [...s.matchAll(/'([^']*)'/g)].map(m => m[1]);

// القواعد → لكل مجموعة: {col: 'items' | 'users/private' …، keys: الحقول في قوائم hasOnly/onlyChanges (من نص الكتلة والدوال التي
// تستدعيها)، lists: عدد تلك القوائم (0 = لا قائمة، فلا فحص للحقول)، types: {'الأب.الحقل': أنواع}، detailKeys}
export function parseRules(src){
  const s = stripComments(src);
  const blocks = [];
  for (const m of s.matchAll(/\bmatch\s+(\/\S+)\s*\{/g)){
    const open = m.index + m[0].length - 1, end = closeAt(s, open);
    blocks.push({path: m[1], start: open, end});
  }
  // الكتلة الأب = أصغر كتلة تحتويها
  for (const b of blocks) b.parent = blocks.filter(x => x !== b && x.start < b.start && x.end > b.end).sort((x, y) => (x.end - x.start) - (y.end - y.start))[0] || null;
  for (const b of blocks){
    const segs = []; for (let x = b; x; x = x.parent) segs.unshift(...x.path.split('/').filter(p => p && !p.startsWith('{')));
    b.col = segs.filter(p => !['databases', 'documents'].includes(p)).join('/');
  }
  // الدوال: كل دالة في أصغر كتلة تحتويها
  const fns = [];
  for (const m of s.matchAll(/\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{/g)){
    const open = m.index + m[0].length - 1, end = closeAt(s, open);
    const owner = blocks.filter(x => x.start < m.index && x.end > end).sort((x, y) => (x.end - x.start) - (y.end - y.start))[0] || null;
    fns.push({name: m[1], body: s.slice(open + 1, end), start: m.index, end, owner});
  }
  const fnIn = (name, b) => { for (let x = b; x; x = x.parent){ const f = fns.find(f => f.name === name && f.owner === x); if (f) return f; } return fns.find(f => f.name === name && !f.owner) || null; };
  // نص الكتلة نفسها بلا الكتل المتداخلة ولا تعريفات الدوال (الدوال تُضاف إن استُدعيت فقط)
  const own = b => { let t = s.slice(b.start + 1, b.end);
    const cut = [...blocks.filter(x => x.parent === b), ...fns.filter(f => f.owner === b)].sort((x, y) => y.start - x.start);
    for (const c of cut){ const a = c.start - b.start - 1, z = c.end - b.start; if (a >= 0 && z <= t.length) t = t.slice(0, Math.max(0, a)) + t.slice(z); }
    return t; };
  const out = [];
  for (const b of blocks){
    if (!b.col || b.col === '') continue;
    const o = own(b); if (!/\ballow\b/.test(o)) continue;
    // الدوال المستدعاة (ومن تستدعيه هي)
    const seen = new Set(), parts = [o];
    const walk = t => { for (const m of t.matchAll(/\b(\w+)\s*\(/g)){ const f = fnIn(m[1], b); if (f && !seen.has(f)){ seen.add(f); parts.push(f.body); walk(f.body); } } };
    walk(o);
    const text = parts.join('\n');
    // مفاتيح مسموحة: قوائم hasOnly/hasAll/hasAny/onlyChanges الحرفية، أو القائمة التي ترجعها دالة مُمرَّرة إليها
    const keys = new Set(); let lists = 0;
    for (const m of text.matchAll(/\b(hasOnly|hasAll|hasAny|onlyChanges)\(\s*(\[[^\]]*\]|(\w+)\(\))/g)){
      if (m[2].startsWith('[')){ lits(m[2]).forEach(k => keys.add(k)); if (m[1] !== 'hasAny') lists++; continue; }
      const f = fnIn(m[3], b); const r = f && f.body.match(/return\s*(\[[^\]]*\])/); if (r){ lits(r[1]).forEach(k => keys.add(k)); if (m[1] !== 'hasAny') lists++; }
    }
    // أنواع الحقول المشروطة، بمفتاح «الأب.الحقل» (الأب '' = المستوى الأول من الوثيقة المكتوبة، أو اسم خريطة فيها مثل ai).
    // التعبير قبل الحقل يجب أن يشير إلى الوثيقة المكتوبة نفسها (d، request.resource.data، qa())، لا إلى وثيقة أخرى تقرؤها
    // القاعدة (get/getAfter أو دوال مثل cAfter وcfg)، ولا إلى متغير لا يُعرف مستواه (x، m)، وإلا نُسب نوع حقل آخر إلى هذا
    const types = {};
    const BASE = '(?:d|data|request\\.resource\\.data|qa\\(\\))';
    const level = c => { const m = c.match(new RegExp(`^${BASE}(?:\\.(\\w+))?$`)); return m ? (m[1] || '') : c === 'lb(qa())' ? 'lastByCat' : null; };
    const want = (chain, k, ty) => { const lv = level(chain); if (lv !== null) (types[lv + '.' + k] ||= new Set()).add(ty); };
    for (const m of text.matchAll(/\b(ts|fresh|strMax|isDay)\(\s*([\w.()]+)\s*,\s*'(\w+)'/g)) want(m[2], m[3], m[1] === 'strMax' || m[1] === 'isDay' ? 'string' : 'number');
    for (const m of text.matchAll(/\bfreshIfChanged\(\s*'(\w+)'\s*\)/g)) want('d', m[1], 'number');
    for (const m of text.matchAll(/([\w$().]+)\.(\w+)\s+is\s+(number|int|timestamp|string|bool|map|list)\b/g)) want(m[1], m[2], m[3] === 'int' ? 'number' : m[3]);
    for (const m of text.matchAll(/([\w$().]+)\.(\w+)\s*==\s*request\.time\b/g)) want(m[1], m[2], 'timestamp');
    for (const m of text.matchAll(/([\w$().]+)\.get\('(\w+)',[^)]*\)\s+is\s+(timestamp|number|int)\b/g)) want(m[1], m[2], m[3] === 'int' ? 'number' : m[3]);
    // claimQuota: وقت آخر طلب لكل تصنيف = وقت الخادم (lb(qa())[catOf(id)] == request.time)
    if (/\blb\(qa\(\)\)\[[^\]]+\]\s*==\s*request\.time/.test(text)) (types['lastByCat.*'] ||= new Set()).add('timestamp');
    const det = fnIn('detailKeys', b); const detailKeys = det ? lits(det.body.match(/return\s*(\[[^\]]*\])/)?.[1] || '') : [];
    const prev = out.find(x => x.col === b.col);
    if (prev){ keys.forEach(k => prev.keys.add(k)); prev.lists += lists; for (const [k, v] of Object.entries(types)) v.forEach(t => (prev.types[k] ||= new Set()).add(t)); continue; }
    out.push({col: b.col, keys, lists, types, detailKeys});
  }
  return out;
}

// نوع القيمة كما يراه Firestore (وقت الخادم = رقم كسره .5 في الزاحف)
const kind = v => v === null ? 'null' : Array.isArray(v) ? 'list' : typeof v === 'number' ? (Math.abs(v % 1) === 0.5 ? 'timestamp' : 'number')
  : typeof v === 'string' ? 'string' : typeof v === 'boolean' ? 'bool'
  : v && typeof v === 'object' ? (v.__del ? 'delete' : v.__inc !== undefined ? 'number' : v.__union || v.__remove ? 'list' : 'map') : typeof v;
const colOf = p => p.split('/').filter((_, i) => i % 2 === 0).join('/');

export function checkWrites(rules, writes){
  const errs = [];
  for (const w of writes){
    if (w.op === 'delete' || !w.data) continue;
    const r = rules.find(x => x.col === colOf(w.path)); if (!r){ errs.push(`${w.path}: مجموعة بلا قواعد (تُرفض كل كتابة) — ${w.where}`); continue; }
    const top = Object.keys(w.data).map(k => k.split('.')[0]);
    if (r.lists) for (const k of new Set(top)) if (!r.keys.has(k)) errs.push(`${w.op} ${w.path}: الحقل «${k}» ليس في قوائم القواعد لـ ${r.col} (تُرفض الكتابة) — ${w.where}`);
    const det = w.data.details;
    if (det && typeof det === 'object' && !det.__del && r.detailKeys.length) for (const k of Object.keys(det)) if (!r.detailKeys.includes(k)) errs.push(`${w.op} ${w.path}: details.${k} ليس في detailKeys() — ${w.where}`);
    // الأنواع: الحقول في المستوى الأول، وحقول الخرائط التي تسمّيها القواعد (ai.at، lastByCat.<تصنيف>)
    for (const [k0, v] of Object.entries(w.data)){
      const parts = k0.split('.');   // تحديث بمسار منقّط مثل 'lastByCat.phones'
      const pairs = parts.length > 1 ? [[parts[0], parts.slice(1).join('.'), v]] : kind(v) === 'map' ? [['', k0, v], ...Object.entries(v).map(([k, x]) => [k0, k, x])] : [['', k0, v]];
      for (const [par, k, x] of pairs){
        const got = kind(x); const want = r.types[par + '.' + k] || (par === 'lastByCat' ? r.types['lastByCat.*'] : null);
        if (!want || want.size !== 1 || got === 'delete' || got === 'null') continue;
        const ty = [...want][0];
        if (ty !== got) errs.push(`${w.op} ${w.path}: ${par ? par + '.' : ''}${k} نوعه ${got} والقواعد تشترط ${ty} — ${w.where}`);
      }
    }
  }
  return [...new Set(errs)];
}

if (import.meta.url === `file://${process.argv[1]}`){
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const file = process.argv[2] || path.join(root, 'tools/.crawl-writes.json');
  if (!fs.existsSync(file)){ console.log('⚠ لا يوجد ملف كتابات: شغّل npm run crawl أولاً'); process.exit(1); }
  const rules = parseRules(fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8'));
  const writes = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errs = checkWrites(rules, writes);
  if (errs.length){ console.log(`✘ ${errs.length} كتابة لا تطابق القواعد:`); errs.forEach(e => console.log('- ' + e)); process.exit(1); }
  console.log(`✔ ${writes.length} شكل كتابة يطابق القواعد (الحقول، ومفاتيح details، ونوع الوقت) في ${new Set(writes.map(w => colOf(w.path))).size} مجموعة.`);
}
