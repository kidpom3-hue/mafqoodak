// حالة التطبيق والاشتراك في البيانات من Firestore
import { auth, db, dbx, configured, onAuthStateChanged, getRedirectResult } from './firebase.js';
import { LS, matchScore, toast, dayNum, subKey } from './utils.js';
import { SETTINGS } from './config.js';

// رابط مشاركة غرض: ./#item/<رقم المكتب>/<رقم الغرض> يفتح صفحة الغرض مباشرة
export const SHARE_RE = /^item\/([\w-]+)\/([\w-]+)$/;
const SHARED = SHARE_RE.exec(location.hash.slice(1));
if (SHARED) LS.set('office', SHARED[1]);

export const S = {
  configured,
  authReady: false, uid: null, me: null,
  isAdmin: false, adminLoaded: false,
  config: null, configLoaded: false,
  offices: [], officesLoaded: false,
  // items: الأغراض النشطة (متاح ومحجوز) فقط. البقية تُجلب عند الحاجة حفاظاً على حصة القراءة اليومية
  items: [], itemsLoaded: false, reports: [], claims: [], allItems: [],
  myReports: [], myClaims: [],   // بلاغات المستخدم وطلباته في كل المكاتب
  itemCache: {},                 // غرض مفرد جُلب عند الحاجة (مُسلَّم أو من مكتب آخر): رقم ← غرض أو null
  extraItems: {},                // للموظف: المُسلَّم والمؤرشف والمُتصرَّف فيه عند اختيار الفلتر
  claimHist: null,               // للموظف: سجل الطلبات المنتهية عند الطلب
  counts: {},                    // أعداد من الخادم (getCountFromServer)
  verified: false,               // البريد موثّق؟
  secrets: {},   // تفاصيل المفقودات السرية (للموظف فقط): رقم الغرض ← {title, color, brand, desc, bldg, room, storage}
  staffDoc: null, staffLoaded: false, staffList: [], staffReqs: [], myReq: null, priv: {},
  officeId: LS.get('office', null),
  mode: LS.get('mode', 'visitor'),
  // فتح صفحة محددة من اختصارات أيقونة التطبيق (مثل ./#report)
  route: SHARED ? {name: 'item', params: {id: SHARED[2]}} : {name: ['report', 'browse', 'mine', 'found', 'office', 'privacy'].includes(location.hash.slice(1)) ? location.hash.slice(1) : ({staff: 'staff', admin: 'admin'})[LS.get('mode', 'visitor')] || 'home', params: {}},
  hist: [],
  filter: {q: '', cat: 'all', status: 'available', range: 'all'},
  staffTab: 'items', staffQ: '', staffStatus: 'active', adminTab: 'overview',
  sheet: null,
};

/* ربط الواجهة: changed = تحديث جزئي، reset = إعادة رسم كاملة */
let changedFn = () => {}, resetFn = () => {};
export function onChange(fn){ changedFn = fn; }
export function onReset(fn){ resetFn = fn; }
// نجمع التحديثات المتقاربة في رسم واحد (مثل وصول تفاصيل عشرات الأغراض معاً)
let changeTimer = null;
const changed = () => { if (changeTimer) return; changeTimer = setTimeout(() => { changeTimer = null; changedFn(); }, 16); };
const reset = () => resetFn();

/* ---------- قراءات مساعدة ---------- */
export const curOffice = () => S.offices.find(o => o.id === S.officeId) || null;
export const ACTIVE = ['available', 'reserved'];
export const item = id => S.items.find(i => i.id === id)
  || Object.values(S.extraItems).flat().find(i => i.id === id) || S.itemCache[id] || null;
