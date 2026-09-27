// تهيئة Firebase — يُحمَّل الـ SDK مباشرة من CDN بدون أي أدوات بناء.
// لتحديث نسخة Firebase غيّر الرقم 12.19.0 في الأسطر الثلاثة.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate, clearIndexedDbPersistence,
  collection, doc, query, where, onSnapshot, getDoc, getDocs, getCountFromServer, setDoc, updateDoc, deleteDoc, writeBatch, deleteField, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';
import { LANG } from './i18n.js';

export const configured = !Object.values(firebaseConfig).some(v => String(v).includes('PASTE_'));

export const app = configured ? initializeApp(firebaseConfig) : null;
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
export {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification,
};
