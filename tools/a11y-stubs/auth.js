// بديل تجريبي لمكتبة Firebase Auth (لأداة tools/a11y.mjs فقط): المستخدم من window.__FAKE.user
const U = () => { const u = window.__FAKE.user; if (!u) return null;
  const o = {providerData: [], photoURL: '', emailVerified: true, ...u, getIdToken: async () => 'tok'};
  o.reload = async () => { if (window.__FAKE.verifyOnReload) o.emailVerified = u.emailVerified = true; };
  return o; };
let cur = null; const cu = () => cur || (cur = U());
export const getAuth = () => ({ get currentUser(){ return cu(); } });
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(cu()), 10); return () => {}; };
export const getRedirectResult = () => Promise.resolve(null);
export function GoogleAuthProvider(){}
export function EmailAuthProvider(){}
EmailAuthProvider.credential = () => ({});
const noop = () => Promise.resolve({});
export const signInWithPopup = noop, signInWithRedirect = noop, createUserWithEmailAndPassword = noop, signInWithEmailAndPassword = noop,
  sendPasswordResetEmail = noop, updateProfile = noop, signOut = noop, deleteUser = noop, reauthenticateWithPopup = noop, reauthenticateWithCredential = noop,
  sendEmailVerification = async () => { window.__FAKE.verifySent = (window.__FAKE.verifySent || 0) + 1; };