// جلب غرض غير محمّل (مرة واحدة)، ثم إعادة الرسم
const fetching = new Set();
export function ensureItem(id){
  if (!id || !db || item(id) || id in S.itemCache || fetching.has(id)) return;
  fetching.add(id);
  dbx.get('items/' + id).then(d => { S.itemCache[id] = d ? {id, ...d} : null; }).catch(() => { S.itemCache[id] = null; })
    .finally(() => { fetching.delete(id); watchSecrets(); changed(); });
}
// ما زال الغرض قيد التحميل؟ (ننتظر الاشتراك أو الجلب المفرد قبل أن نقول «غير موجود»)
export const itemLoading = id => !item(id) && (!S.itemsLoaded || fetching.has(id) || !(id in S.itemCache));
// الغرض كاملاً للموظف: البيانات العامة + التفاصيل السرية (تُستخدم في كل شاشات الموظف)
export const full = i => i ? {...i, ...(S.secrets[i.id] || {})} : i;
export const staffOffices = () => S.isAdmin ? S.offices.map(o => o.id) : (S.staffDoc?.offices || []);
export const isStaffHere = () => !!S.officeId && staffOffices().includes(S.officeId);
export function modes(){ const m = ['visitor']; if (isStaffHere()) m.push('staff'); if (S.isAdmin) m.push('admin'); return m; }
export const homeRoute = () => S.mode === 'staff' ? 'staff' : S.mode === 'admin' ? 'admin' : 'home';
export const myReports = () => S.myReports.slice().sort((a, b) => b.createdAt - a.createdAt);
export const myClaims = () => S.myClaims.slice().sort((a, b) => b.createdAt - a.createdAt);
export const officeName = id => S.offices.find(o => o.id === id)?.name || '';
export const myCode = id => S.priv?.codes?.[id] || LS.get('codes', {})[id] || null;
export const MATCH_MIN = SETTINGS.matchThreshold;

// المرشحون لبلاغ: الزائر يقارن بالبيانات العامة فقط، والموظف يمرّر full ليقارن بالتفاصيل السرية أيضاً
export function candidatesFor(r, n = 3, view = x => x){
  return S.items.filter(i => i.status === 'available' || i.status === 'reserved')
    .map(i => ({i: view(i), s: matchScore(r, view(i))})).filter(x => x.s >= MATCH_MIN)
    .sort((a, b) => b.s - a.s).slice(0, n);
}

/* «قد يكون لك» للزائر: مطابقة صارمة بالبيانات العامة فقط، بلا نسب مئوية
   التصنيف نفسه، والنوع نفسه إن حدّده البلاغ، وعُثر عليه بين يوم قبل الفقد و30 يوماً بعده */
export function mayBeYours(r, i){
  if (!r || !i || r.cat !== i.cat || r.officeId !== i.officeId) return false;
  if (r.sub && subKey(i.sub) !== subKey(r.sub)) return false;
  const d = dayNum(i.foundDate) - dayNum(r.lostDate);
  return !isNaN(d) ? d >= -1 && d <= 30 : true;
}
export const maybeFor = (r, n = 4) => S.items.filter(i => ACTIVE.includes(i.status) && mayBeYours(r, i))
  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, n);

/* تنبيهات الزائر: ترشيح الموظف، وتغيّر حالة الطلب، وأول غرض مشابه لكل بلاغ (مرة واحدة) */
function alertKeys(){
  const keys = [];
  for (const r of myReports()){
    if (r.status !== 'open') continue;
    // ترشيح الموظف ينبّه فقط ما دام الغرض متاحاً أو محجوزاً
    const pi = r.staffPick && item(r.staffPick);
    if (pi && ACTIVE.includes(pi.status)) keys.push(`p:${r.id}:${r.staffPick}`);
    if (maybeFor(r, 1).length) keys.push(`m:${r.id}`);
  }
  for (const c of myClaims()) if (['approved', 'rejected', 'expired', 'cancelled'].includes(c.status)) keys.push(`c:${c.id}:${c.status}`);
  return keys;
}
export function unseenCount(){ const seen = new Set(LS.get('seen', [])); return alertKeys().filter(k => !seen.has(k)).length; }
export function markSeen(){ const all = new Set([...LS.get('seen', []), ...alertKeys()]); LS.set('seen', [...all].slice(-400)); }

/* ---------- الاشتراكات ---------- */
const subs = {user: [], admin: [], items: [], rc: [], mine: []};
function clear(k){ subs[k].forEach(u => { try { u(); } catch {} }); subs[k] = []; }
const errH = where => e => console.warn('[firestore]', where, e?.code || e);

export function start(){
  if (!configured){ S.authReady = true; reset(); return; }
  dbx.watchDoc('config/app', d => { const had = !!S.config; S.config = d; S.configLoaded = true; if (had !== !!d) reset(); else changed(); },
    e => { errH('config')(e); S.configLoaded = true; reset(); });
  dbx.watch('offices', [], list => {
    S.offices = list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const first = !S.officesLoaded; S.officesLoaded = true;
    const active = S.offices.filter(o => o.active !== false);
    if (!curOffice() && active.length === 1){ setOffice(active[0].id, true); return; }
    fixMode(); ensureOfficeSubs();
    if (first || !curOffice()) reset(); else changed();
  }, e => { errH('offices')(e); S.officesLoaded = true; reset(); });
  onAuthStateChanged(auth, onUser);
  getRedirectResult(auth).catch(e => { const m = authErr(e); if (m) toast(m); });
}

