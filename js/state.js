// حالة التطبيق والاشتراك في البيانات من Firestore
import { auth, db, dbx, configured, onAuthStateChanged, getRedirectResult } from './firebase.js';
import { LS, matchScore, toast } from './utils.js';
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
  items: [], itemsLoaded: false, reports: [], claims: [], allItems: [],
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
const changed = () => changedFn();
const reset = () => resetFn();

/* ---------- قراءات مساعدة ---------- */
export const curOffice = () => S.offices.find(o => o.id === S.officeId) || null;
export const item = id => S.items.find(i => i.id === id) || S.allItems.find(i => i.id === id);
// الغرض كاملاً للموظف: البيانات العامة + التفاصيل السرية (تُستخدم في كل شاشات الموظف)
export const full = i => i ? {...i, ...(S.secrets[i.id] || {})} : i;
export const staffOffices = () => S.isAdmin ? S.offices.map(o => o.id) : (S.staffDoc?.offices || []);
export const isStaffHere = () => !!S.officeId && staffOffices().includes(S.officeId);
export function modes(){ const m = ['visitor']; if (isStaffHere()) m.push('staff'); if (S.isAdmin) m.push('admin'); return m; }
export const homeRoute = () => S.mode === 'staff' ? 'staff' : S.mode === 'admin' ? 'admin' : 'home';
export const myReports = () => S.reports.filter(r => r.uid && r.uid === S.uid).sort((a, b) => b.createdAt - a.createdAt);
export const myClaims = () => S.claims.filter(c => c.uid && c.uid === S.uid).sort((a, b) => b.createdAt - a.createdAt);
export const myCode = id => S.priv?.codes?.[id] || LS.get('codes', {})[id] || null;
export const MATCH_MIN = SETTINGS.matchThreshold;

// المرشحون لبلاغ: الزائر يقارن بالبيانات العامة فقط، والموظف يمرّر full ليقارن بالتفاصيل السرية أيضاً
export function candidatesFor(r, n = 3, view = x => x){
  return S.items.filter(i => i.status === 'available' || i.status === 'reserved')
    .map(i => ({i: view(i), s: matchScore(r, view(i))})).filter(x => x.s >= MATCH_MIN)
    .sort((a, b) => b.s - a.s).slice(0, n);
}

/* تنبيهات الزائر: تطابقات جديدة + طلبات تغيّرت حالتها */
function alertKeys(){
  const keys = [];
  for (const r of myReports()){
    if (r.status !== 'open') continue;
    if (r.staffPick) keys.push(`p:${r.id}:${r.staffPick}`);
    for (const {i} of candidatesFor(r)) keys.push(`m:${r.id}:${i.id}`);
  }
  for (const c of myClaims()) if (c.status === 'approved' || c.status === 'rejected') keys.push(`c:${c.id}:${c.status}`);
  return keys;
}
export function unseenCount(){ const seen = new Set(LS.get('seen', [])); return alertKeys().filter(k => !seen.has(k)).length; }
export function markSeen(){ const all = new Set([...LS.get('seen', []), ...alertKeys()]); LS.set('seen', [...all].slice(-400)); }

/* ---------- الاشتراكات ---------- */
const subs = {user: [], admin: [], items: [], rc: []};
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
  } else fixMode();
  ensureOfficeSubs();
  reset();
}
function startAdmin(){
  clear('admin');
  subs.admin.push(dbx.watch('staff', [], l => { S.staffList = l; changed(); }, errH('staff list')));
  subs.admin.push(dbx.watch('staffRequests', [], l => { S.staffReqs = l; changed(); }, errH('requests')));
  subs.admin.push(dbx.watch('items', [], l => { S.allItems = l; changed(); }, errH('all items')));
}

let itemsKey = null, rcKey = null;
export function ensureOfficeSubs(){
  if (!db) return;
  if (itemsKey !== S.officeId){
    itemsKey = S.officeId; clear('items'); S.items = []; S.itemsLoaded = false;
    if (S.officeId) subs.items.push(dbx.watch('items', [['officeId', '==', S.officeId]], l => { S.items = l; S.itemsLoaded = true; changed(); },
      e => { errH('items')(e); S.itemsLoaded = true; changed(); }));
  }
  const staffView = isStaffHere();
  const k = `${S.officeId}|${S.uid}|${staffView}`;
  if (rcKey !== k){
    rcKey = k; clear('rc'); S.reports = []; S.claims = []; S.secrets = {};
    if (S.officeId && S.uid){
      // الموظف يرى كل بلاغات وطلبات مكتبه، والزائر يرى ما يخصه فقط (القواعد في firestore.rules تفرض ذلك)
      const f = staffView ? [['officeId', '==', S.officeId]] : [['officeId', '==', S.officeId], ['uid', '==', S.uid]];
      subs.rc.push(dbx.watch('reports', f, l => { S.reports = l; changed(); }, errH('reports')));
      subs.rc.push(dbx.watch('claims', f, l => { S.claims = l; changed(); }, errH('claims')));
      // التفاصيل السرية للمفقودات: لموظفي المكتب فقط
      if (staffView) subs.rc.push(dbx.watch('itemSecrets', [['officeId', '==', S.officeId]],
        l => { S.secrets = Object.fromEntries(l.map(d => [d.id, d])); changed(); }, errH('itemSecrets')));
    }
  }
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
  if (!S.officesLoaded || (S.uid && (!S.staffLoaded || !S.adminLoaded))) return;
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
  if (c.includes('email-already-in-use')) return 'هذا البريد مسجّل مسبقاً. سجّل الدخول بدلاً من إنشاء حساب.';
  if (c.includes('weak-password')) return 'كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل.';
  if (c.includes('invalid-email')) return 'صيغة البريد الإلكتروني غير صحيحة.';
  if (c.includes('too-many-requests')) return 'محاولات كثيرة. انتظر قليلاً ثم حاول.';
  if (c.includes('network-request-failed')) return 'لا يوجد اتصال بالإنترنت.';
  if (c.includes('unauthorized-domain')) return 'هذا النطاق غير مصرّح له في Firebase. أضفه من Authentication ← Settings ← Authorized domains.';
  if (c.includes('user-mismatch')) return 'اخترت حساب Google مختلفاً عن حسابك الحالي.';
  if (c.includes('operation-not-allowed')) return 'طريقة الدخول هذه غير مفعّلة في Firebase Authentication.';
  return 'تعذّر تسجيل الدخول. حاول مرة أخرى.';
}
