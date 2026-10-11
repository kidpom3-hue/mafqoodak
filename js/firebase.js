// تهيئة Firebase — يُحمَّل الـ SDK مباشرة من CDN بدون أي أدوات بناء.
// لتحديث نسخة Firebase غيّر الرقم 12.19.0 في الأسطر الأربعة (وفي js/ai.js وروابط modulepreload في index.html).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate, clearIndexedDbPersistence,
  collection, doc, query, where, onSnapshot, getDoc, getDocs, getCountFromServer, setDoc, updateDoc, deleteDoc, writeBatch, deleteField, arrayUnion, arrayRemove, serverTimestamp, increment,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
// App Check (H4): يثبت أن الطلبات تأتي من تطبيقنا على موقعنا لا من سكربت آخر يستخدم المفاتيح العامة
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';
import { firebaseConfig, SETTINGS } from './config.js';
import { LANG } from './i18n.js';

export const configured = !Object.values(firebaseConfig).some(v => String(v).includes('PASTE_'));

export const app = configured ? initializeApp(firebaseConfig) : null;
/* App Check: يُفعَّل فقط إذا وُضع siteKey في SETTINGS.appCheck (config.js)، وإلا يعمل التطبيق كما كان.
   يُستدعى هنا قبل تهيئة Firestore والدخول والذكاء الاصطناعي، فتحمل كل الطلبات رمز التحقق من أولها.
   الإلزام (Enforce) لا يُفعَّل من هنا: يفعّله المالك يدوياً من Firebase Console بعد التأكد (انظر README) */
export const appCheck = (() => {
  const c = SETTINGS.appCheck || {};
  if (!app || !c.siteKey) return null;
  try {
    // وضع التجربة: يطبع رمز تصحيح في وحدة التحكم يُسجَّل في Firebase Console (للتجربة على localhost فقط)
    if (c.debug) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    return initializeAppCheck(app, {provider: new ReCaptchaV3Provider(c.siteKey), isTokenAutoRefreshEnabled: true});
  } catch (e){ console.warn(e); return null; }
})();
// H8: هل الذكاء الاصطناعي مفعّل؟ (هنا لا في ai.js، حتى لا يُحمَّل ai.js إلا عند استخدامه)
export const aiReady = () => !!(SETTINGS.enableAI && app);
export const auth = app ? getAuth(app) : null;
if (auth) auth.languageCode = LANG;   // لغة رسائل Firebase تتبع لغة الواجهة

let _db = null;
if (app){
  try { _db = initializeFirestore(app, {localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})}); }
  catch { _db = initializeFirestore(app, {}); }
}
export const db = _db;

// تسجيل الخروج على جهاز مشترك: إيقاف Firestore ثم مسح نسخته المحفوظة في المتصفح (IndexedDB).
// المسح يفشل إن كان التطبيق مفتوحاً في تبويب آخر؛ عندها يكفي مسح localStorage (يتولاه المستدعي).
export async function wipeLocalDb(){
  if (!db) return false;
  try { await terminate(db); await clearIndexedDbPersistence(db); return true; }
  catch (e){ console.warn('[firestore] clear cache', e?.code || e); return false; }
}

/* اختصارات للقراءة والكتابة بمسار نصي مثل 'items/abc' */
export const dbx = {
  ref: path => doc(db, path),
  newId: col => doc(collection(db, col)).id,
  get: async path => { const s = await getDoc(doc(db, path)); return s.exists() ? s.data() : null; },
  set: (path, data, opts) => setDoc(doc(db, path), data, opts || {}),
  update: (path, data) => updateDoc(doc(db, path), data),
  del: path => deleteDoc(doc(db, path)),
  batch: () => writeBatch(db),
  // H25: زيادة عدّاد واحد بمقدار 1 (تقييم الصفحات): set مع merge فيُنشئ الوثيقة أول مرة، ووقت الخادم
  bump: (path, data, field) => setDoc(doc(db, path), {...data, [field]: increment(1), updatedAt: serverTimestamp()}, {merge: true}),
  // H7: حدّ الإغراق بلا خادم. إنشاء بلاغ أو إشعار تسليم أو طلب استلام يكتب معه في العملية نفسها rate/{uid} = {at: وقت الخادم}،
  // والقواعد ترفض الإنشاء إن كان آخر إنشاء لهذا الحساب قبل أقل من 20 ثانية (انظر rateOk في firestore.rules)
  // extra(b, ref): كتابات إضافية في العملية نفسها (v7: حصة طلبات الاستلام claimQuota وصور الإثبات claimProofs)
  // H22 (v16): حد يومي 30 إنشاء لكل حساب: rate = {n, w} — n عدد الإنشاءات في النافذة، w بدايتها (وقت الخادم).
  // keepW = بداية النافذة الحالية كما قرأناها (تبقى كما هي) أو null لبدء نافذة جديدة الآن (n = 1)
  createLimited: (path, data, uid, extra, rate) => {
    const b = writeBatch(db); b.set(doc(db, path), data);
    // 'legacy' = {at} وحده (انتقالي لقواعد v15 قبل نشر v16)
    b.set(doc(db, 'rate/' + uid), rate === 'legacy' ? {at: serverTimestamp()} : {at: serverTimestamp(), n: rate?.n || 1, w: rate?.keepW || serverTimestamp()});
    extra?.(b, p => doc(db, p)); return b.commit();
  },
  // قراءة مرة واحدة لقائمة وثائق بشروط مساواة (مثل بلاغات المستخدم في كل المكاتب)
  // عدد المستندات فقط (قراءة واحدة لكل 1000 مستند) بدل تحميلها كلها
  count: async (col, filters) => (await getCountFromServer(query(collection(db, col), ...filters.map(([f, op, v]) => where(f, op, v))))).data().count,
  list: async (col, filters) => (await getDocs(query(collection(db, col), ...filters.map(([f, op, v]) => where(f, op, v))))).docs.map(d => ({id: d.id, ...d.data()})),
  watchDoc: (path, next, err) => onSnapshot(doc(db, path), s => next(s.exists() ? s.data() : null), err),
  watch: (col, filters, next, err) => {
    const q = filters.length ? query(collection(db, col), ...filters.map(([f, op, v]) => where(f, op, v))) : collection(db, col);
    return onSnapshot(q, s => next(s.docs.map(d => ({id: d.id, ...d.data()}))), err);
  },
};

// حذف حقل من مستند في update (مثل نقل مكان العثور من items إلى itemSecrets)
export { deleteField };
// إضافة عنصر إلى قائمة دون تكرار (قائمة «ليس غرضي» في البلاغ)
export { arrayUnion };
// v7: إزالة عنصر من قائمة (حصة الطلبات الجارية عند إغلاق الطلب)، ووقت الخادم (آخر طلب في التصنيف)
export { arrayRemove, serverTimestamp };
export {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification,
};