function onUser(user){
  clear('user'); clear('admin');
  S.uid = user?.uid || null;
  S.me = user ? {name: user.displayName || (user.email || '').split('@')[0] || 'مستخدم', email: user.email || '', photo: user.photoURL || ''} : null;
  S.isAdmin = false; S.adminLoaded = !user; S.staffDoc = null; S.staffLoaded = !user;
  S.myReq = null; S.priv = {}; S.staffList = []; S.staffReqs = []; S.allItems = [];
  S.verified = !!user?.emailVerified;   // حسابات Google موثّقة تلقائياً
  clear('mine'); S.myReports = []; S.myClaims = [];
  S.authReady = true;
  if (user){
    dbx.set('users/' + user.uid, {name: S.me.name, email: S.me.email, photo: S.me.photo, lastSeen: Date.now()}, {merge: true}).catch(errH('users'));
    subs.user.push(dbx.watchDoc('admins/' + user.uid, d => {
      const was = S.isAdmin; S.isAdmin = !!d; S.adminLoaded = true;
      if (S.isAdmin && !was) startAdmin();
      if (!S.isAdmin && was) clear('admin');
      fixMode(); ensureOfficeSubs(); changed();
    }, e => { errH('admins')(e); S.adminLoaded = true; fixMode(); }));
    subs.user.push(dbx.watchDoc('staff/' + user.uid, d => { S.staffDoc = d; S.staffLoaded = true; fixMode(); ensureOfficeSubs(); changed(); },
      e => { errH('staff')(e); S.staffLoaded = true; fixMode(); }));
    subs.user.push(dbx.watchDoc('staffRequests/' + user.uid, d => { S.myReq = d; changed(); }, errH('staffRequests')));
    subs.user.push(dbx.watchDoc('users/' + user.uid + '/private/codes', d => { S.priv = d || {}; changed(); }, errH('codes')));
    // «طلباتي»: بلاغات المستخدم وطلباته في كل المكاتب (بالمستخدم فقط، دون تقييد بالمكتب)
    subs.mine.push(dbx.watch('reports', [['uid', '==', user.uid]], l => { S.myReports = l; changed(); }, errH('my reports')));
    subs.mine.push(dbx.watch('claims', [['uid', '==', user.uid]], l => { S.myClaims = l; changed(); }, errH('my claims')));
  } else fixMode();
  ensureOfficeSubs();
  reset();
}
function startAdmin(){
  clear('admin');
  subs.admin.push(dbx.watch('staff', [], l => { S.staffList = l; changed(); }, errH('staff list')));
  subs.admin.push(dbx.watch('staffRequests', [], l => { S.staffReqs = l; changed(); }, errH('requests')));
  // لا اشتراك في كل أغراض كل المكاتب: الأرقام تُجلب بـ getCountFromServer عند فتح «نظرة عامة»
}

let itemsKey = null, rcKey = null;
export function ensureOfficeSubs(){
  if (!db) return;
  if (itemsKey !== S.officeId){
    itemsKey = S.officeId; clear('items'); S.items = []; S.itemsLoaded = false; S.counts = {}; S.extraItems = {}; S.claimHist = null;
    // الأغراض النشطة فقط (متاح ومحجوز): المُسلَّم القديم لا يُحمَّل لكل زائر
    if (S.officeId){
      subs.items.push(dbx.watch('items', [['officeId', '==', S.officeId], ['status', 'in', ACTIVE]], l => { S.items = l; S.itemsLoaded = true; watchSecrets(); changed(); },
        e => { errH('items')(e); S.itemsLoaded = true; changed(); }));
      refreshCounts();
    }
  }
  const staffView = isStaffHere();
  const k = `${S.officeId}|${S.uid}|${staffView}`;
  if (rcKey !== k){
    rcKey = k; clear('rc'); S.reports = []; S.claims = []; S.secrets = {}; S.claimHist = null;
    secSubs.forEach(u => { try { u(); } catch {} }); secSubs.clear();
    // للموظف فقط: البلاغات المفتوحة، والطلبات المفتوحة (قيد المراجعة والمقبولة)، والتفاصيل السرية لمكتبه.
    // الزائر يرى بلاغاته وطلباته من اشتراك «طلباتي» بالأعلى.
    if (S.officeId && S.uid && staffView){
      const o = ['officeId', '==', S.officeId];
      subs.rc.push(dbx.watch('reports', [o, ['status', '==', 'open']], l => { S.reports = l; changed(); }, errH('reports')));
      subs.rc.push(dbx.watch('claims', [o, ['status', 'in', ['pending', 'approved']]], l => { S.claims = l; changed(); }, errH('claims')));
      watchSecrets();
    }
  }
}

