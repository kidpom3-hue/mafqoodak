// تهيئة Firebase — يُحمَّل الـ SDK مباشرة من CDN بدون أي أدوات بناء.
// لتحديث نسخة Firebase غيّر الرقم 12.19.0 في الأسطر الثلاثة.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, query, where, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';

export const configured = !Object.values(firebaseConfig).some(v => String(v).includes('PASTE_'));

export const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
if (auth) auth.languageCode = 'ar';

let _db = null;
if (app){
  try { _db = initializeFirestore(app, {localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})}); }
  catch { _db = initializeFirestore(app, {}); }
}
export const db = _db;

/* اختصارات للقراءة والكتابة بمسار نصي مثل 'items/abc' */
export const dbx = {
  ref: path => doc(db, path),
  newId: col => doc(collection(db, col)).id,
  get: async path => { const s = await getDoc(doc(db, path)); return s.exists() ? s.data() : null; },
  set: (path, data, opts) => setDoc(doc(db, path), data, opts || {}),
  update: (path, data) => updateDoc(doc(db, path), data),
  del: path => deleteDoc(doc(db, path)),
  batch: () => writeBatch(db),
  watchDoc: (path, next, err) => onSnapshot(doc(db, path), s => next(s.exists() ? s.data() : null), err),
  watch: (col, filters, next, err) => {
    const q = filters.length ? query(collection(db, col), ...filters.map(([f, op, v]) => where(f, op, v))) : collection(db, col);
    return onSnapshot(q, s => next(s.docs.map(d => ({id: d.id, ...d.data()}))), err);
  },
};

export {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut,
};
