// بديل تجريبي لمكتبة Firestore (لأداة tools/a11y.mjs فقط): قاعدة بيانات في الذاكرة من window.__FAKE.db
const F = () => window.__FAKE;
const deny = p => { if (F().deny && new RegExp(F().deny).test(p)) { const e = new Error('denied'); e.code = 'permission-denied'; throw e; } };
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({}), persistentMultipleTabManager = () => ({});
export const doc = (a, path) => path === undefined ? {id: 'n' + Math.random().toString(36).slice(2, 10)} : {path, id: path.split('/').pop()};
export const collection = (db, col) => ({col, w: []});
export const where = (f, op, v) => ({f, op, v});
export const query = (c, ...w) => ({col: c.col, w});
const docsOf = q => Object.entries(F().db).filter(([p, d]) => p.startsWith(q.col + '/') && p.split('/').length === 2 && q.w.every(w => w.op === 'in' ? w.v.includes(d[w.f]) : d[w.f] === w.v)).map(([p, d]) => ({id: p.split('/')[1], data: () => d}));
const snapDoc = p => { const d = F().db[p]; return {exists: () => !!d, data: () => d}; };
// نعدّ القراءات: كل مستند يصل يُحسب قراءة، وكل استعلام عدّ قراءة واحدة
const cnt = n => { F().readCount = (F().readCount || 0) + n; };
const L = new Set();
export const onSnapshot = (t, next) => { const l = {t, next}; L.add(l); setTimeout(() => { if (!L.has(l)) return; if (t.path){ cnt(1); next(snapDoc(t.path)); } else { const d = docsOf(t); cnt(Math.max(1, d.length)); next({docs: d}); } }, 5); return () => L.delete(l); };
// بعد كل كتابة: نعيد إرسال اللقطات (لا تُحسب في عدّ القراءات الأولية)
let pend = false; const notify = () => { if (pend) return; pend = true; setTimeout(() => { pend = false; for (const l of L) l.next(l.t.path ? snapDoc(l.t.path) : {docs: docsOf(l.t)}); }, 5); };
export const getCountFromServer = async q => { cnt(1); return {data: () => ({count: docsOf(q).length})}; };
export const getDoc = async r => { F().reads.push(r.path); cnt(1); return snapDoc(r.path); };
export const getDocs = async q => { const d = docsOf(q); cnt(Math.max(1, d.length)); return {docs: d}; };
const log = (op, p, d) => F().writes.push([op, p, d && JSON.parse(JSON.stringify(d))]);
// deleteField: يحذف الحقل عند التطبيق. spotRule: يحاكي القواعد (items لا تقبل spot بعد العملية)
export const deleteField = () => ({__del: 1});
// H7: وقت الخادم (في البديل التجريبي: وقت الجهاز)
export const serverTimestamp = () => Date.now();
export const arrayUnion = (...a) => ({__union: a});
// v7: إزالة من قائمة (حصة طلبات الاستلام)
export const arrayRemove = (...a) => ({__remove: a});
const merged = (cur, d) => { const o = {...(cur || {})}; for (const [k, v] of Object.entries(d)) { if (v && v.__del) delete o[k]; else if (v && v.__remove) o[k] = (Array.isArray(o[k]) ? o[k] : []).filter(x => !v.__remove.includes(x)); else if (v && v.__union) o[k] = [...new Set([...(Array.isArray(o[k]) ? o[k] : []), ...v.__union])]; else o[k] = v; } return o; };
const after = (op, p, d, o) => op === 'set' && !o?.merge ? merged({}, d) : merged(F().db[p], d);
const spotDeny = (p, doc) => { if (F().spotRule && p.startsWith('items/') && doc && 'spot' in doc){ const e = new Error('denied: public spot'); e.code = 'permission-denied'; throw e; } };
export const setDoc = async (r, d, o) => { deny(r.path); const nd = after('set', r.path, d, o); spotDeny(r.path, nd); log('set', r.path, d); F().db[r.path] = nd; notify(); };
export const updateDoc = async (r, d) => { deny(r.path); const nd = after('update', r.path, d); spotDeny(r.path, nd); log('update', r.path, d); F().db[r.path] = nd; notify(); };
export const deleteDoc = async r => { deny(r.path); log('delete', r.path); delete F().db[r.path]; notify(); };
// حراسة القبول كما في القواعد (approveOk): الغرض متاح قبل العملية ومحجوز لهذا الطلب بعدها
const guard = raw => { if (!F().guard) return; const db = F().db;
  for (const [op, p, d] of raw){ if (op !== 'update' || !p.startsWith('claims/') || d.status !== 'approved' || db[p]?.status === 'approved') continue;
    const it = 'items/' + db[p].itemId, after = raw.filter(x => x[1] === it).reduce((a, x) => ({...a, ...x[2]}), {...db[it]});
    if (db[it]?.status !== 'available' || after.reservedFor !== p.split('/')[1]){ const e = new Error('denied'); e.code = 'permission-denied'; throw e; } } };
const preSpot = raw => { if (!F().spotRule) return; const st = {};
  for (const [op, p, d, o] of raw){ if (!p.startsWith('items/')) continue; const cur = p in st ? st[p] : F().db[p]; st[p] = op === 'delete' ? null : op === 'set' && !o?.merge ? merged({}, d) : merged(cur, d); }
  for (const [p, doc] of Object.entries(st)) spotDeny(p, doc); };
export const writeBatch = () => { const ops = [], raw = []; return {set(r, d, o){ raw.push(['set', r.path, d, o]); ops.push(() => setDoc(r, d, o)); }, update(r, d){ raw.push(['update', r.path, d]); ops.push(() => updateDoc(r, d)); }, delete(r){ raw.push(['delete', r.path]); ops.push(() => deleteDoc(r)); }, commit: async () => { if (F().delay) await new Promise(r => setTimeout(r, F().delay)); guard(raw); preSpot(raw); const rule = F().spotRule; F().spotRule = false; try { for (const o of ops) await o(); } finally { F().spotRule = rule; } }}; };
export const terminate = async () => { localStorage.setItem('test:terminated', '1'); };
export const clearIndexedDbPersistence = async () => { if (F().clearFails){ const e = new Error('x'); e.code = 'failed-precondition'; throw e; } localStorage.setItem('test:cleared', '1'); };