// التفاصيل السرية للموظف: مستمع لكل غرض محمّل فقط (النشطة، وما جُلب عند الطلب)،
// بدل الاشتراك في تفاصيل كل أغراض المكتب القديمة
const secSubs = new Map();
export function watchSecrets(){
  if (!isStaffHere() || !S.uid) return;
  const ids = [...S.items, ...Object.values(S.extraItems).flat(), ...Object.values(S.itemCache).filter(Boolean)]
    .filter(i => i.officeId === S.officeId).map(i => i.id);
  for (const id of ids){
    if (secSubs.has(id)) continue;
    secSubs.set(id, dbx.watchDoc('itemSecrets/' + id, d => { if (d) S.secrets[id] = {id, ...d}; else delete S.secrets[id]; changed(); }, () => {}));
  }
}
// عدد المُسلَّم لأصحابه في المكتب (قراءة واحدة بدل تحميل كل الأغراض القديمة)
export function refreshCounts(){
  const id = S.officeId; if (!id || !db) return;
  dbx.count('items', [['officeId', '==', id], ['status', '==', 'returned']])
    .then(n => { if (S.officeId === id){ S.counts.returned = n; changed(); } }).catch(errH('count'));
}
// للمالك: أعداد كل مكتب عند فتح «نظرة عامة» (4 استعلامات عدّ لكل مكتب بدل الاشتراك في كل الأغراض)
let adminLoading = false;
export async function loadAdminCounts(force = false){
  if (adminLoading || (S.counts.admin && !force) || !db) return;
  adminLoading = true;
  try {
    const out = {};
    for (const o of S.offices){
      const n = st => dbx.count('items', [['officeId', '==', o.id], ['status', '==', st]]);
      const [available, reserved, returned, disposed] = await Promise.all(['available', 'reserved', 'returned', 'disposed'].map(n));
      out[o.id] = {available, reserved, returned, disposed};
    }
    S.counts.admin = out;
    S.counts.samples = await dbx.count('items', [['sample', '==', true]]);
  } catch (e){ errH('admin counts')(e); S.counts.admin = S.counts.admin || {}; }
  finally { adminLoading = false; changed(); }
}
// للموظف: جلب الأغراض غير النشطة عند اختيار الفلتر فقط (مرة واحدة لكل اختيار)
export async function loadExtraItems(status){
  const id = S.officeId; const list = status === 'all' ? ['returned', 'archived', 'disposed'] : [status];
  for (const st of list){
    try { S.extraItems[st] = await dbx.list('items', [['officeId', '==', id], ['status', '==', st]]); } catch (e){ errH('extra items')(e); S.extraItems[st] = []; }
  }
  watchSecrets(); changed();
}
// للموظف: سجل الطلبات المنتهية عند الطلب
export async function loadClaimHistory(){
  try { S.claimHist = await dbx.list('claims', [['officeId', '==', S.officeId], ['status', 'in', ['done', 'rejected', 'expired', 'cancelled']]]); }
  catch (e){ errH('claim history')(e); S.claimHist = []; }
  changed();
}

export function setOffice(id, silent){
  const changedOffice = id !== S.officeId;
  S.officeId = id; LS.set('office', id);
  fixMode(); ensureOfficeSubs();
  S.hist = []; S.route = {name: homeRoute(), params: {}}; S.sheet = null;
  reset(); window.scrollTo(0, 0);
  if (!silent && changedOffice) toast('تم الدخول إلى ' + (curOffice()?.name || 'المكتب'));
}
export function fixMode(){
  // ننتظر تسجيل الدخول أيضاً: وإلا يعود الموظف إلى وضع الزائر إذا وصلت المواقع قبل حالة الدخول
  if (!S.authReady || !S.officesLoaded || (S.uid && (!S.staffLoaded || !S.adminLoaded))) return;
  if (!modes().includes(S.mode)){
    S.mode = 'visitor'; LS.set('mode', 'visitor');
    if (['staff', 'add', 'admin', 'officeForm'].includes(S.route.name)) S.route = {name: 'home', params: {}};
  }
}

