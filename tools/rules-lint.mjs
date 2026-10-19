// H39: فحص بنيوي لملف firestore.rules دون محاكي (للمطوّر فقط؛ لا يحمّله التطبيق):
// توازن الأقواس، ونهاية كل allow بفاصلة منقوطة، وكل دالة مستدعاة معرّفة (أو من دوال القواعد المعروفة)، وlet قبل return.
// لا يغني عن اختبارات المحاكي (npm run test:rules)، لكنه يلتقط خطأ الكتابة قبل لصق القواعد في Firebase Console.
// التشغيل: cd tools && npm run lint:rules   (أو node tools/rules-lint.mjs firestore.rules)
import fs from 'fs';
import path from 'path';

export function lintRules(src){
  // إزالة التعليقات والنصوص مع الحفاظ على أرقام الأسطر
  let out = '', i = 0, line = 1; const errs = [];
  while (i < src.length){
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/'){ while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === "'"){ let j = i + 1; while (j < src.length && src[j] !== "'"){ if (src[j] === '\n') errs.push('نص غير مغلق في السطر ' + line); j++; } out += "''"; i = j + 1; continue; }
    if (c === '\n') line++;
    out += c; i++;
  }
  const stack = [], pairs = {')': '(', ']': '[', '}': '{'}; line = 1;
  for (const ch of out){
    if (ch === '\n'){ line++; continue; }
    if ('([{'.includes(ch)) stack.push([ch, line]);
    else if (')]}'.includes(ch)){ const top = stack.pop(); if (!top || top[0] !== pairs[ch]) errs.push(`قوس ${ch} غير متوازن في السطر ${line}`); }
  }
  for (const s of stack) errs.push(`قوس ${s[0]} مفتوح من السطر ${s[1]}`);
  const at = idx => out.slice(0, idx).split('\n').length;
  // كل allow ينتهي بـ ; قبل allow/match/function التالية
  for (const m of out.matchAll(/allow\s+[a-z, ]+:\s*if\b/g)){
    const rest = out.slice(m.index + m[0].length), semi = rest.indexOf(';'), next = rest.search(/\b(allow|match|function)\b/);
    if (semi < 0 || (next >= 0 && next < semi)) errs.push('allow بلا ; في السطر ' + at(m.index));
  }
  // كل دالة مستدعاة معرّفة في الملف أو من دوال القواعد وطرائقها
  const defined = new Set([...out.matchAll(/function\s+(\w+)\s*\(/g)].map(x => x[1]));
  const builtins = new Set(['get', 'getAfter', 'exists', 'existsAfter', 'int', 'string', 'float', 'bool', 'timestamp', 'duration', 'hashing', 'math', 'debug', 'path',
    'matches', 'size', 'keys', 'values', 'hasOnly', 'hasAny', 'hasAll', 'diff', 'affectedKeys', 'addedKeys', 'changedKeys', 'removedKeys', 'unchangedKeys', 'union', 'intersection',
    'lower', 'upper', 'join', 'removeAll', 'toMillis', 'date', 'value', 'sha256', 'md5', 'crc32', 'crc32c', 'toHexString', 'toBase64', 'split', 'replace', 'trim', 'toSet', 'concat',
    'abs', 'ceil', 'floor', 'isInfinite', 'isNaN', 'pow', 'round', 'sqrt', 'data', 'time', 'year', 'month', 'day', 'hours', 'minutes', 'seconds', 'nanos', 'dayOfWeek', 'dayOfYear']);
  for (const c of out.matchAll(/(?<![.\w])(\w+)\s*\(/g)){
    const f = c[1]; if (defined.has(f) || builtins.has(f) || /^(allow|match|service|return|let|if)$/.test(f)) continue;
    errs.push('دالة غير معرّفة: ' + f + ' (السطر ' + at(c.index) + ')');
  }
  // let قبل return في كل دالة
  for (const fn of out.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{/g)){
    let depth = 1, k = fn.index + fn[0].length; const start = k;
    while (k < out.length && depth){ if (out[k] === '{') depth++; else if (out[k] === '}') depth--; k++; }
    const body = out.slice(start, k - 1), r = body.indexOf('return');
    if (r < 0) errs.push('دالة بلا return: ' + fn[1]);
    else if (body.lastIndexOf('let ') > r) errs.push('let بعد return في الدالة ' + fn[1]);
  }
  // الإصدار في التعليق الأول
  const ver = /الإصدار (v\d+)/.exec(src)?.[1];
  if (!ver) errs.push('لا رقم إصدار (vNN) في تعليق أول الملف');
  return {errs, ver};
}

if (import.meta.url === 'file://' + process.argv[1]){
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const file = process.argv[2] || path.join(root, 'firestore.rules');
  const {errs, ver} = lintRules(fs.readFileSync(file, 'utf8'));
  console.log(errs.length ? '✘ ' + errs.join('\n✘ ') : `✔ بنية القواعد ${ver} سليمة: أقواس متوازنة، وكل allow ينتهي بـ ;، وكل دالة معرّفة، وlet قبل return.`);
  process.exit(errs.length ? 1 : 0);
}