/* ---------- الصور وأسماء المستخدمين (مع ذاكرة مؤقتة) ---------- */
const PHOTO = new Map();
// مفاتيح الصور: p_<id> الأصل الواضح (للموظفين)، r_<id> صورة بلاغ، وغير ذلك الصورة العامة للغرض
export const photoPath = key => key.startsWith('p_') ? 'itemPhotosPrivate/' + key.slice(2)
  : key.startsWith('r_') ? 'reportPhotos/' + key.slice(2) : 'itemPhotos/' + key;
export function getPhoto(key){
  if (PHOTO.has(key)) return PHOTO.get(key);
  const p = db ? dbx.get(photoPath(key)).then(d => d?.data || null).catch(() => null) : Promise.resolve(null);
  PHOTO.set(key, p);
  p.then(v => { if (!v) PHOTO.delete(key); });   // لا نحفظ النتيجة الفارغة؛ قد تُرفع الصورة بعد لحظات
  return p;
}
export const cachePhoto = (key, dataUrl) => { if (dataUrl) PHOTO.set(key, Promise.resolve(dataUrl)); else PHOTO.delete(key); };
const NAMES = new Map();
export function getName(uid){
  if (uid === S.uid) return Promise.resolve({name: 'أنت', photo: S.me?.photo || ''});
  if (NAMES.has(uid)) return NAMES.get(uid);
  // صورة الحساب تُقبل من صور حسابات Google فقط (لا روابط تتبّع)
  const okPhoto = v => typeof v === 'string' && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(v);
  const p = dbx.get('users/' + uid).then(d => ({name: d?.name || 'مستخدم', photo: okPhoto(d?.photo) ? d.photo : ''})).catch(() => ({name: 'مستخدم', photo: ''}));
  NAMES.set(uid, p); return p;
}

/* ---------- الكتابة مع رسائل أخطاء واضحة ---------- */
export async function write(fn, okMsg){
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e){
    console.warn(e);
    if (e?.msg){ toast(e.msg); return false; }   // رسالة عربية جاهزة من workflow.js
    const c = e?.code || '';
    toast(c.includes('permission-denied') ? 'ليست لديك صلاحية لهذا الإجراء.'
      : c.includes('resource-exhausted') ? 'تجاوز التطبيق حد الاستخدام اليومي المجاني. حاول لاحقاً.'
      : c.includes('unavailable') ? 'لا يوجد اتصال بالإنترنت. سيُحفظ التغيير عند عودة الاتصال.'
      : c.includes('invalid-argument') ? 'البيانات غير مكتملة أو كبيرة جداً.'
      : 'تعذّر الحفظ الآن. حاول مرة أخرى.');
    return false;
  }
}
export function authErr(e){
  const c = e?.code || '';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'البريد أو كلمة المرور غير صحيحة.';
  if (c.includes('email-already-in-use')) return 'هذا البريد مسجّل من قبل. سجّل الدخول بدلاً من إنشاء حساب.';
  if (c.includes('weak-password')) return 'كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل.';
  if (c.includes('invalid-email')) return 'صيغة البريد الإلكتروني غير صحيحة.';
  if (c.includes('too-many-requests')) return 'محاولات كثيرة. انتظر قليلاً ثم حاول.';
  if (c.includes('network-request-failed')) return 'لا يوجد اتصال بالإنترنت.';
  if (c.includes('unauthorized-domain')) return 'هذا النطاق غير مصرّح له في Firebase. أضفه من Authentication ← Settings ← Authorized domains.';
  if (c.includes('user-mismatch')) return 'اخترت حساب Google مختلفاً عن حسابك الحالي.';
  if (c.includes('operation-not-allowed')) return 'طريقة الدخول هذه غير مفعّلة في Firebase Authentication.';
  return 'تعذّر تسجيل الدخول. حاول مرة أخرى.';
}
