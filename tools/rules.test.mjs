// اختبارات قواعد Firestore على المحاكي (للمطوّر فقط؛ لا يحمّلها التطبيق)
// التشغيل: cd tools && npm install && npm run test:rules   (يحتاج Java)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, getCountFromServer, writeBatch, collection, query, where, deleteField, serverTimestamp, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import fs from 'fs';
import { createHash } from 'crypto';

const env = await initializeTestEnvironment({projectId: 'demo-mafqoodak',
  firestore: {rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085}});
const now = Date.now(), O = 'tc';
// مكان العثور (spot) سري منذ المرحلة E5: في itemSecrets لا في items
// v7: التصنيف الافتراضي «حقائب» (ليس ثميناً)؛ اختبارات الأغراض الثمينة تستخدم تصنيفها صراحة
// v11 (H16): public = false للنقود (لا تظهر للزائر)، و true لغيرها
// v14 (H19): مدة الحفظ تُكتب عند الإنشاء؛ تاريخ بعيد يكفي لكل تاريخ عثور في الاختبارات، و KEEP_PAST لغرض انتهت مدته
const KEEP_FAR = Date.parse('2030-01-01'), KEEP_PAST = now - 864e5;
const pub = (x, cat = 'bags') => ({officeId: O, ref: 'TCA-' + x, cat, sub: '', title: 'جوال', foundDate: '2026-09-20', photo: false, status: 'available', createdBy: 'staffA', createdAt: now, updatedAt: now, sample: false, public: cat !== 'cash', keepUntil: KEEP_FAR});
const sec = {officeId: O, title: 'جوال أسود', color: 'black', brand: '', desc: 'غلاف أحمر', spot: 'المكتبة', bldg: '', room: '', storage: 'الخزانة 1'};
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  await setDoc(doc(d, 'config/app'), {ownerUid: 'owner'});
  await setDoc(doc(d, 'admins/owner'), {role: 'owner'});
  // H7: البلاغ وإشعار التسليم يشترطان وجود المكتب
  await setDoc(doc(d, 'offices/' + O), {name: 'الكلية', active: true, createdAt: 1});
  for (const s of ['staffA', 'staffB']) await setDoc(doc(d, 'staff/' + s), {offices: [O]});
  for (const k of ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i10', 'i11']){ await setDoc(doc(d, 'items/' + k), pub(k)); await setDoc(doc(d, 'itemSecrets/' + k), sec); }
  // أغراض قديمة (قبل المرحلة E5): المكان ما زال في المستند العام. L2 بلا itemSecrets، وL1 فيه fromFound
  const {spot, ...oldSec} = sec;
  await setDoc(doc(d, 'items/L1'), {...pub('L1'), spot: 'المكتبة', fromFound: 'f9'}); await setDoc(doc(d, 'itemSecrets/L1'), oldSec);
  await setDoc(doc(d, 'items/L2'), {...pub('L2'), spot: 'الكافتيريا'});
  await setDoc(doc(d, 'items/L3'), {...pub('L3'), spot: 'المواقف'}); await setDoc(doc(d, 'itemSecrets/L3'), oldSec);
});
// الحساب الموثّق وغير الموثّق
// H7: لكل حساب بريد في رمز الدخول (users.email يجب أن يساويه)
const UID = new Map();
const as = (uid, verified = true) => { const d = env.authenticatedContext(uid, {email_verified: verified, email: uid + '@x.com'}).firestore(); UID.set(d, uid); return d; };
const owner = as('owner');
const alice = as('alice'), bob = as('bob'), carol = as('carol'), dave = as('dave', false), A = as('staffA'), B = as('staffB'), anon = env.unauthenticatedContext().firestore();
const R = []; let fails = 0;
async function t(name, p, ok = true){ try { await (ok ? assertSucceeds(p) : assertFails(p)); R.push('✔ ' + name); } catch (e){ fails++; R.push('✘ ' + name + ' — ' + String(e.message || e).slice(0, 160)); } }
const claim = (item, uid, extra = {}) => ({itemId: item, officeId: O, uid, proof: 'غلاف أحمر وخلفية قطة', color: 'black', brand: '', lostSpot: 'المكتبة', bldg: '', room: '', lostDate: '2026-09-19', status: 'pending', createdAt: now, ...extra});
// v9: رمز الاستلام: بصمته في claimCodes/{claimId} = sha256(رقم الطلب:الرمز) بأحرف صغيرة، والموظف يكتب الرمز في handoverCode عند التسليم
const CODE = 'ACDE3467';
const H = (id, code = CODE) => createHash('sha256').update(id + ':' + code).digest('hex');
const logDoc = (by, action, x = {}) => ({officeId: O, itemId: x.itemId || '', claimId: x.claimId || '', reportId: '', action, by, at: now, note: x.note || ''});
/* v14 (H19): كل تغيير في حالة الغرض أو تصنيفه، وكل حذف له، معه قيد سجل في العملية نفسها (lastLog / del_{itemId}).
   batch يضيفه تلقائياً كما يفعل التطبيق (workflow.js)، فتختبر الحالات الأخرى قواعدها هي. noLog: true لاختبار غيابه */
let LOGN = 0;
const batch = (db, fn, {noLog = false} = {}) => {
  const b = writeBatch(db), by = UID.get(db) || 'x';
  const autoLog = (itemId, id) => b.set(doc(db, 'logs/' + id), {officeId: O, itemId, claimId: '', reportId: '', action: 'auto', by, at: Date.now(), note: ''});
  const w = {
    set: (r, d, o) => (b.set(r, d, o), w),
    update: (r, d) => {
      const m = r.path.match(/^items\/([^/]+)$/);
      if (m && !noLog && ('status' in d || 'cat' in d) && !('lastLog' in d)){ const id = 'al' + (++LOGN) + '_' + now; autoLog(m[1], id); d = {...d, lastLog: id}; }
      b.update(r, d); return w;
    },
    delete: r => { const m = r.path.match(/^items\/([^/]+)$/); if (m && !noLog) autoLog(m[1], 'del_' + m[1]); b.delete(r); return w; },
  };
  fn(w, p => doc(db, p)); return b.commit();
};
// تحديث أو حذف غرض مفرد بقيده (بدل updateDoc/deleteDoc المباشرة)
const upItem = (db, id, d, o) => batch(db, (b, r) => b.update(r('items/' + id), d), o);
const delItem = (db, id, o) => batch(db, (b, r) => b.delete(r('items/' + id)), o);
/* H7: إنشاء بلاغ أو إشعار تسليم أو طلب استلام كما في التطبيق: الوثيقة + rate/{uid} بوقت الخادم في batch واحد.
   قبل كل إنشاء نعيد rate/{uid} إلى وقت قديم (بلا قواعد)، لتختبر الحالات الأخرى قواعدها هي لا حدّ الـ 20 ثانية */
const setRate = async (uid, ms) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'rate/' + uid), {at: Timestamp.fromMillis(ms)}); });
// v16 (H22): rate فيه عداد النافذة اليومية: بعد setRate (بلا w) تبدأ نافذة جديدة: n = 1 وw = وقت الخادم
const RATE = () => ({at: serverTimestamp(), n: 1, w: serverTimestamp()});
/* v7: طلب الاستلام يحدّث claimQuota/{uid} في الـ batch نفسه (قائمة الطلبات الجارية + وقت آخر طلب في تصنيف الغرض).
   قبل كل إنشاء نفرّغ الحصة (بلا قواعد) حتى تختبر الحالات الأخرى قواعدها؛ حالات الحصة لها اختباراتها أدناه */
const setQuota = (uid, q) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'claimQuota/' + uid), q); });
// (withSecurityRulesDisabled لا يرجع قيمة الدالة، فنحفظها في متغير)
async function itemCat(id){ let cat = 'bags'; await env.withSecurityRulesDisabled(async c => { cat = (await getDoc(doc(c.firestore(), 'items/' + id))).data()?.cat || 'bags'; }); return cat; }
async function mk(db, path, data, {keepQuota = false, noCode = false} = {}){
  const uid = UID.get(db) || 'x';
  await setRate(uid, Date.now() - 60000);
  const isClaim = path.startsWith('claims/');
  if (isClaim && !keepQuota) await setQuota(uid, {open: []});
  // v8: الطلب المجمّع تصنيفه مكتوب فيه (بلا غرض)
  const cat = isClaim ? (data.grouped ? data.cat : await itemCat(data.itemId)) : '';
  return batch(db, (b, r) => { b.set(r(path), data); b.set(r('rate/' + uid), RATE());
    if (isClaim) b.set(r('claimQuota/' + uid), {open: arrayUnion(path.split('/')[1]), lastByCat: {[cat]: serverTimestamp()}}, {merge: true});
    if (isClaim && !noCode) b.set(r('claimCodes/' + path.split('/')[1]), {uid, hash: H(path.split('/')[1])}); });
}
let L = 0; const lid = () => 'log' + (++L);

// ── 9) توثيق البريد ──
await t('غير موثّق لا يرسل طلب استلام', mk(dave, 'claims/i1_dave', claim('i1', 'dave')), false);
await t('غير موثّق لا يسجّل بلاغاً', mk(dave, 'reports/r1', {officeId: O, uid: 'dave', cat: 'phones', title: 'جوال', status: 'open', createdAt: now}), false);
await t('موثّق يسجّل بلاغاً', mk(alice, 'reports/r1', {officeId: O, uid: 'alice', cat: 'phones', title: 'جوال', status: 'open', createdAt: now, renewedAt: now}));
await t('موثّق يرسل طلب استلام (مع reportId لبلاغه)', mk(alice, 'claims/i1_alice', claim('i1', 'alice', {reportId: 'r1'})));

// ── 1-3) القبول ضمن batch، ثم طلب منافس على المحجوز ──
await t('قبول الطلب: الطلب + الغرض + السجل في batch واحد', batch(A, (b, r) => {
  b.update(r('claims/i1_alice'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now + 7 * 864e5});
  b.update(r('items/i1'), {status: 'reserved', reservedFor: 'i1_alice', updatedAt: now});
  b.set(r('logs/' + lid()), logDoc('staffA', 'approve', {itemId: 'i1', claimId: 'i1_alice'}));
}));
await t('10) طلب منافس على غرض محجوز يُقبل إرساله', mk(bob, 'claims/i1_bob', claim('i1', 'bob')));
await t('حالة طلب غير معروفة مرفوضة', updateDoc(doc(A, 'claims/i1_bob'), {status: 'hacked'}), false);

// ── 8) فصل المهام ──
await t('موظف يرسل طلباً على غرض', mk(A, 'claims/i2_staffA', claim('i2', 'staffA')));
await t('8) الموظف لا يقبل طلبه هو', updateDoc(doc(A, 'claims/i2_staffA'), {status: 'approved', decidedAt: now, decidedBy: 'staffA'}), false);
// القبول يحجز الغرض في الـ batch نفسه (المرحلة D: القواعد تشترط ذلك)
await t('موظف آخر يقبل طلبه (مع حجز الغرض)', batch(B, (b, r) => {
  b.update(r('claims/i2_staffA'), {status: 'approved', decidedAt: now, decidedBy: 'staffB', pickupBy: now});
  b.update(r('items/i2'), {status: 'reserved', reservedFor: 'i2_staffA', updatedAt: now});
}));

// ── 3) التسليم: الطلب المحجوز له + إغلاق المنافس + السجل ──
await t('التسليم في batch: done + returned + رفض المنافس + سجل', batch(B, (b, r) => {
  b.update(r('claims/i1_alice'), {status: 'done', doneAt: now, doneBy: 'staffB', handoverCode: CODE});
  b.update(r('items/i1'), {status: 'returned', returnedAt: now, updatedAt: now});
  b.update(r('claims/i1_bob'), {status: 'rejected', note: 'سُلّم الغرض لصاحبه بعد التحقق', decidedAt: now, decidedBy: 'staffB'});
  b.set(r('logs/' + lid()), logDoc('staffB', 'handover', {itemId: 'i1', claimId: 'i1_alice'}));
}));
await t('لا طلب جديد على غرض مُسلَّم', mk(carol, 'claims/i1_carol', claim('i1', 'carol')), false);

// ── 6) انتهاء مهلة الاستلام ──
await t('إنهاء الحجز: expired + available + سجل', batch(B, (b, r) => {
  b.update(r('claims/i2_staffA'), {status: 'expired', note: 'انتهت مهلة الاستلام', decidedAt: now, decidedBy: 'staffB'});
  b.update(r('items/i2'), {status: 'available', reservedFor: '', updatedAt: now});
  b.set(r('logs/' + lid()), logDoc('staffB', 'release', {itemId: 'i2', claimId: 'i2_staffA'}));
}));

// ── 4) تسليم مباشر مع طلب معلّق ──
await t('طلب معلّق على i3', mk(carol, 'claims/i3_carol', claim('i3', 'carol')));
await t('4) تسليم مباشر: ملاحظة في itemSecrets + إلغاء الطلب + سجل', batch(A, (b, r) => {
  b.set(r('itemSecrets/i3'), {...sec, handoverNote: 'محمد — آخر 4 أرقام: 1234'});
  b.update(r('claims/i3_carol'), {status: 'cancelled', note: 'سُلّم الغرض لصاحبه مباشرة في المكتب', decidedAt: now, decidedBy: 'staffA'});
  b.update(r('items/i3'), {status: 'returned', returnedAt: now, updatedAt: now, reservedFor: ''});
  b.set(r('logs/' + lid()), logDoc('staffA', 'status:returned', {itemId: 'i3'}));
}));
// ملاحظة: القواعد لا تمنع handoverNote في items (ليس ضمن secretKeys)، والتطبيق لا يكتبه هناك أبداً — مذكور في docs/AUDIT.md
await t('القواعد تقبل handoverNote في items (التطبيق لا يكتبه هناك)', updateDoc(doc(A, 'items/i3'), {handoverNote: 'x'}));
await t('صاحب الطلب الملغى يجهّله عند حذف حسابه', updateDoc(doc(carol, 'claims/i3_carol'), {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', anonymizedAt: now}));

// ── 7) التصرّف بعد مدة الحفظ ──
await t('v14: التصرّف قبل انتهاء مدة الحفظ مرفوض للموظف', batch(A, (b, r) => {
  b.update(r('items/i4'), {status: 'disposed', disposal: 'donated', disposedAt: now, reservedFor: '', updatedAt: now}); }), false);
await t('v14: الموظف لا يغيّر مدة الحفظ', upItem(A, 'i4', {keepUntil: KEEP_PAST}), false);
await t('v14: المدير يغيّر مدة الحفظ', upItem(owner, 'i4', {keepUntil: KEEP_PAST}));
await t('7) التصرّف: disposed + disposalNote + سجل (بعد انتهاء المدة)', batch(A, (b, r) => {
  b.update(r('items/i4'), {status: 'disposed', disposal: 'donated', disposedAt: now, reservedFor: '', updatedAt: now});
  b.set(r('itemSecrets/i4'), {...sec, disposalNote: 'جمعية البر'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'dispose', {itemId: 'i4'}));
}));
await t('disposalNote السري مرفوض في items', updateDoc(doc(A, 'items/i4'), {storage: 'x'}), false);

// ── 5) حذف غرض عليه طلب ──
await t('طلب على i5', mk(bob, 'claims/i5_bob', claim('i5', 'bob')));
await t('5) الحذف: إلغاء الطلب + حذف السري + الغرض + سجل في batch', batch(A, (b, r) => {
  b.update(r('claims/i5_bob'), {status: 'cancelled', note: 'حُذف الغرض من المستودع', decidedAt: now, decidedBy: 'staffA'});
  b.delete(r('itemSecrets/i5')); b.delete(r('items/i5'));
  b.set(r('logs/' + lid()), logDoc('staffA', 'delete', {itemId: 'i5'}));
}));
await t('صاحب الطلب يرى أنه أُلغي', getDoc(doc(bob, 'claims/i5_bob')));

// ── السجل: إضافة فقط ──
await t('سجل باسم شخص آخر مرفوض', setDoc(doc(A, 'logs/x1'), logDoc('staffB', 'approve')), false);
await t('تعديل السجل مرفوض', updateDoc(doc(A, 'logs/log1'), {note: 'x'}), false);
await t('الزائر لا يقرأ السجل', getDoc(doc(alice, 'logs/log1')), false);
await t('الموظف يقرأ السجل', getDoc(doc(A, 'logs/log1')));

// ── سؤال التحقق (للجزء C) ──
await t('طلب على i6', mk(alice, 'claims/i6_alice', claim('i6', 'alice')));
await t('الموظف يطرح سؤالاً', updateDoc(doc(A, 'claims/i6_alice'), {question: 'ما خلفية الشاشة؟', askedAt: now, askedBy: 'staffA'}));
await t('صاحب الطلب يجيب', updateDoc(doc(alice, 'claims/i6_alice'), {answer: 'صورة قطة', answeredAt: now}));
await t('صاحب الطلب لا يغيّر حالة طلبه', updateDoc(doc(alice, 'claims/i6_alice'), {status: 'approved'}), false);

// ── إشعار التسليم foundReports (للجزء C) ──
await t('إشعار تسليم من حساب موثّق', mk(bob, 'foundReports/f1', {officeId: O, uid: 'bob', cat: 'keys', sub: '', spot: 'المواقف', bldg: '', room: '', foundDate: '2026-09-25', note: 'مفتاح', status: 'pending', createdAt: now}));
await t('إشعار تسليم من غير موثّق مرفوض', mk(dave, 'foundReports/f2', {officeId: O, uid: 'dave', status: 'pending', createdAt: now}), false);
await t('الموظف يؤكد الاستلام', updateDoc(doc(A, 'foundReports/f1'), {status: 'received', receivedAt: now, receivedBy: 'staffA', itemId: 'i6'}));

// ── الجزء C: ما يفعله التطبيق فعلاً (الاستعلامات والـbatch) ──
const q = (db, col, ...w) => getDocs(query(collection(db, col), ...w.map(([f, op, v]) => where(f, op, v))));
await t('C: الموظف يسأل (الطلب + السجل في batch)', batch(A, (b, r) => {
  b.update(r('claims/i6_alice'), {question: 'ما لون الغلاف؟', askedAt: now + 1, askedBy: 'staffA'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'ask', {itemId: 'i6', claimId: 'i6_alice', note: 'ما لون الغلاف؟'}));
}));
await t('C: موظف لا يسأل في طلبه هو', batch(A, (b, r) => { b.update(r('claims/i2_staffA'), {question: 'x'.repeat(10), askedAt: now, askedBy: 'staffA'}); }), false);
await t('C: إشعارات التسليم المعلّقة للموظف (استعلام)', q(A, 'foundReports', ['officeId', '==', O], ['status', '==', 'pending']));
await t('C: إشعاراتي أنا (استعلام بـ uid)', q(bob, 'foundReports', ['uid', '==', 'bob']));
await t('C: الزائر لا يستعلم عن إشعارات المكتب', q(bob, 'foundReports', ['officeId', '==', O]), false);
await t('C: إشعار ثانٍ', mk(bob, 'foundReports/f3', {officeId: O, uid: 'bob', cat: 'phones', sub: 'جوال', spot: 'المكتبة', bldg: '', room: '', foundDate: '2026-09-26', note: '', status: 'pending', createdAt: now}));
await t('C: استلام الإشعار + سجل الإنشاء (batch)', batch(A, (b, r) => {
  b.update(r('foundReports/f3'), {status: 'received', receivedAt: now, receivedBy: 'staffA', itemId: 'i5'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'create', {itemId: 'i5'}));
}));
await t('C: إشعار ثالث', mk(bob, 'foundReports/f4', {officeId: O, uid: 'bob', cat: 'bags', sub: '', spot: '', bldg: '', room: '', foundDate: '2026-09-26', note: '', status: 'pending', createdAt: now}));
await t('C: «لم يصل» (إشعار + سجل)', batch(A, (b, r) => {
  b.update(r('foundReports/f4'), {status: 'cancelled'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'found:drop'));
}));
await t('C: إشعار رابع', mk(bob, 'foundReports/f5', {officeId: O, uid: 'bob', cat: 'keys', sub: '', spot: '', bldg: '', room: '', foundDate: '2026-09-26', note: '', status: 'pending', createdAt: now}));
await t('C: الواجد يلغي إشعاره المعلّق', updateDoc(doc(bob, 'foundReports/f5'), {status: 'cancelled', cancelledAt: now}));
await t('C: الواجد يحذف الملغى', deleteDoc(doc(bob, 'foundReports/f5')));
await t('C: الواجد لا يحذف المستلَم', deleteDoc(doc(bob, 'foundReports/f3')), false);
await t('C: «حذف حسابي» يمسح بيانات المستلَم', updateDoc(doc(bob, 'foundReports/f3'), {uid: 'deleted', note: ''}));
await t('C: سجل حيازة غرض للموظف (استعلام)', q(A, 'logs', ['officeId', '==', O], ['itemId', '==', 'i6']));
await t('C: الزائر لا يستعلم عن السجل', q(alice, 'logs', ['officeId', '==', O], ['itemId', '==', 'i6']), false);
await t('C: الموظف يقرأ التفاصيل السرية لمكتبه (تصدير CSV)', q(A, 'itemSecrets', ['officeId', '==', O]));
await t('C: الزائر لا يقرأ التفاصيل السرية', q(alice, 'itemSecrets', ['officeId', '==', O]), false);
await t('C: الموظف يقرأ اسم صاحب الطلب ولغته (users العامة)', getDoc(doc(A, 'users/alice')));
await t('C: رفض طلب i6 بعد الإجابة', updateDoc(doc(B, 'claims/i6_alice'), {status: 'rejected', note: 'لا يطابق', decidedAt: now, decidedBy: 'staffB'}));
await t('C: «حذف حسابي» يمسح الإجابة مع بيانات الطلب المنتهي', updateDoc(doc(alice, 'claims/i6_alice'), {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', answer: '', anonymizedAt: now}));

// ── المرحلة D4: حراسة سلسلة الحيازة على الخادم ──
const approveB = (db, item, cid, by) => batch(db, (b, r) => {
  b.update(r('claims/' + cid), {status: 'approved', decidedAt: now, decidedBy: by, pickupBy: now + 7 * 864e5});
  b.update(r('items/' + item), {status: 'reserved', reservedFor: cid, updatedAt: now});
  b.set(r('logs/' + lid()), logDoc(by, 'approve', {itemId: item, claimId: cid}));
});
await t('D: طلب بالاسم وآخر 4 أرقام', mk(alice, 'claims/i7_alice', claim('i7', 'alice', {claimantName: 'أليس محمد', idLast4: '1234'})));
await t('D: آخر 4 أرقام غير صحيحة مرفوضة', mk(carol, 'claims/i7_carol', claim('i7', 'carol', {idLast4: '12a4'})), false);
await t('D: طلب منافس', mk(bob, 'claims/i7_bob', claim('i7', 'bob')));
await t('D: القبول الأول (batch)', approveB(A, 'i7', 'i7_alice', 'staffA'));
await t('D: قبولان متتاليان من batchين: الثاني يُرفض', approveB(B, 'i7', 'i7_bob', 'staffB'), false);
await t('D: قبول دون حجز الغرض مرفوض', updateDoc(doc(B, 'claims/i7_bob'), {status: 'approved', decidedAt: now, decidedBy: 'staffB'}), false);
await t('D: طلب على i8', mk(carol, 'claims/i8_carol', claim('i8', 'carol')));
await t('D: «محجوز» دون طلب مقبول مرفوض', upItem(A, 'i8', {status: 'reserved', reservedFor: 'i8_carol', updatedAt: now}), false);
await t('D: «محجوز» لطلب غير موجود مرفوض', upItem(A, 'i8', {status: 'reserved', reservedFor: 'ghost', updatedAt: now}), false);
await t('D: «سُلّم» دون طلب مكتمل ودون handoverNote مرفوض', upItem(A, 'i8', {status: 'returned', returnedAt: now, updatedAt: now}), false);
await t('D: «مكتمل» دون حجز الغرض له مرفوض', batch(A, (b, r) => {
  b.update(r('claims/i8_carol'), {status: 'done', doneAt: now, doneBy: 'staffA'});
  b.update(r('items/i8'), {status: 'returned', returnedAt: now, updatedAt: now});
}), false);
await t('D: التسليم بالرمز (done + returned + handoverNote في الطلب) مقبول', batch(B, (b, r) => {
  b.update(r('claims/i7_alice'), {status: 'done', doneAt: now, doneBy: 'staffB', handoverNote: 'استلمه: أليس محمد — آخر 4: 1234', handoverCode: CODE});
  b.update(r('items/i7'), {status: 'returned', returnedAt: now, updatedAt: now});
  b.update(r('claims/i7_bob'), {status: 'rejected', note: 'x', decidedAt: now, decidedBy: 'staffB'});
  b.set(r('logs/' + lid()), logDoc('staffB', 'handover', {itemId: 'i7', claimId: 'i7_alice'}));
}));
await t('D: «حذف حسابي» يمسح الاسم وآخر 4 وملاحظة التسليم', updateDoc(doc(alice, 'claims/i7_alice'), {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', claimantName: '', idLast4: '', handoverNote: '', anonymizedAt: now}));
await t('D: تسليم مباشر مع handoverNote في الـ batch نفسه مقبول', batch(A, (b, r) => {
  b.set(r('itemSecrets/i8'), {...sec, handoverNote: 'سارة — آخر 4 أرقام: 4321', finderNote: 'خالد — 9876'});
  b.update(r('claims/i8_carol'), {status: 'cancelled', note: 'x', decidedAt: now, decidedBy: 'staffA'});
  b.update(r('items/i8'), {status: 'returned', returnedAt: now, updatedAt: now, reservedFor: ''});
  b.set(r('logs/' + lid()), logDoc('staffA', 'status:returned', {itemId: 'i8'}));
}));
await t('D: finderNote طويل جداً مرفوض', updateDoc(doc(A, 'itemSecrets/i8'), {finderNote: 'x'.repeat(301)}), false);
// إعادة التفعيل: قبول ← انتهت المهلة (الغرض متاح) ← يعود مقبولاً ويُحجز له
await t('D: طلب على i9', mk(bob, 'claims/i9_bob', claim('i9', 'bob')));
await t('D: قبول i9', approveB(A, 'i9', 'i9_bob', 'staffA'));
await t('D: انتهاء المهلة i9', batch(A, (b, r) => {
  b.update(r('claims/i9_bob'), {status: 'expired', note: 'انتهت مهلة الاستلام', decidedAt: now, decidedBy: 'staffA'});
  b.update(r('items/i9'), {status: 'available', reservedFor: '', updatedAt: now});
}));
await t('D: إعادة تفعيل طلب منتهٍ (expired ← approved) بعد إتاحة الغرض', batch(B, (b, r) => {
  b.update(r('claims/i9_bob'), {status: 'approved', note: '', decidedAt: now, decidedBy: 'staffB', pickupBy: now + 7 * 864e5});
  b.update(r('items/i9'), {status: 'reserved', reservedFor: 'i9_bob', updatedAt: now});
  b.set(r('logs/' + lid()), logDoc('staffB', 'reactivate', {itemId: 'i9', claimId: 'i9_bob'}));
}));
await t('D: إعادة تفعيل طلب ملغى إلى «قيد المراجعة»', batch(A, (b, r) => {
  b.update(r('claims/i8_carol'), {status: 'pending', note: '', decidedAt: now, decidedBy: 'staffA'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'reactivate', {itemId: 'i8', claimId: 'i8_carol'}));
}));
// «محجوز» قديم دون طلب مقبول فعلي: batch يعيده متاحاً، ثم batch القبول
await env.withSecurityRulesDisabled(async c => { await updateDoc(doc(c.firestore(), 'items/i10'), {status: 'reserved', reservedFor: 'ghost'}); });
await t('D: طلب على i10 المحجوز', mk(carol, 'claims/i10_carol', claim('i10', 'carol')));
await t('D: قبول مباشر على «محجوز» يتيم مرفوض', approveB(A, 'i10', 'i10_carol', 'staffA'), false);
await t('D: إتاحة الغرض أولاً', batch(A, (b, r) => { b.update(r('items/i10'), {status: 'available', reservedFor: '', updatedAt: now}); b.set(r('logs/' + lid()), logDoc('staffA', 'status:available', {itemId: 'i10'})); }));
await t('D: ثم القبول', approveB(A, 'i10', 'i10_carol', 'staffA'));
// إشعار التسليم بكود
await t('D: إشعار تسليم بكود', mk(bob, 'foundReports/f6', {officeId: O, uid: 'bob', cat: 'cash', sub: '', spot: '', bldg: '', room: '', foundDate: '2026-09-26', note: '', code: 'K7M3TX', status: 'pending', createdAt: now}));
await t('D: الموظف يبحث بالكود (استعلام)', q(A, 'foundReports', ['officeId', '==', O], ['status', '==', 'pending']));
// إدارة الموظفين والسجل
await t('D: المالك يمنح إدارة لموظف', setDoc(doc(owner, 'admins/staffA'), {role: 'admin', addedAt: now, addedBy: 'owner'}));
await t('D: قيد صلاحية في السجل (itemId فارغ)', setDoc(doc(owner, 'logs/' + lid()), logDoc('owner', 'perm:admin', {note: 'staffA'})));
await t('D: المالك يزيل الإدارة', deleteDoc(doc(owner, 'admins/staffA')));
await t('D: لا يمكن إزالة المالك', deleteDoc(doc(owner, 'admins/owner')), false);
await t('D: سجل العمليات للمالك (officeId + action in)', q(owner, 'logs', ['officeId', '==', O], ['action', 'in', ['status:returned', 'delete', 'dispose', 'perm:grant', 'perm:revoke', 'perm:admin', 'perm:unadmin']]));
await t('D: المالك يقرأ ملف صاحب طلب الصلاحية', getDoc(doc(owner, 'users/alice')));

// ── المرحلة E: إجابات أسئلة التصنيف (details)، وإغلاق البلاغ ──
await t('E: itemSecrets مع details: {amount: "300"}', updateDoc(doc(A, 'itemSecrets/i11'), {details: {amount: '300', holder: 'envelope'}}));
await t('E: details بمفتاح غير معروف مرفوض', updateDoc(doc(A, 'itemSecrets/i11'), {details: {foo: 'x'}}), false);
await t('E: details مجموع أطوالها فوق 1200 مرفوض', updateDoc(doc(A, 'itemSecrets/i11'), {details: {denoms: 'x'.repeat(700), inside: 'y'.repeat(700)}}), false);
await t('E: details في items مرفوض', updateDoc(doc(A, 'items/i11'), {details: {amount: '300'}}), false);
// قيمة رقمية لا نصية: النتيجة تُسجَّل فقط (التطبيق يحفظ نصوصاً دائماً)
let numeric = 'قُبلت';
try { await assertFails(updateDoc(doc(A, 'itemSecrets/i11'), {details: {amount: 300}})); numeric = 'رُفضت'; } catch { numeric = 'قُبلت'; }
R.push('ℹ E: قيمة رقمية {amount: 300} في details: ' + numeric);
await t('E: طلب استلام مع details صحيح', mk(carol, 'claims/i11_carol', claim('i11', 'carol', {claimantName: 'كارول', idLast4: '5555', details: {amount: '300', holder: 'envelope'}})));
await t('E: طلب استلام بمفتاح details غير معروف مرفوض', mk(bob, 'claims/i11_bob', claim('i11', 'bob', {details: {secret: 'x'}})), false);
await t('E: رفض طلب i11', updateDoc(doc(A, 'claims/i11_carol'), {status: 'rejected', note: 'x', decidedAt: now, decidedBy: 'staffA'}));
await t('E: «حذف حسابي» مع details: {}', updateDoc(doc(carol, 'claims/i11_carol'), {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', claimantName: '', idLast4: '', details: {}, anonymizedAt: now}));
// البلاغ: «ليس غرضي» وسبب الإغلاق
const rep = (x = {}) => ({officeId: O, uid: 'alice', cat: 'cash', title: 'نقود', status: 'open', createdAt: now, ...x});
await t('E: بلاغ مع details', mk(alice, 'reports/rE', rep({details: {amount: '300'}})));
await t('E: إنشاء بلاغ فيه closedReason مرفوض', mk(alice, 'reports/rE2', rep({closedReason: 'self'})), false);
await t('E: إنشاء بلاغ فيه pickRejected مرفوض', mk(alice, 'reports/rE3', rep({pickRejected: 'i11'})), false);
await t('E: الموظف يرشّح i11', updateDoc(doc(A, 'reports/rE'), {staffPick: 'i11', pickedAt: now}));
await t('E: pickRejected بقيمة غير الترشيح الحالي مرفوض', updateDoc(doc(alice, 'reports/rE'), {pickRejected: 'i9'}), false);
await t('E: «ليس غرضي» (pickRejected = الترشيح الحالي)', updateDoc(doc(alice, 'reports/rE'), {pickRejected: 'i11'}));
await t('E: closedReason = x مرفوض', updateDoc(doc(alice, 'reports/rE'), {status: 'closed', closedAt: now, closedReason: 'x'}), false);
await t('E: closedReason = office', updateDoc(doc(alice, 'reports/rE'), {status: 'closed', closedAt: now, closedReason: 'office'}));
await t('E: closedReason = self', updateDoc(doc(alice, 'reports/rE'), {closedReason: 'self'}));

// ── المرحلة E5: مكان العثور سري ──
await t('E5: إنشاء غرض فيه spot مرفوض', setDoc(doc(A, 'items/n1'), {...pub('n1'), spot: 'المكتبة'}), false);
await t('E5: إنشاء غرض بلا spot', setDoc(doc(A, 'items/n1'), pub('n1')));
await t('E5: itemSecrets فيه spot مقبول', setDoc(doc(A, 'itemSecrets/n1'), sec));
await t('E5: تعديل غرض بإضافة spot مرفوض', updateDoc(doc(A, 'items/n1'), {spot: 'المكتبة'}), false);
await t('E5: spot طويل جداً في itemSecrets مرفوض', updateDoc(doc(A, 'itemSecrets/n1'), {spot: 'x'.repeat(401)}), false);
await t('E5: تغيير حالة غرض قديم دون نقل مكانه مرفوض', upItem(A, 'L1', {status: 'archived', updatedAt: now}), false);
await t('E5: batch النقل (itemSecrets merge + deleteField) مقبول', batch(A, (b, r) => {
  b.set(r('itemSecrets/L1'), {officeId: O, spot: 'المكتبة'}, {merge: true});
  b.update(r('items/L1'), {spot: deleteField()});
}));
await t('E5: بعد النقل يبقى fromFound ويُقرأ المكان من itemSecrets', getDoc(doc(A, 'items/L1')).then(s => { if (s.data().fromFound !== 'f9' || 'spot' in s.data()) throw new Error('bad'); return getDoc(doc(A, 'itemSecrets/L1')); }).then(s => { if (s.data().spot !== 'المكتبة' || s.data().storage !== 'الخزانة 1') throw new Error('bad secret'); }));
// (v14: الأرشفة قبل انتهاء مدة الحفظ للمدير، فيؤرشفه المدير هنا)
await t('E5: تغيير حالة غرض قديم بلا itemSecrets مع نقل مكانه في الـ batch نفسه', batch(owner, (b, r) => {
  b.set(r('itemSecrets/L2'), {officeId: O, spot: 'الكافتيريا'}, {merge: true});
  b.update(r('items/L2'), {status: 'archived', reservedFor: '', updatedAt: now, spot: deleteField()});
}));
await t('E5: تسليم مباشر لغرض قديم (itemSecrets كاملاً مع spot وhandoverNote)', batch(A, (b, r) => {
  b.set(r('itemSecrets/L3'), {...sec, spot: 'المواقف', handoverNote: 'علي — آخر 4 أرقام: 1234'});
  b.update(r('items/L3'), {status: 'returned', returnedAt: now, updatedAt: now, reservedFor: '', spot: deleteField()});
}));
await t('E5: الموظف يجلب مكان أغراض مكتبه للإحصاءات (itemSecrets officeId ==)', q(A, 'itemSecrets', ['officeId', '==', O]));

// ── المرحلة F: رقم الطلب، والتقييم، ومؤشرات المكتب ──
await t('F: طلب فيه رقم قصير no', mk(carol, 'claims/n1_carol', claim('n1', 'carol', {no: 'REQ-7K3M'})));
await t('F: رقم طلب أطول من 16 مرفوض', mk(bob, 'claims/n1_bob', claim('n1', 'bob', {no: 'x'.repeat(17)})), false);
await t('F: تقييم طلب غير مكتمل مرفوض', updateDoc(doc(carol, 'claims/n1_carol'), {rating: 5, ratedAt: now}), false);
// i7_alice مكتمل بالرمز (المرحلة D) ثم جُهّل بحذف الحساب؛ نستخدم طلباً مكتملاً جديداً لـ bob
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'claims/i9_bob2'), {...claim('i9', 'bob'), status: 'done', doneAt: now}); });
await t('F: تقييم 6 مرفوض', updateDoc(doc(bob, 'claims/i9_bob2'), {rating: 6, ratedAt: now}), false);
await t('F: تقييم عشري مرفوض', updateDoc(doc(bob, 'claims/i9_bob2'), {rating: 4.5, ratedAt: now}), false);
await t('F: غير صاحب الطلب لا يقيّم', updateDoc(doc(carol, 'claims/i9_bob2'), {rating: 5, ratedAt: now}), false);
await t('F: تقييم طلب مكتمل مرة واحدة', updateDoc(doc(bob, 'claims/i9_bob2'), {rating: 4, ratingNote: 'تعامل ممتاز', ratedAt: now}));
await t('F: التقييم الثاني مرفوض', updateDoc(doc(bob, 'claims/i9_bob2'), {rating: 5, ratedAt: now + 1}), false);
await t('F: «حذف حسابي» يمسح ratingNote ويبقى rating', updateDoc(doc(bob, 'claims/i9_bob2'), {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', ratingNote: '', anonymizedAt: now}));
await t('F: الموظف يجلب الطلبات المكتملة للإحصاءات', q(A, 'claims', ['officeId', '==', O], ['status', '==', 'done']));
const ps = {month: '2026-09', monthReceived: 12, monthReturned: 7, totalReceived: 140, totalReturned: 96, returnRate: 69, avgDays: 3.4, avgRating: 4.6, ratings: 31, updatedAt: now};
await t('F: غير الموظف يكتب publicStats مرفوض', setDoc(doc(bob, 'publicStats/' + O), ps), false);
await t('F: موظف مكتب آخر يكتب publicStats مرفوض', setDoc(doc(A, 'publicStats/air'), ps), false);
await t('F: الموظف يكتب publicStats لمكتبه', setDoc(doc(A, 'publicStats/' + O), ps));
await t('F: مفتاح غريب في publicStats مرفوض', setDoc(doc(A, 'publicStats/' + O), {...ps, secret: 1}), false);
await t('F: نسبة إرجاع فوق 100 مرفوضة', setDoc(doc(A, 'publicStats/' + O), {...ps, returnRate: 120}), false);
await t('F: رقم نصي في publicStats مرفوض', setDoc(doc(A, 'publicStats/' + O), {...ps, totalReceived: '140'}), false);
await t('F: الزائر غير المسجّل يقرأ publicStats', getDoc(doc(anon, 'publicStats/' + O)));

// ── المرحلة G: «ليس غرضي» كقائمة، وتعديل البلاغ والطلب ──
await env.withSecurityRulesDisabled(async c => { const d = c.firestore(); for (const k of ['g1', 'g2', 'g3']) await setDoc(doc(d, 'items/' + k), pub(k)); });
await t('G: إنشاء بلاغ فيه rejected مرفوض', mk(alice, 'reports/rG0', rep({rejected: ['i1']})), false);
await t('G: إنشاء بلاغ', mk(alice, 'reports/rG', rep()));
await t('G: إضافة إلى rejected', updateDoc(doc(alice, 'reports/rG'), {rejected: ['i1', 'i2']}));
await t('G: الحذف من rejected مرفوض', updateDoc(doc(alice, 'reports/rG'), {rejected: ['i1']}), false);
await t('G: أكثر من 30 في rejected مرفوض', updateDoc(doc(alice, 'reports/rG'), {rejected: ['i1', 'i2', ...Array.from({length: 29}, (_, k) => 'x' + k)]}), false);
await t('G: تعديل البلاغ مع editedAt', updateDoc(doc(alice, 'reports/rG'), {title: 'محفظة نقود', desc: 'بنية', editedAt: now}));
await t('G: editedAt نصي مرفوض', updateDoc(doc(alice, 'reports/rG'), {editedAt: 'now'}), false);
await t('G: غير صاحب البلاغ لا يضيف إلى rejected', updateDoc(doc(bob, 'reports/rG'), {rejected: ['i1', 'i2', 'i3']}), false);
await t('G: طلب استلام g1', mk(alice, 'claims/g1_alice', claim('g1', 'alice', {claimantName: 'أليس', idLast4: '1234'})));
await t('G: تعديل طلب قيد المراجعة بلا سؤال', updateDoc(doc(alice, 'claims/g1_alice'), {proof: 'غلاف أزرق', lostSpot: 'الممر', idLast4: '4321', details: {amount: '200'}, editedAt: now}));
await t('G: editedAt نصي في الطلب مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {proof: 'x', editedAt: 'now'}), false);
await t('G: صاحب الطلب يغيّر الحالة مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {status: 'approved', editedAt: now}), false);
await t('G: idLast4 = abcd مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {idLast4: 'abcd', editedAt: now}), false);
await t('G: مفتاح details غير معروف مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {details: {secret: 'x'}, editedAt: now}), false);
await t('G: غير صاحب الطلب لا يعدّله', updateDoc(doc(bob, 'claims/g1_alice'), {proof: 'x', editedAt: now}), false);
await t('G: الموظف يسأل', updateDoc(doc(A, 'claims/g1_alice'), {question: 'ما لون الغلاف من الداخل؟', askedAt: now, askedBy: 'staffA'}));
await t('G: التعديل بعد السؤال مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {proof: 'y', editedAt: now}), false);
await t('G: طلب استلام g2', mk(bob, 'claims/g2_bob', claim('g2', 'bob')));
await t('G: قبول g2', batch(A, (b, r) => {
  b.update(r('claims/g2_bob'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now});
  b.update(r('items/g2'), {status: 'reserved', reservedFor: 'g2_bob', updatedAt: now});
}));
await t('G: تعديل طلب مقبول مرفوض', updateDoc(doc(bob, 'claims/g2_bob'), {proof: 'z', editedAt: now}), false);

// ── دعوات الموظفين (بدل «طلب صلاحية موظف») ──
const withEmail = (uid, email, verified = true) => env.authenticatedContext(uid, {email, email_verified: verified}).firestore();
const newbie = withEmail('newbie', 'new@x.com'), newbieUnv = withEmail('newbie', 'new@x.com', false), other = withEmail('other', 'other@x.com');
const inv = (offices = [O]) => ({offices, createdBy: 'owner', createdAt: now});
const acceptBatch = (db, uid, email, offices, extra = {}) => batch(db, (b, r) => {
  b.set(r('staff/' + uid), {offices, approvedAt: now, approvedBy: 'owner', ...extra});
  b.delete(r('staffInvites/' + email));
  for (const o of offices) b.set(r('logs/' + lid()), logDoc(uid, 'perm:grant', {note: uid}));
});
await t('INV: زائر لا ينشئ staffRequests', setDoc(doc(alice, 'staffRequests/alice'), {offices: [O], note: 'x', status: 'pending', createdAt: now}), false);
await t('INV: غير الإداري لا يكتب في staffInvites', setDoc(doc(bob, 'staffInvites/bob@x.com'), {offices: [O], createdBy: 'bob', createdAt: now}), false);
await t('INV: الموظف (غير الإداري) لا يكتب في staffInvites', setDoc(doc(A, 'staffInvites/new@x.com'), {...inv(), createdBy: 'staffA'}), false);
await t('INV: المالك ينشئ دعوة', setDoc(doc(owner, 'staffInvites/new@x.com'), inv()));
await t('INV: معرّف الدعوة بأحرف كبيرة مرفوض', setDoc(doc(owner, 'staffInvites/New@x.com'), inv()), false);
await t('INV: حقل غريب في الدعوة مرفوض', setDoc(doc(owner, 'staffInvites/z@x.com'), {...inv(), admin: true}), false);
await t('INV: بريد غير موثّق لا يقرأ الدعوة', getDoc(doc(newbieUnv, 'staffInvites/new@x.com')), false);
await t('INV: بريد غير موثّق لا ينشئ staff', setDoc(doc(newbieUnv, 'staff/newbie'), {offices: [O], approvedAt: now, approvedBy: 'owner'}), false);
await t('INV: لا أحد يقرأ دعوة غيره', getDoc(doc(other, 'staffInvites/new@x.com')), false);
await t('INV: المدعو يقرأ دعوته', getDoc(doc(newbie, 'staffInvites/new@x.com')));
await t('INV: البريد بأحرف كبيرة في الحساب يقرأ دعوته (lower)', getDoc(doc(withEmail('newbie', 'NEW@x.com'), 'staffInvites/new@x.com')));
await t('INV: إضافة مكتب آخر غير الدعوة مرفوض', acceptBatch(newbie, 'newbie', 'new@x.com', [O, 'air']), false);
await t('INV: حقل إضافي في staff مرفوض', acceptBatch(newbie, 'newbie', 'new@x.com', [O], {note: 'x'}), false);
await t('INV: approvedBy غير صاحب الدعوة مرفوض', batch(newbie, (b, r) => { b.set(r('staff/newbie'), {offices: [O], approvedAt: now, approvedBy: 'newbie'}); b.delete(r('staffInvites/new@x.com')); }), false);
await t('INV: المدعو لا يحذف الدعوة وحدها', deleteDoc(doc(newbie, 'staffInvites/new@x.com')), false);
await t('INV: مستخدم آخر لا ينشئ staff بدعوة غيره', setDoc(doc(other, 'staff/other'), {offices: [O], approvedAt: now, approvedBy: 'owner'}), false);
await t('INV: قبول الدعوة: staff بالمكاتب نفسها + حذف الدعوة + perm:grant في batch واحد', acceptBatch(newbie, 'newbie', 'new@x.com', [O]));
await t('INV: الموظف الجديد يقرأ مفقودات مكتبه السرية', getDoc(doc(newbie, 'itemSecrets/i1')));
await t('INV: الموظف لا يعدّل وثيقة staff الخاصة به', updateDoc(doc(newbie, 'staff/newbie'), {offices: [O, 'air']}), false);
await t('INV: المالك يلغي دعوة', batch(owner, (b, r) => { b.set(r('staffInvites/gone@x.com'), inv()); }).then(() => deleteDoc(doc(owner, 'staffInvites/gone@x.com'))));
await t('INV: المالك يقرأ طلبات الصلاحية القديمة ويحذفها', getDocs(collection(owner, 'staffRequests')));

// ── لغة المستخدم (للجزء B) ──
await t('lang = en مسموح', setDoc(doc(alice, 'users/alice'), {name: 'A', photo: '', lastSeen: now, lang: 'en'}));
await t('lang غير معروفة مرفوضة', setDoc(doc(alice, 'users/alice'), {name: 'A', lang: 'fr'}), false);
await t('الزائر غير المسجّل يقرأ المفقودات العامة', getDoc(doc(anon, 'items/i2')));

// ── H7 (قواعد v6): فحص أمني ──
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  for (const k of ['h1', 'h2', 'h3', 'h4']){ await setDoc(doc(d, 'items/' + k), pub(k)); await setDoc(doc(d, 'itemSecrets/' + k), sec); } });
const FUTURE = 9e15;
// 1) التواريخ والأوقات
await t('H7-1: طلب فيه lostDate = x مرفوض', mk(bob, 'claims/h1_bob', claim('h1', 'bob', {lostDate: 'x'})), false);
await t('H7-1: طلب فيه createdAt نصي مرفوض', mk(bob, 'claims/h1_bob', claim('h1', 'bob', {createdAt: 'x'})), false);
await t('H7-1: طلب فيه createdAt مستقبلي (9e15) مرفوض', mk(bob, 'claims/h1_bob', claim('h1', 'bob', {createdAt: FUTURE})), false);
await t('H7-1: طلب بتاريخ فارغ ووقت الآن مقبول', mk(bob, 'claims/h1_bob', claim('h1', 'bob', {lostDate: ''})));
await t('H7-1: بلاغ فيه lostDate = x مرفوض', mk(alice, 'reports/h7r0', rep({lostDate: 'x'})), false);
await t('H7-1: بلاغ بتاريخ صحيح مقبول', mk(alice, 'reports/h7r1', rep({lostDate: '2026-09-20'})));
await t('H7-1: إشعار تسليم فيه foundDate = x مرفوض', mk(bob, 'foundReports/h7f0', {officeId: O, uid: 'bob', cat: 'keys', foundDate: 'x', status: 'pending', createdAt: now}), false);
await t('H7-1: تعديل البلاغ بـ editedAt مستقبلي مرفوض', updateDoc(doc(alice, 'reports/h7r1'), {title: 'نقودي', editedAt: FUTURE}), false);
await t('H7-1: تجديد البلاغ بـ renewedAt الآن مقبول', updateDoc(doc(alice, 'reports/h7r1'), {renewedAt: Date.now()}));
// 2) سؤال التحقق: الإجابة القديمة تُمسح، ووقت الإجابة «الآن» فقط
await t('H7-2: الموظف يسأل ويمسح الإجابة القديمة', updateDoc(doc(A, 'claims/h1_bob'), {question: 'ما لون الغلاف؟', askedAt: now, askedBy: 'staffA', answer: deleteField(), answeredAt: deleteField()}));
await t('H7-2: إجابة بوقت مستقبلي (9e15) مرفوضة', updateDoc(doc(bob, 'claims/h1_bob'), {answer: 'أحمر', answeredAt: FUTURE}), false);
await t('H7-2: إجابة بوقت الآن مقبولة', updateDoc(doc(bob, 'claims/h1_bob'), {answer: 'أحمر', answeredAt: Date.now()}));
await t('H7-2: الموظف لا يكتب إجابة بدل صاحب الطلب', updateDoc(doc(A, 'claims/h1_bob'), {answer: 'مزيّفة'}), false);
await t('H7-2: سؤال جديد يمسح الإجابة السابقة', updateDoc(doc(A, 'claims/h1_bob'), {question: 'ما خلفية الشاشة؟', askedAt: now + 1, askedBy: 'staffA', answer: deleteField(), answeredAt: deleteField()}));
await t('H7-2: بعد السؤال الجديد لا إجابة محفوظة', getDoc(doc(A, 'claims/h1_bob')).then(x => { if ('answer' in x.data()) throw new Error('answer still there'); }));
// 3) reportId لبلاغ صاحب الطلب فقط
await t('H7-3: طلب مرتبط ببلاغ شخص آخر مرفوض', mk(carol, 'claims/h2_carol', claim('h2', 'carol', {reportId: 'r1'})), false);
await t('H7-3: طلب مرتبط ببلاغ غير موجود مرفوض', mk(carol, 'claims/h2_carol', claim('h2', 'carol', {reportId: 'nope'})), false);
await t('H7-3: طلب بلا بلاغ مرتبط مقبول', mk(carol, 'claims/h2_carol', claim('h2', 'carol')));
// 4) المكتب موجود، والتصنيف نص قصير
await t('H7-4: بلاغ لمكتب غير موجود مرفوض', mk(alice, 'reports/h7r2', rep({officeId: 'nope'})), false);
await t('H7-4: بلاغ بتصنيف أطول من 40 حرفاً مرفوض', mk(alice, 'reports/h7r3', rep({cat: 'x'.repeat(41)})), false);
await t('H7-4: إشعار تسليم لمكتب غير موجود مرفوض', mk(bob, 'foundReports/h7f1', {officeId: 'nope', uid: 'bob', cat: 'keys', status: 'pending', createdAt: now}), false);
await t('H7-4: إشعار تسليم بتصنيف رقمي مرفوض', mk(bob, 'foundReports/h7f2', {officeId: O, uid: 'bob', cat: 5, status: 'pending', createdAt: now}), false);
await t('H7-4: إشعار تسليم صحيح مقبول', mk(bob, 'foundReports/h7f3', {officeId: O, uid: 'bob', cat: 'keys', foundDate: '2026-09-27', status: 'pending', createdAt: now}));
// 5) users.email = بريد الحساب
await t('H7-5/v13: بريد مختلف عن بريد الحساب مرفوض (private/profile)', setDoc(doc(bob, 'users/bob/private/profile'), {email: 'admin@college.edu'}), false);
await t('H7-5/v13: بريد الحساب نفسه مقبول (private/profile)', setDoc(doc(bob, 'users/bob/private/profile'), {email: 'bob@x.com'}));
await t('v13: البريد في الوثيقة العامة users مرفوض', setDoc(doc(bob, 'users/bob'), {name: 'Bob', email: 'bob@x.com', lastSeen: now}), false);
await t('v13: الوثيقة العامة بلا بريد', setDoc(doc(bob, 'users/bob'), {name: 'Bob', lastSeen: now}));
// 6) سجل الحيازة لا يُحذف
await t('H7-6: المالك لا يحذف قيداً من السجل', deleteDoc(doc(owner, 'logs/log1')), false);
await t('H7-6: الموظف يضيف قيداً للسجل', setDoc(doc(A, 'logs/' + lid()), logDoc('staffA', 'edit', {itemId: 'h1'})));
// 7) CSP في index.html: تفحصه tools/check-i18n.mjs وtools/fuzz.mjs (ليس من القواعد)
R.push('ℹ H7-7: سياسة CSP تُفحص في check-i18n.mjs وfuzz.mjs');
// 8) حدّ الإغراق: إنشاء واحد كل 20 ثانية لكل حساب، بوقت الخادم فقط
await setRate('bob', Date.now() - 60000);
await t('H7-8: إنشاء بلا rate في العملية نفسها مرفوض', setDoc(doc(bob, 'foundReports/h7f4'), {officeId: O, uid: 'bob', cat: 'keys', status: 'pending', createdAt: now}), false);
await t('H7-8: rate بوقت الجهاز لا الخادم مرفوض', batch(bob, (b, r) => { b.set(r('foundReports/h7f5'), {officeId: O, uid: 'bob', cat: 'keys', status: 'pending', createdAt: now}); b.set(r('rate/bob'), {at: Timestamp.fromMillis(Date.now())}); }), false);
await t('H7-8: الإنشاء الأول مع rate مقبول', batch(bob, (b, r) => { b.set(r('foundReports/h7f6'), {officeId: O, uid: 'bob', cat: 'keys', status: 'pending', createdAt: now}); b.set(r('rate/bob'), RATE()); }));
await t('H7-8: إنشاء ثانٍ خلال 20 ثانية مرفوض', batch(bob, (b, r) => { b.set(r('foundReports/h7f7'), {officeId: O, uid: 'bob', cat: 'keys', status: 'pending', createdAt: now}); b.set(r('rate/bob'), RATE()); }), false);
await t('H7-8: حذف rate خلال 20 ثانية (لتجاوز الحدّ) مرفوض', deleteDoc(doc(bob, 'rate/bob')), false);
await t('H7-8: صاحب الحساب يقرأ rate الخاص به', getDoc(doc(bob, 'rate/bob')));
await t('H7-8: لا يقرأ rate حساب آخر', getDoc(doc(carol, 'rate/bob')), false);
await setRate('bob', Date.now() - 30000);
await t('H7-8: بعد 20 ثانية يُقبل الإنشاء', batch(bob, (b, r) => { b.set(r('foundReports/h7f8'), {officeId: O, uid: 'bob', cat: 'keys', status: 'pending', createdAt: now}); b.set(r('rate/bob'), RATE()); }));

// ── v7: تقوية إثبات الملكية ──
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  for (const [k, cat] of [['q1', 'bags'], ['q2', 'phones'], ['q3', 'glasses'], ['q4', 'clothes'], ['q5', 'bags'], ['p1', 'bags'], ['p2', 'bags'], ['hv1', 'phones'], ['hv2', 'cash'], ['lg1', 'phones']]){
    await setDoc(doc(d, 'items/' + k), pub(k, cat)); await setDoc(doc(d, 'itemSecrets/' + k), sec); }
  await setDoc(doc(d, 'offices/dom'), {name: 'كلية', active: true, createdAt: 1, claimDomains: ['tvtc.edu.sa'], claimDomainRe: '.*@([a-z0-9-]+[.])*tvtc[.]edu[.]sa'});
  await setDoc(doc(d, 'items/d1'), {...pub('d1'), officeId: 'dom'});
    // طلب قديم (قبل v9): بصمة رمزه (6 أرقام) في codeHash بالطلب نفسه، بلا claimCodes
  await setDoc(doc(d, 'claims/lg1_carol'), claim('lg1', 'carol', {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now + 864e5, codeHash: H('lg1_carol', '482913')}));
  await setDoc(doc(d, 'items/lg1'), {...pub('lg1', 'phones'), status: 'reserved', reservedFor: 'lg1_carol'}); });
const qu = as('qu');
const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(100);
// 2) الحصة: 3 طلبات جارية، وطلب واحد لكل تصنيف كل 24 ساعة
await setQuota('qu', {open: []});
await t('v7-2: الطلب الأول (حقائب)', mk(qu, 'claims/q1_qu', claim('q1', 'qu'), {keepQuota: true}));
await t('v7-2: طلب ثانٍ في التصنيف نفسه خلال 24 ساعة مرفوض', mk(qu, 'claims/q5_qu', claim('q5', 'qu'), {keepQuota: true}), false);
await t('v7-2: الطلب الثاني (جوالات)', mk(qu, 'claims/q2_qu', claim('q2', 'qu'), {keepQuota: true}));
await t('v7-2: الطلب الثالث (نظارات)', mk(qu, 'claims/q3_qu', claim('q3', 'qu'), {keepQuota: true}));
await t('v7-2: الطلب الرابع الجاري مرفوض (الحد 3)', mk(qu, 'claims/q4_qu', claim('q4', 'qu'), {keepQuota: true}), false);
await setRate('qu', Date.now() - 60000);
await t('v7-2: طلب دون تحديث الحصة في العملية نفسها مرفوض', batch(qu, (b, r) => { b.set(r('claims/q4_qu'), claim('q4', 'qu')); b.set(r('rate/qu'), RATE()); }), false);
await t('v7-2: إضافة رقم إلى الحصة دون طلب حقيقي مرفوضة', updateDoc(doc(qu, 'claimQuota/qu'), {open: arrayUnion('fake_qu')}), false);
await t('v7-2: صاحب الحساب لا يفرّغ حصته وطلبه ما زال جارياً', updateDoc(doc(qu, 'claimQuota/qu'), {open: arrayRemove('q1_qu')}), false);
await t('v7-2: الموظف لا يزيل طلباً ما زال جارياً', updateDoc(doc(A, 'claimQuota/qu'), {open: arrayRemove('q1_qu')}), false);
await t('v7-2: الرفض يزيل الطلب من الحصة في العملية نفسها', batch(A, (b, r) => {
  b.update(r('claims/q1_qu'), {status: 'rejected', note: 'x', decidedAt: now, decidedBy: 'staffA'});
  b.set(r('claimQuota/qu'), {open: arrayRemove('q1_qu')}, {merge: true}); }));
await t('v7-2: بعد الرفض يُقبل طلب جديد في تصنيف آخر (ملابس)', mk(qu, 'claims/q4_qu', claim('q4', 'qu'), {keepQuota: true}));
await t('v7-2: حساب قديم بلا حصة: الموظف يغلق طلبه ويُنشأ مستند فارغ', batch(A, (b, r) => {
  b.update(r('claims/i6_alice'), {note: 'x'}); b.set(r('claimQuota/oldUser'), {open: arrayRemove('i6_alice')}, {merge: true}); }));
// 3) صور الإثبات
await setQuota('bob', {open: []}); await setRate('bob', Date.now() - 60000);
await t('v7-3: طلب مع صورة إثبات في batch واحد', batch(bob, (b, r) => {
  b.set(r('claims/p1_bob'), claim('p1', 'bob', {proofs: 1})); b.set(r('rate/bob'), RATE());
  b.set(r('claimQuota/bob'), {open: arrayUnion('p1_bob'), lastByCat: {bags: serverTimestamp()}}, {merge: true});
  b.set(r('claimProofs/p1_bob_0'), {claimId: 'p1_bob', officeId: O, uid: 'bob', data: IMG, createdAt: now});
  b.set(r('claimCodes/p1_bob'), {uid: 'bob', hash: H('p1_bob')}); }));
await t('v7-3: صورة ثانية وعدد الصور 1 مرفوضة', setDoc(doc(bob, 'claimProofs/p1_bob_1'), {claimId: 'p1_bob', officeId: O, uid: 'bob', data: IMG, createdAt: now}), false);
await t('v7-3: شخص آخر لا يضيف صورة لطلب غيره', setDoc(doc(carol, 'claimProofs/p1_bob_0'), {claimId: 'p1_bob', officeId: O, uid: 'carol', data: IMG, createdAt: now}), false);
await t('v7-3: صاحب الطلب يقرأ صورته', getDoc(doc(bob, 'claimProofs/p1_bob_0')));
await t('v7-3: موظف المكتب يقرأ الصورة', getDoc(doc(A, 'claimProofs/p1_bob_0')));
await t('v7-3: مستخدم آخر لا يقرأ الصورة', getDoc(doc(carol, 'claimProofs/p1_bob_0')), false);
await t('v7-3: الزائر غير المسجّل لا يقرأ الصورة', getDoc(doc(anon, 'claimProofs/p1_bob_0')), false);
await t('v7-3: الموظف لا يحذف الصورة والطلب ما زال قيد المراجعة', deleteDoc(doc(A, 'claimProofs/p1_bob_0')), false);
await t('v7-3: الرفض يحذف الصورة ويصفّر عددها ويزيل الحصة في batch واحد', batch(A, (b, r) => {
  b.update(r('claims/p1_bob'), {status: 'rejected', note: 'x', decidedAt: now, decidedBy: 'staffA', proofs: 0});
  b.delete(r('claimProofs/p1_bob_0')); b.set(r('claimQuota/bob'), {open: arrayRemove('p1_bob')}, {merge: true}); }));
// 5) H14 (v10): موافقة واحدة لكل التصنيفات (أُلغي شرط الموافقتين)
await t('v10: طلب على جوال (ثمين)', mk(alice, 'claims/hv1_alice', claim('hv1', 'alice')));
await t('v10: قبول غرض ثمين (جوال) بموظف واحد', batch(A, (b, r) => {
  b.update(r('claims/hv1_alice'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now});
  b.update(r('items/hv1'), {status: 'reserved', reservedFor: 'hv1_alice', updatedAt: now}); }));
await t('v14: طلب مباشر على غرض نقود (تصنيف مجمّع) مرفوض', mk(carol, 'claims/hv2_carol', claim('hv2', 'carol')), false);
// طلب مباشر قديم على نقود (قبل v14) يبقى صالحاً لبقية الاختبارات
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'claims/hv2_carol'), claim('hv2', 'carol')); });
await t('v10: الموظف لا يكتب حقل approvals بعد الآن', updateDoc(doc(A, 'claims/hv2_carol'), {approvals: ['staffA']}), false);
// طلب قديم فيه موافقة أولى فقط (قبل v10): الموظف نفسه يقبله مباشرة، ويبقى الحقل القديم كما هو
await env.withSecurityRulesDisabled(async c => { await updateDoc(doc(c.firestore(), 'claims/hv2_carol'), {approvals: ['staffA']}); });
await t('v10: قبول طلب نقود فيه موافقة أولى قديمة من الموظف نفسه', batch(A, (b, r) => {
  b.update(r('claims/hv2_carol'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now});
  b.update(r('items/hv2'), {status: 'reserved', reservedFor: 'hv2_carol', updatedAt: now}); }));
await t('v14: الطلب القديم (رمز codeHash من 6 أرقام) لا يسلّمه الموظف', batch(A, (b, r) => {
  b.update(r('claims/lg1_carol'), {status: 'done', doneAt: now, doneBy: 'staffA', handoverNote: 'كارول — 1234', handoverCode: '482913'});
  b.update(r('items/lg1'), {status: 'returned', returnedAt: now, updatedAt: now}); }), false);
await t('v7-5/v14: طلب قديم مقبول بلا approvals يسلّمه المدير بالرمز القديم', batch(owner, (b, r) => {
  b.update(r('claims/lg1_carol'), {status: 'done', doneAt: now, doneBy: 'owner', handoverNote: 'كارول — 1234', handoverCode: '482913'});
  b.update(r('items/lg1'), {status: 'returned', returnedAt: now, updatedAt: now}); }));
// 6) نطاق بريد الكلية
const stu = withEmail('stu', 'Ali@STU.tvtc.edu.sa'), evil = withEmail('evil', 'x@eviltvtc.edu.sa'), gm = withEmail('gm', 'x@gmail.com');
for (const [db, uid] of [[stu, 'stu'], [evil, 'evil'], [gm, 'gm']]) UID.set(db, uid);
const dclaim = uid => ({...claim('d1', uid), officeId: 'dom'});
await t('v7-6: بريد gmail لمكتب يشترط بريد الكلية مرفوض', mk(gm, 'claims/d1_gm', dclaim('gm')), false);
await t('v7-6: نطاق يشبه الكلية (eviltvtc.edu.sa) مرفوض', mk(evil, 'claims/d1_evil', dclaim('evil')), false);
await t('v7-6: بريد الكلية (نطاق فرعي، أحرف كبيرة) مقبول', mk(stu, 'claims/d1_stu', dclaim('stu')));
await t('v7-6: المكتب بلا نطاقات يقبل أي بريد موثّق', mk(gm, 'claims/q2_gm', claim('q2', 'gm')));
await t('v7-6: البلاغ في مكتب الكلية متاح لأي حساب', mk(gm, 'reports/dr1', {officeId: 'dom', uid: 'gm', cat: 'bags', title: 'حقيبتي', status: 'open', createdAt: now}));
// 4) فحوص التسليم في السجل
await t('v7-4: قيد التسليم مع checks (مفاتيح فقط)', setDoc(doc(A, 'logs/' + lid()), {...logDoc('staffA', 'handover', {itemId: 'hv1'}), checks: ['ho.phones.unlock', 'ho.phones.imei']}));
await t('v7-4: checks ليست قائمة مرفوضة', setDoc(doc(A, 'logs/' + lid()), {...logDoc('staffA', 'handover', {itemId: 'hv1'}), checks: 'x'}), false);
// البيانات القديمة
await t('v7: قراءة طلب قديم (بلا proofs ولا approvals)', getDoc(doc(A, 'claims/i6_alice')));

// ── v8 (H11): الطلب المجمّع بالوصف (بلا اختيار غرض) وربطه بغرض عند الموظف ──
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  for (const [k, cat, st] of [['m1', 'cash', 'available'], ['m2', 'cash', 'available'], ['m3', 'bags', 'available'], ['m4', 'cash', 'reserved']]){
    await setDoc(doc(d, 'items/' + k), {...pub(k, cat), status: st}); await setDoc(doc(d, 'itemSecrets/' + k), sec);
  }
  await setDoc(doc(d, 'items/mx'), {...pub('mx', 'cash'), officeId: 'dom'});
});
const gc = (uid, cat = 'cash', at = now, x = {}) => ({itemId: '', cat, grouped: true, officeId: O, uid, proof: '', color: '', brand: '', lostSpot: 'المكتبة', bldg: '', room: '',
  lostDate: '2026-09-19', claimantName: 'اسم كامل', idLast4: '1234', details: {amount: '150'}, status: 'pending', createdAt: at, ...x});
const gid = (uid, cat, at) => `g_${uid}_${cat}_${at}`;
const T1 = now, T2 = now + 1, T3 = now + 2;
await t('v8: طلب مجمّع للنقود (بلا غرض) مقبول', mk(alice, 'claims/' + gid('alice', 'cash', T1), gc('alice', 'cash', T1)));
await t('v8: طلب مجمّع لتصنيف غير مجمّع (حقائب) مرفوض', mk(bob, 'claims/' + gid('bob', 'bags', T1), gc('bob', 'bags', T1)), false);
await t('v8: طلب مجمّع برقم لا يطابق النمط مرفوض', mk(bob, 'claims/g_bob_cash_1', gc('bob', 'cash', T1)), false);
await t('v8: طلب مجمّع باسم مستخدم آخر مرفوض', mk(bob, 'claims/' + gid('carol', 'cash', T1), gc('carol', 'cash', T1)), false);
await t('v8: طلب مجمّع فيه itemId مرفوض', mk(bob, 'claims/' + gid('bob', 'cash', T1), gc('bob', 'cash', T1, {itemId: 'm1'})), false);
await t('v8: grouped بلا true (طلب عادي فيه cat) مرفوض', mk(bob, 'claims/m1_bob', {...claim('m1', 'bob'), cat: 'cash'}), false);
await t('v8: طلب مجمّع ثانٍ في التصنيف نفسه خلال 24 ساعة مرفوض (الحصة)', mk(alice, 'claims/' + gid('alice', 'cash', T2), gc('alice', 'cash', T2), {keepQuota: true}), false);
await t('v8: طلب مجمّع للبطاقات من الحساب نفسه (تصنيف آخر) مقبول', mk(alice, 'claims/' + gid('alice', 'ids', T3), gc('alice', 'ids', T3, {details: {docLast4: '5678'}}), {keepQuota: true}));
const G = gid('alice', 'cash', T1);
await t('v8: صاحب الطلب يقرأ طلبه المجمّع', getDoc(doc(alice, 'claims/' + G)));
// الربط: للموظف فقط، ومرة واحدة، بغرض متاح من المكتب والتصنيف نفسيهما
const link = (db, by, itemId, x = {}) => setDoc(doc(db, 'claimLinks/' + G), {officeId: O, itemId, by, at: now, ...x});
await t('v8: صاحب الطلب لا يربط itemId بنفسه (claimLinks)', link(alice, 'alice', 'm1'), false);
await t('v8: صاحب الطلب لا يكتب itemId في طلبه', updateDoc(doc(alice, 'claims/' + G), {itemId: 'm1'}), false);
await t('v8: الموظف لا يكتب itemId في الطلب مباشرة (دون قبول)', updateDoc(doc(A, 'claims/' + G), {itemId: 'm1'}), false);
await t('v8: ربط بغرض من تصنيف آخر (حقائب) مرفوض', link(A, 'staffA', 'm3'), false);
await t('v8: ربط بغرض غير متاح (محجوز) مرفوض', link(A, 'staffA', 'm4'), false);
await t('v8: ربط بغرض من مكتب آخر مرفوض', link(A, 'staffA', 'mx'), false);
await t('v8: ربط باسم موظف آخر مرفوض', link(A, 'staffB', 'm1'), false);
await t('v8: الموظف يربط الطلب بغرض متاح من التصنيف نفسه', link(A, 'staffA', 'm1'));
await t('v8: لا يُعدَّل الربط (مرة واحدة)', link(B, 'staffB', 'm2'), false);
await t('v8: صاحب الطلب لا يقرأ الربط (لا يرى الغرض قبل القبول)', getDoc(doc(alice, 'claimLinks/' + G)), false);
await t('v8: الموظف يقرأ الربط', getDoc(doc(A, 'claimLinks/' + G)));
// القبول: itemId = الغرض المربوط، مع حجزه (v10: موافقة واحدة)
const gApprove = (db, by, itemId) => batch(db, (b, r) => {
  b.update(r('claims/' + G), {status: 'approved', itemId, decidedAt: now, decidedBy: by, pickupBy: now + 7 * 864e5});
  b.update(r('items/' + itemId), {status: 'reserved', reservedFor: G, updatedAt: now});
});
await t('v8: قبول بغرض غير المربوط مرفوض', gApprove(B, 'staffB', 'm2'), false);
await t('v8/v10: القبول بموظف واحد يكتب itemId المربوط ويحجز الغرض', gApprove(A, 'staffA', 'm1'));
await t('v8: بعد القبول لا يتغير itemId', updateDoc(doc(A, 'claims/' + G), {itemId: 'm2'}), false);
await t('v8: التسليم بالرمز للطلب المجمّع بعد قبوله', batch(A, (b, r) => {
  b.update(r('claims/' + G), {status: 'done', doneAt: now, doneBy: 'staffA', handoverNote: 'أليس — 1234', handoverCode: CODE});
  b.update(r('items/m1'), {status: 'returned', returnedAt: now, updatedAt: now}); }));
// رفض وانتهاء: يبقيان متاحين دون ربط
const G2 = gid('alice', 'ids', T3);
await t('v8: رفض طلب مجمّع بلا ربط مع سبب', updateDoc(doc(A, 'claims/' + G2), {status: 'rejected', note: 'لا يطابق', decidedAt: now, decidedBy: 'staffA'}));
await t('v8: طلب عادي قديم (بلا cat ولا grouped) ما زال يُقرأ', getDoc(doc(A, 'claims/i6_alice')));

// ── v9 (H12): إصلاحات أمنية ومنطقية ──
const DAY = 864e5;
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  const put = async (k, x) => { await setDoc(doc(d, 'items/' + k), {...pub(k, x.cat || 'bags'), ...x}); await setDoc(doc(d, 'itemSecrets/' + k), sec); };
  for (const k of ['k1', 'k2', 'k3', 'k4']) await put(k, {});                          // رمز الاستلام، والإلغاء
  await put('c1', {cat: 'bags'}); await put('c2', {cat: 'phones'});                    // تغيير التصنيف
  await put('dh1', {cat: 'phones'}); await put('dh2', {cat: 'bags'});                  // التسليم المباشر
  await put('del1', {sample: true, createdAt: now - 30 * DAY}); await put('del2', {createdAt: now - 3600e3});
  await put('del3', {createdAt: now - 3 * DAY}); await put('del4', {cat: 'phones', createdAt: now - 3600e3}); await put('del5', {cat: 'phones', createdAt: now - 3 * DAY});
  await put('w1', {cat: 'wallets'}); await put('id1', {cat: 'ids'});                  // البطاقات والمحافظ ثمينة
  await put('rs1', {status: 'reserved', reservedFor: 'rs1_bob'}); await put('rs2', {status: 'reserved', reservedFor: 'rs2_bob'});
  await setDoc(doc(d, 'claims/rs1_bob'), {...claim('rs1', 'bob'), status: 'approved', pickupBy: now + DAY});
  await setDoc(doc(d, 'claims/rs2_bob'), {...claim('rs2', 'bob'), status: 'approved', pickupBy: now + DAY});
  // 3 طلبات منافسة على غرض واحد، لكل منها صورتا إثبات، وحصة كل صاحب طلب
  await put('cp1', {status: 'reserved', reservedFor: 'cp1_alice'});
  await setDoc(doc(d, 'claims/cp1_alice'), {...claim('cp1', 'alice'), status: 'approved', pickupBy: now + DAY});
  await setDoc(doc(d, 'claimCodes/cp1_alice'), {uid: 'alice', hash: H('cp1_alice')});
  for (const u of ['bob', 'carol', 'qu']){
    await setDoc(doc(d, `claims/cp1_${u}`), {...claim('cp1', u), proofs: 2});
    for (const k of [0, 1]) await setDoc(doc(d, `claimProofs/cp1_${u}_${k}`), {claimId: `cp1_${u}`, officeId: O, uid: u, data: IMG, createdAt: now});
    await setDoc(doc(d, 'claimQuota/' + u), {open: [`cp1_${u}`]});
  }
  await setDoc(doc(d, 'reports/rv9'), {officeId: O, uid: 'alice', cat: 'bags', title: 'حقيبتي', status: 'open', createdAt: now - DAY});
  await setDoc(doc(d, 'foundReports/fv9'), {officeId: O, uid: 'bob', cat: 'bags', status: 'pending', createdAt: now});
});
// 1) رمز الاستلام على الخادم
await t('v9-1: طلب جديد مع بصمة رمزه (claimCodes) في العملية نفسها', mk(alice, 'claims/k1_alice', claim('k1', 'alice')));
await t('v9-1: طلب جديد بلا claimCodes مرفوض', mk(bob, 'claims/k1_bob', claim('k1', 'bob'), {noCode: true}), false);
await t('v9-1: طلب جديد فيه codeHash مرفوض', mk(carol, 'claims/k1_carol', claim('k1', 'carol', {codeHash: H('k1_carol')})), false);
await t('v9-1: بصمة لطلب موجود من قبل مرفوضة', setDoc(doc(alice, 'claimCodes/k1_alice'), {uid: 'alice', hash: H('x')}), false);
await t('v9-1: بصمة بطول غير 64 مرفوضة', batch(qu, (b, r) => { b.set(r('claimCodes/k2_qu'), {uid: 'qu', hash: 'ab'}); }), false);
await t('v9-1: صاحب الطلب لا يقرأ بصمة رمزه', getDoc(doc(alice, 'claimCodes/k1_alice')), false);
await t('v9-1: الموظف لا يقرأ البصمة', getDoc(doc(A, 'claimCodes/k1_alice')), false);
await t('v9-1: لا تُعدَّل البصمة ولا تُحذف', deleteDoc(doc(alice, 'claimCodes/k1_alice')), false);
await t('v9-1: قبول k1', approveB(A, 'k1', 'k1_alice', 'staffA'));
const doneB = (db, item, cid, code) => batch(db, (b, r) => {
  b.update(r('claims/' + cid), {status: 'done', doneAt: now, doneBy: 'staffB', handoverNote: 'أليس — 1234', ...(code === null ? {} : {handoverCode: code})});
  b.update(r('items/' + item), {status: 'returned', returnedAt: now, updatedAt: now});
});
await t('v9-1: التسليم برمز خاطئ مرفوض', doneB(B, 'k1', 'k1_alice', 'ACDE3468'), false);
await t('v9-1: التسليم دون handoverCode مرفوض', doneB(B, 'k1', 'k1_alice', null), false);
await t('v9-1: handoverCode في غير التسليم مرفوض', updateDoc(doc(B, 'claims/k1_alice'), {handoverCode: CODE}), false);
await t('v9-1: التسليم بالرمز الصحيح (القواعد تحسب sha256)', doneB(B, 'k1', 'k1_alice', CODE));
// 2) الأغراض الثمينة: التسليم المباشر والحذف للإدارة (v10: تغيير التصنيف حر)
await t('v10: الموظف يغيّر التصنيف إلى ثمين (v11: مع public: false للنقود)', upItem(A, 'c1', {cat: 'cash', public: false, updatedAt: now}));
await t('v14: الموظف لا يخفّض التصنيف من ثمين إلى غير ثمين', upItem(A, 'c2', {cat: 'bags', updatedAt: now}), false);
await t('v14: المدير يخفّض التصنيف من ثمين', upItem(owner, 'c2', {cat: 'bags', updatedAt: now}));
await t('v9-2: الموظف يغيّر بين تصنيفين عاديين', upItem(A, 'c2', {cat: 'glasses', updatedAt: now}));
const directB = (db, item) => batch(db, (b, r) => {
  b.update(r('itemSecrets/' + item), {handoverNote: 'سُلّم مباشرة: فلان — 1234'});
  b.update(r('items/' + item), {status: 'returned', returnedAt: now, updatedAt: now});
});
await t('v9-2: الموظف لا يسلّم غرضاً ثميناً تسليماً مباشراً', directB(A, 'dh1'), false);
await t('v9-2: الإدارة تسلّم غرضاً ثميناً تسليماً مباشراً', directB(owner, 'dh1'));
await t('v9-2: الموظف يسلّم غرضاً عادياً تسليماً مباشراً', directB(A, 'dh2'));
await t('v9-2: الموظف يحذف مثالاً', delItem(A, 'del1'));
await t('v9-2: الموظف يحذف غرضاً عادياً سُجّل قبل ساعة (خطأ إدخال)', deleteDoc(doc(A, 'itemSecrets/del2')).then(() => delItem(A, 'del2')));
await t('v9-2: الموظف لا يحذف غرضاً سُجّل قبل 3 أيام', delItem(A, 'del3'), false);
await t('v9-2: الموظف لا يحذف التفاصيل السرية لغرض لا يُحذف', deleteDoc(doc(A, 'itemSecrets/del3')), false);
await t('v9-2: الموظف لا يحذف غرضاً ثميناً ولو كان جديداً', delItem(A, 'del4'), false);
await t('v9-2: الإدارة تحذف غرضاً ثميناً قديماً', deleteDoc(doc(owner, 'itemSecrets/del5')).then(() => delItem(owner, 'del5')));
// 3) v10: قبول محفظة (ثمينة) بموظف واحد
await t('v14: طلب مباشر على محفظة مرفوض', mk(bob, 'claims/w1_bob', claim('w1', 'bob')), false);
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'claims/w1_bob'), claim('w1', 'bob')); });
await t('v10: قبول محفظة بموظف واحد', batch(A, (b, r) => {
  b.update(r('claims/w1_bob'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now});
  b.update(r('items/w1'), {status: 'reserved', reservedFor: 'w1_bob', updatedAt: now}); }));
// 4) حماية الحجز
await t('v9-4: فك حجز غرض لطلب ما زال مقبولاً مرفوض', upItem(A, 'rs1', {status: 'available', reservedFor: '', updatedAt: now}), false);
await t('v9-4: تغيير reservedFor لطلب آخر مرفوض', updateDoc(doc(A, 'items/rs1'), {reservedFor: 'rs1_carol', updatedAt: now}), false);
await t('v9-4: تعديل حقل آخر والغرض محجوز مسموح', updateDoc(doc(A, 'items/rs1'), {sub: 'حقيبة ظهر', updatedAt: now}));
await t('v9-4: فك الحجز مع إنهاء الطلب في العملية نفسها', batch(A, (b, r) => {
  b.update(r('claims/rs2_bob'), {status: 'expired', note: 'انتهت المهلة', decidedAt: now, decidedBy: 'staffA'});
  b.update(r('items/rs2'), {status: 'available', reservedFor: '', updatedAt: now}); }));
// 5) منع إعادة الطلب بعد سؤال الموظف
await t('v9-5: طلب k3', mk(bob, 'claims/k3_bob', claim('k3', 'bob')));
await t('v9-5: سؤال الموظف', updateDoc(doc(A, 'claims/k3_bob'), {question: 'ما لون السحاب؟', askedAt: now, askedBy: 'staffA'}));
await t('v9-5: حذف الطلب بعد السؤال مرفوض', deleteDoc(doc(bob, 'claims/k3_bob')), false);
await t('v9-5: الإلغاء بحقل آخر مرفوض', updateDoc(doc(bob, 'claims/k3_bob'), {status: 'cancelled', cancelledAt: now, proof: 'x'}), false);
await t('v9-5: «إلغاء» الطلب + إزالته من الحصة في batch واحد', batch(bob, (b, r) => {
  b.update(r('claims/k3_bob'), {status: 'cancelled', cancelledAt: Date.now()});
  b.set(r('claimQuota/bob'), {open: arrayRemove('k3_bob')}, {merge: true}); }));
await t('v9-5: طلب k4 بصورة إثبات، وموافقة أولى قديمة', mk(carol, 'claims/k4_carol', claim('k4', 'carol', {proofs: 1}))
  .then(() => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'claimProofs/k4_carol_0'), {claimId: 'k4_carol', officeId: O, uid: 'carol', data: IMG, createdAt: now}); await updateDoc(doc(c.firestore(), 'claims/k4_carol'), {approvals: ['staffA']}); })));
await t('v9-5: «إلغاء» مع حذف صورة الإثبات والحصة', batch(carol, (b, r) => {
  b.update(r('claims/k4_carol'), {status: 'cancelled', cancelledAt: Date.now()});
  b.delete(r('claimProofs/k4_carol_0'));
  b.set(r('claimQuota/carol'), {open: arrayRemove('k4_carol')}, {merge: true}); }));
await t('v9-5: طلب بلا سؤال يُحذف', mk(qu, 'claims/k2_qu', claim('k2', 'qu')).then(() => deleteDoc(doc(qu, 'claims/k2_qu'))));
const zz = as('zz'); await setQuota('zz', {open: []});
await t('v10: طلب فيه موافقة أولى قديمة بلا سؤال يحذفه صاحبه', mk(zz, 'claims/k2_zz', claim('k2', 'zz'))
  .then(() => env.withSecurityRulesDisabled(async c => { await updateDoc(doc(c.firestore(), 'claims/k2_zz'), {approvals: ['staffA']}); }))
  .then(() => deleteDoc(doc(zz, 'claims/k2_zz'))));
// 6) تقوية الحقول
await t('v9-6: قيد سجل بوقت قديم مرفوض', setDoc(doc(A, 'logs/' + lid()), {...logDoc('staffA', 'edit', {itemId: 'k2'}), at: now - 5 * DAY}), false);
await t('v9-6: قيد سجل بوقت «الآن»', setDoc(doc(A, 'logs/' + lid()), {...logDoc('staffA', 'edit', {itemId: 'k2'}), at: Date.now()}));
await t('v9-6: ai بمفتاح غريب مرفوض', updateDoc(doc(alice, 'reports/rv9'), {ai: {at: now, matches: [], x: 1}}), false);
await t('v9-6: ai بأكثر من 10 نتائج مرفوض', updateDoc(doc(alice, 'reports/rv9'), {ai: {at: now, matches: Array.from({length: 11}, (_, k) => ({id: 'i' + k}))}}), false);
await t('v9-6: ai صحيح', updateDoc(doc(alice, 'reports/rv9'), {ai: {at: now, matches: [{id: 'i1', reason: 'x'}]}}));
await t('v9-6: تغيير createdAt عند تعديل البلاغ مرفوض', updateDoc(doc(alice, 'reports/rv9'), {createdAt: Date.now(), title: 'حقيبة', editedAt: Date.now()}), false);
await t('v9-6: تعديل البلاغ دون تغيير createdAt', updateDoc(doc(alice, 'reports/rv9'), {title: 'حقيبة', editedAt: Date.now()}));
await t('v9-6: receivedBy باسم موظف آخر مرفوض', updateDoc(doc(A, 'foundReports/fv9'), {status: 'received', receivedAt: now, receivedBy: 'staffB', itemId: 'k2'}), false);
await t('v9-6: receivedBy = الموظف نفسه', updateDoc(doc(A, 'foundReports/fv9'), {status: 'received', receivedAt: now, receivedBy: 'staffA', itemId: 'k2'}));
// 7) تسليم مع 3 طلبات منافسة (لكل منها صورتا إثبات وحصة): هل تكفي حدود القراءات في batch واحد؟
const closeRivals = (b, r) => { for (const u of ['bob', 'carol', 'qu']){
  b.update(r(`claims/cp1_${u}`), {status: 'rejected', note: 'سُلّم لصاحبه', decidedAt: now, decidedBy: 'staffA', proofs: 0});
  for (const k of [0, 1]) b.delete(r(`claimProofs/cp1_${u}_${k}`));
  b.set(r('claimQuota/' + u), {open: arrayRemove(`cp1_${u}`)}, {merge: true}); } };
const handCp = (b, r) => { b.update(r('claims/cp1_alice'), {status: 'done', doneAt: now, doneBy: 'staffA', handoverNote: 'أليس — 1234', handoverCode: CODE});
  b.update(r('items/cp1'), {status: 'returned', returnedAt: now, updatedAt: now}); b.set(r('logs/' + lid()), {...logDoc('staffA', 'handover', {itemId: 'cp1', claimId: 'cp1_alice'}), at: Date.now()}); };
// النتيجة: batch واحد يكفي (ضمن حد 20 قراءة للعملية)، فيبقى التسليم وإغلاق المنافسين معاً كما في workflow.js
await t('v9-7: التسليم + إغلاق 3 منافسين (6 صور + 3 حصص) في batch واحد', batch(A, (b, r) => { handCp(b, r); closeRivals(b, r); }));

// ── H13a: طلب يتيم (غرضه حُذف) يغلقه الموظف «منتهياً»: القواعد لا تقرأ الغرض في هذا الانتقال ──
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  await setDoc(doc(d, 'claims/gone1_bob'), {...claim('gone1', 'bob'), proofs: 1});   // لا يوجد items/gone1
  await setDoc(doc(d, 'claimProofs/gone1_bob_0'), {claimId: 'gone1_bob', officeId: O, uid: 'bob', data: IMG, createdAt: now});
  await setDoc(doc(d, 'claimQuota/bob'), {open: ['gone1_bob']});
  await setDoc(doc(d, 'claims/gone2_carol'), {...claim('gone2', 'carol'), status: 'approved', pickupBy: now + DAY});
});
await t('H13a: إغلاق طلب يتيم (غرضه محذوف) «منتهياً» مع صورته وحصته في batch واحد', batch(A, (b, r) => {
  b.update(r('claims/gone1_bob'), {status: 'expired', note: 'الغرض لم يعد متاحاً', decidedAt: now, decidedBy: 'staffA', proofs: 0});
  b.delete(r('claimProofs/gone1_bob_0'));
  b.set(r('claimQuota/bob'), {open: arrayRemove('gone1_bob')}, {merge: true});
  b.set(r('logs/' + lid()), {...logDoc('staffA', 'expire', {itemId: 'gone1', claimId: 'gone1_bob'}), at: Date.now()}); }));
await t('H13a: إغلاق طلب مقبول غرضه محذوف «منتهياً»', updateDoc(doc(A, 'claims/gone2_carol'), {status: 'expired', note: 'الغرض لم يعد متاحاً', decidedAt: now, decidedBy: 'staffA'}));
await t('H13a: قبول طلب غرضه محذوف مرفوض', batch(A, (b, r) => {
  b.update(r('claims/gone1_bob'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now}); }), false);
// الإغلاق من الخادم: الموظف يستعلم عن طلبات غرض بالمكتب والغرض والحالة (openClaimsFor)
await t('H13a: الموظف يستعلم عن الطلبات المفتوحة على غرض في مكتبه', q(A, 'claims', ['officeId', '==', O], ['itemId', '==', 'gone2'], ['status', 'in', ['pending', 'approved']]));
await t('H13a: الزائر لا يستعلم عن طلبات غرض', q(alice, 'claims', ['officeId', '==', O], ['itemId', '==', 'gone2'], ['status', 'in', ['pending', 'approved']]), false);

// ── v11 (H16): النقود لا تُعرض للزائر بأي شكل (قراءة مباشرة، أو استعلام، أو عدّ) ──
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  await setDoc(doc(d, 'items/h1'), pub('h1', 'cash')); await setDoc(doc(d, 'itemSecrets/h1'), {...sec, details: {amount: '350'}});
  await setDoc(doc(d, 'items/h2'), pub('h2'));                                                // عادي (public: true)
  const {public: _p, ...noFlag} = pub('h3', 'cash');
  await setDoc(doc(d, 'items/h3'), noFlag);                                                    // نقود قديمة بلا الحقل
  await setDoc(doc(d, 'items/h4'), (({public: _x, ...r}) => r)(pub('h4')));                     // عادي قديم بلا الحقل
  await setDoc(doc(d, 'items/h5'), {...pub('h5', 'cash'), status: 'reserved', reservedFor: 'g_eve_cash_1'});  // نقود محجوزة لطلب مجمّع
  await setDoc(doc(d, 'claims/g_eve_cash_1'), {...claim('h5', 'eve'), grouped: true, cat: 'cash', status: 'approved'});
  await setDoc(doc(d, 'claims/h1_frank'), claim('h1', 'frank'));                                 // طلب مباشر قديم على نقود
  await setDoc(doc(d, 'offices/other'), {name: 'مطار', active: true, createdAt: 1});
  await setDoc(doc(d, 'staff/staffX'), {offices: ['other']});
});
const eve = as('eve'), frank = as('frank'), X = as('staffX'), owner2 = as('owner');
const VIS = [['officeId', '==', O], ['status', 'in', ['available', 'reserved']]];
await t('v11: زائر غير مسجّل لا يقرأ غرض نقود بمعرّفه', getDoc(doc(anon, 'items/h1')), false);
await t('v11: زائر مسجّل لا يقرأ غرض نقود بمعرّفه', getDoc(doc(carol, 'items/h1')), false);
await t('v11: نقود قديمة بلا public لا يقرؤها الزائر', getDoc(doc(anon, 'items/h3')), false);
await t('v11: غرض عادي قديم بلا public يقرؤه الزائر', getDoc(doc(anon, 'items/h4')));
await t('v11: غرض عادي يقرؤه الزائر', getDoc(doc(anon, 'items/h2')));
await t('v11: موظف مكتب آخر لا يقرأ نقود هذا المكتب', getDoc(doc(X, 'items/h1')), false);
await t('v11: موظف المكتب يقرأ غرض النقود', getDoc(doc(A, 'items/h1')));
await t('v11: الإدارة تقرأ غرض النقود', getDoc(doc(owner2, 'items/h1')));
await t('v11: صاحب طلب مباشر قديم على النقود يقرؤها', getDoc(doc(frank, 'items/h1')));
await t('v11: صاحب طلب مجمّع حُجزت له النقود يقرؤها', getDoc(doc(eve, 'items/h5')));
await t('v11: استعلام الزائر بلا public == true مرفوض', q(anon, 'items', ...VIS), false);
await t('v11: استعلام الزائر بـ public == true مسموح', q(anon, 'items', ...VIS, ['public', '==', true]));
let visIds = [];
try { visIds = (await getDocs(query(collection(anon, 'items'), ...[...VIS, ['public', '==', true]].map(w => where(...w))))).docs.map(x => x.data().cat); } catch {}
await t('v11: استعلام الزائر العام لا يعيد أي نقود', Promise.resolve().then(() => { if (!visIds.length || visIds.includes('cash')) throw new Error(JSON.stringify(visIds)); }));
await t('v11: عدّ الزائر للمُسلَّم بـ public == true مسموح', getCountFromServer(query(collection(anon, 'items'), where('officeId', '==', O), where('status', '==', 'returned'), where('public', '==', true))));
await t('v11: عدّ الزائر بلا public مرفوض', getCountFromServer(query(collection(anon, 'items'), where('officeId', '==', O), where('status', '==', 'returned'))), false);
let staffCats = [];
try { staffCats = (await getDocs(query(collection(A, 'items'), ...VIS.map(w => where(...w))))).docs.map(x => x.data().cat); } catch {}
await t('v11: استعلام الموظف لمكتبه يعيد النقود', Promise.resolve().then(() => { if (!staffCats.includes('cash')) throw new Error(JSON.stringify(staffCats)); }));
// الكتابة: public يطابق التصنيف دائماً
await t('v11: إنشاء نقود بـ public: true مرفوض', setDoc(doc(A, 'items/h6'), {...pub('h6', 'cash'), public: true}), false);
await t('v11: إنشاء غرض بلا public مرفوض', setDoc(doc(A, 'items/h6'), (({public: _x, ...r}) => r)(pub('h6'))), false);
await t('v11: إنشاء نقود بـ public: false', setDoc(doc(A, 'items/h6'), pub('h6', 'cash')));
await t('v11: إنشاء غرض عادي بـ public: true', setDoc(doc(A, 'items/h7'), pub('h7')));
await t('v11: جعل النقود عامة مرفوض', updateDoc(doc(A, 'items/h6'), {public: true, updatedAt: now}), false);
await t('v11: تغيير التصنيف إلى نقود دون public: false مرفوض', upItem(A, 'h7', {cat: 'cash', updatedAt: now}), false);
await t('v11: الترحيل: إضافة public: true لغرض عادي قديم', updateDoc(doc(A, 'items/h4'), {public: true}));
await t('v11: نقود قديمة: تعديل دون public: false مرفوض', updateDoc(doc(A, 'items/h3'), {sub: 'عملات', updatedAt: now}), false);
await t('v11: الترحيل: إضافة public: false للنقود القديمة', updateDoc(doc(A, 'items/h3'), {public: false}));
await t('v11: لا صورة عامة لغرض نقود', setDoc(doc(A, 'itemPhotos/h1'), {data: IMG}), false);

// ── v12 (H17): قبول بلاغ النقود مباشرة: غرض نقود جديد (createdFrom) ← ربط ← قبول بقيد واحد direct ──
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'claimQuota/gina'), {open: []}); });
const gina = as('gina'); const GC = 'g_gina_cash_' + now;
await t('v12: بلاغ نقود (طلب مجمّع) من صاحبه', mk(gina, 'claims/' + GC, {...claim('', 'gina'), grouped: true, cat: 'cash', details: {amount: '500', holder: 'envelope'}}));
await t('v12: createdFrom ليس نصاً مرفوض', setDoc(doc(A, 'items/cd0'), {...pub('cd0', 'cash'), createdFrom: 5}), false);
await t('v12: الموظف ينشئ غرض نقود من البلاغ (createdFrom)', setDoc(doc(A, 'items/cd1'), {...pub('cd1', 'cash'), createdFrom: GC}));
await t('v12: ثم التفاصيل السرية (المبلغ من البلاغ)', setDoc(doc(A, 'itemSecrets/cd1'), {officeId: O, title: 'مبلغ 500 ريال', color: '', brand: '', desc: '', spot: '', bldg: '', room: '', storage: '', details: {amount: '500', holder: 'envelope'}}));
await t('v12: الزائر لا يقرأ الغرض المنشأ', getDoc(doc(anon, 'items/cd1')), false);
await t('v12: مستخدم آخر لا يقرأ الغرض المنشأ', getDoc(doc(carol, 'items/cd1')), false);
await t('v12: الربط بالطلب', batch(A, (b, r) => b.set(r('claimLinks/' + GC), {officeId: O, itemId: 'cd1', by: 'staffA', at: Date.now()})));
await t('v12: قيد direct بقيمة غير true مرفوض', setDoc(doc(A, 'logs/' + lid()), {...logDoc('staffA', 'approveCash', {itemId: 'cd1', claimId: GC}), at: Date.now(), direct: 'yes'}), false);
await t('v12: القبول بموظف واحد + الحجز + قيد واحد direct: true', batch(A, (b, r) => {
  b.update(r('claims/' + GC), {status: 'approved', itemId: 'cd1', decidedAt: now, decidedBy: 'staffA', pickupBy: now + 7 * DAY});
  b.update(r('items/cd1'), {status: 'reserved', reservedFor: GC, updatedAt: now, public: false});
  b.set(r('logs/' + lid()), {...logDoc('staffA', 'approveCash', {itemId: 'cd1', claimId: GC}), at: Date.now(), direct: true}); }));
await t('v12: صاحب البلاغ يقرأ الغرض بعد القبول (محجوز له)', getDoc(doc(gina, 'items/cd1')));
await t('v12: الزائر ما زال لا يقرؤه', getDoc(doc(anon, 'items/cd1')), false);
await t('v12: التسليم بالرمز ← «سُلّم»', batch(A, (b, r) => {
  b.update(r('claims/' + GC), {status: 'done', doneAt: now, doneBy: 'staffA', handoverNote: 'جينا — 1234', handoverCode: CODE});
  b.update(r('items/cd1'), {status: 'returned', returnedAt: now, updatedAt: now, public: false}); }));
await t('v12: عدّ الزائر للمُسلَّم العام لا يشمل النقود', getCountFromServer(query(collection(anon, 'items'), where('officeId', '==', O), where('status', '==', 'returned'), where('public', '==', true))));

// ── v13 (H18) ──
// 2) حرية المالك: يقرر في طلبه هو (القبول، الربط)، ومديرٌ غيره أو موظف لا
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  await setDoc(doc(d, 'admins/adm2'), {role: 'admin'});
  for (const k of ['o1', 'o2', 'o3']){ await setDoc(doc(d, 'items/' + k), pub(k)); await setDoc(doc(d, 'itemSecrets/' + k), sec); }
  await setDoc(doc(d, 'items/o4'), pub('o4', 'cash'));
  for (const u of ['owner', 'adm2', 'staffA']) await setDoc(doc(d, 'claimQuota/' + u), {open: []});
});
const adm2 = as('adm2'), own = as('owner');
await t('v13: المالك يرسل طلباً على غرض', mk(own, 'claims/o1_owner', claim('o1', 'owner')));
await t('v13: المالك يقبل طلبه هو (مع قيد self: true)', batch(own, (b, r) => {
  b.update(r('claims/o1_owner'), {status: 'approved', decidedAt: now, decidedBy: 'owner', pickupBy: now + DAY});
  b.update(r('items/o1'), {status: 'reserved', reservedFor: 'o1_owner', updatedAt: now});
  b.set(r('logs/' + lid()), {...logDoc('owner', 'approve', {itemId: 'o1', claimId: 'o1_owner'}), at: Date.now(), self: true}); }));
await t('v13: self بقيمة غير true مرفوض', setDoc(doc(own, 'logs/' + lid()), {...logDoc('owner', 'ask', {itemId: 'o1', claimId: 'o1_owner'}), at: Date.now(), self: 'x'}), false);
await t('v13: مدير (غير المالك) يرسل طلباً', mk(adm2, 'claims/o2_adm2', claim('o2', 'adm2')));
await t('v13: المدير لا يقبل طلبه هو', batch(adm2, (b, r) => {
  b.update(r('claims/o2_adm2'), {status: 'approved', decidedAt: now, decidedBy: 'adm2', pickupBy: now + DAY});
  b.update(r('items/o2'), {status: 'reserved', reservedFor: 'o2_adm2', updatedAt: now}); }), false);
await t('v13: الموظف يرسل طلباً', mk(A, 'claims/o3_staffA', claim('o3', 'staffA')));
await t('v13: الموظف لا يقبل طلبه هو', batch(A, (b, r) => {
  b.update(r('claims/o3_staffA'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now + DAY});
  b.update(r('items/o3'), {status: 'reserved', reservedFor: 'o3_staffA', updatedAt: now}); }), false);
const OG = 'g_owner_cash_' + (now + 1);
await t('v13: المالك يرسل بلاغ نقود (مجمّع)', mk(own, 'claims/' + OG, {...claim('', 'owner'), grouped: true, cat: 'cash', createdAt: now + 1}));
await t('v13: المالك يربط طلبه المجمّع بغرض', setDoc(doc(own, 'claimLinks/' + OG), {officeId: O, itemId: 'o4', by: 'owner', at: Date.now()}));
// 3) لا تاريخ في المستقبل (غد+2 مرفوض، واليوم مقبول، وتعديل حقل آخر في وثيقة قديمة بتاريخ مستقبلي مقبول)
const dayStr = n => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
await t('v13: بلاغ بتاريخ فقد بعد غد+1 (غد+2) مرفوض', mk(alice, 'reports/f1', {officeId: O, uid: 'alice', cat: 'bags', title: 'حقيبة', status: 'open', lostDate: dayStr(3), createdAt: now}), false);
await t('v13: بلاغ بتاريخ اليوم مقبول', mk(alice, 'reports/f2', {officeId: O, uid: 'alice', cat: 'bags', title: 'حقيبة', status: 'open', lostDate: dayStr(0), createdAt: now}));
await t('v13: طلب بتاريخ فقد غد+2 مرفوض', mk(carol, 'claims/i9_carol', claim('i9', 'carol', {lostDate: dayStr(3)})), false);
await t('v13: طلب بتاريخ اليوم مقبول', mk(carol, 'claims/i9_carol', claim('i9', 'carol', {lostDate: dayStr(0)})));
await t('v13: غرض بتاريخ عثور غد+2 مرفوض', setDoc(doc(A, 'items/fd1'), {...pub('fd1'), foundDate: dayStr(3)}), false);
await t('v13: غرض بتاريخ عثور اليوم مقبول', setDoc(doc(A, 'items/fd1'), {...pub('fd1'), foundDate: dayStr(0)}));
await t('v13: تغيير تاريخ العثور إلى غد+2 مرفوض', updateDoc(doc(A, 'items/fd1'), {foundDate: dayStr(3), updatedAt: now}), false);
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  await setDoc(doc(d, 'reports/fold'), {officeId: O, uid: 'alice', cat: 'bags', title: 'حقيبة قديمة', status: 'open', lostDate: dayStr(10), createdAt: now});
  await setDoc(doc(d, 'items/fold'), {...pub('fold'), foundDate: dayStr(10)}); });
await t('v13: وثيقة قديمة بتاريخ مستقبلي: تعديل حقل آخر في البلاغ مقبول', updateDoc(doc(alice, 'reports/fold'), {title: 'حقيبة زرقاء', editedAt: Date.now()}));
await t('v13: وثيقة قديمة بتاريخ مستقبلي: تعديل حقل آخر في الغرض مقبول', updateDoc(doc(A, 'items/fold'), {sub: 'حقيبة ظهر', updatedAt: now}));
// 4) البريد الخاص: users/{uid}/private/profile لصاحبه والإدارة فقط
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  await setDoc(doc(d, 'users/alice/private/profile'), {email: 'alice@x.com'});
  await setDoc(doc(d, 'users/olduser'), {name: 'قديم', email: 'old@x.com', lastSeen: 1}); });
await t('v13: الموظف لا يقرأ بريد مستخدم', getDoc(doc(A, 'users/alice/private/profile')), false);
await t('v13: مستخدم آخر لا يقرأ البريد', getDoc(doc(bob, 'users/alice/private/profile')), false);
await t('v13: الإدارة تقرأ البريد', getDoc(doc(owner, 'users/alice/private/profile')));
await t('v13: المستخدم يقرأ بريده', getDoc(doc(alice, 'users/alice/private/profile')));
await t('v13: الموظف ما زال يقرأ الاسم (users العامة)', getDoc(doc(A, 'users/alice')));
await t('v13: الترحيل الذاتي: البريد إلى private وحذفه من العامة في batch واحد', batch(alice, (b, r) => {
  b.set(r('users/alice/private/profile'), {email: 'alice@x.com'}); b.set(r('users/alice'), {name: 'A', email: deleteField(), lastSeen: now}, {merge: true}); }));
await t('v13: الإدارة لا تنقل بريداً غير الموجود', batch(owner, (b, r) => {
  b.set(r('users/olduser/private/profile'), {email: 'evil@x.com'}); b.update(r('users/olduser'), {email: deleteField()}); }), false);
await t('v13: الإدارة لا تغيّر غير البريد في الوثيقة العامة', updateDoc(doc(owner, 'users/olduser'), {email: deleteField(), name: 'x'}), false);
await t('v13: ترحيل الإدارة: البريد نفسه إلى private وحذفه من العامة', batch(owner, (b, r) => {
  b.set(r('users/olduser/private/profile'), {email: 'old@x.com'}); b.update(r('users/olduser'), {email: deleteField()}); }));
await t('v13: الموظف لا يكتب بريد غيره', setDoc(doc(A, 'users/alice/private/profile'), {email: 'staff@x.com'}), false);

// ── v14 (H19): إغلاق ثغرات الحيازة — اختبار مسموح/مرفوض لكل بند ──
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  await setDoc(doc(d, 'items/x1'), pub('x1'));                                                  // عادي جديد
  await setDoc(doc(d, 'items/x2'), {...pub('x2'), createdAt: now - 3 * DAY});                    // سُجّل قبل 3 أيام
  await setDoc(doc(d, 'itemSecrets/x2'), {...sec, color: 'black', storage: 'الخزانة 1', desc: ''});
  await setDoc(doc(d, 'itemPhotosPrivate/x2'), {officeId: O, data: IMG});
  await setDoc(doc(d, 'items/x3'), pub('x3')); await setDoc(doc(d, 'itemSecrets/x3'), sec);       // سُجّل الآن
  await setDoc(doc(d, 'items/x4'), (({keepUntil, ...r}) => r)(pub('x4')));                         // قديم بلا keepUntil
  await setDoc(doc(d, 'admins/adm3'), {role: 'admin'});
});
// 1) «مثال» ثابت، ولا أمثلة بعد إيقافها
await t('v14-1: تحويل غرض عادي إلى مثال مرفوض', upItem(A, 'x1', {sample: true}), false);
await t('v14-1: إنشاء مثال (قبل الإيقاف) مسموح', setDoc(doc(A, 'items/s1'), {...pub('s1'), sample: true}));
await t('v14-1: الموظف لا يكتب samplesOff', updateDoc(doc(A, 'config/app'), {samplesOff: true}), false);
await t('v14-1: المدير يوقف الأمثلة (samplesOff)', updateDoc(doc(owner, 'config/app'), {samplesOff: true}));
await t('v14-1: إنشاء مثال بعد الإيقاف مرفوض', setDoc(doc(A, 'items/s2'), {...pub('s2'), sample: true}), false);
await t('v14-1: إنشاء غرض عادي بعد الإيقاف مسموح', setDoc(doc(A, 'items/s3'), pub('s3')));
// 2) الإنشاء «متاحاً» بوقت الآن، ووقت الإنشاء ثابت
await t('v14-2: إنشاء غرض «محجوز» مرفوض', setDoc(doc(A, 'items/s4'), {...pub('s4'), status: 'reserved'}), false);
await t('v14-2: إنشاء غرض فيه reservedFor مرفوض', setDoc(doc(A, 'items/s4'), {...pub('s4'), reservedFor: 'x'}), false);
await t('v14-2: إنشاء بوقت قديم مرفوض', setDoc(doc(A, 'items/s4'), {...pub('s4'), createdAt: now - 5 * DAY}), false);
await t('v14-2: إنشاء فيه lastLog مرفوض', setDoc(doc(A, 'items/s4'), {...pub('s4'), lastLog: 'x'}), false);
await t('v14-2: تغيير وقت الإنشاء مرفوض', upItem(A, 'x1', {createdAt: now - DAY}), false);
// 3) تخفيض التصنيف (اختبارات v14 أعلى) + الرفع إلى ثمين مسموح للموظف
await t('v14-3: الموظف يرفع التصنيف إلى ثمين', upItem(A, 'x1', {cat: 'phones', updatedAt: now}));
await t('v14-3: الموظف لا يعيده إلى غير ثمين', upItem(A, 'x1', {cat: 'bags', updatedAt: now}), false);
// 4) مدة الحفظ
await t('v14-4: إنشاء بلا keepUntil مرفوض', setDoc(doc(A, 'items/s5'), (({keepUntil, ...r}) => r)(pub('s5'))), false);
await t('v14-4: إنشاء بمدة حفظ أقصر من المسموح مرفوض', setDoc(doc(A, 'items/s5'), {...pub('s5'), keepUntil: Date.parse('2026-09-25')}), false);
await t('v14-4: الموظف يضيف مدة حفظ صحيحة لغرض قديم (الترحيل)', upItem(A, 'x4', {keepUntil: Date.parse('2026-09-20') + 90 * DAY}));
await t('v14-4: ثم لا يغيّرها', upItem(A, 'x4', {keepUntil: Date.parse('2026-09-20') + 100 * DAY}), false);
await t('v14-4: الأرشفة قبل انتهاء المدة مرفوضة للموظف', upItem(A, 'x3', {status: 'archived', updatedAt: now}), false);
await t('v14-4: المدير يؤرشف قبل انتهاء المدة', upItem(owner, 'x3', {status: 'archived', updatedAt: now}));
// 5) السجل الإلزامي
await t('v14-5: تغيير الحالة بلا قيد مرفوض', upItem(owner, 'x3', {status: 'available', updatedAt: now}, {noLog: true}), false);
await t('v14-5: lastLog لقيد غير موجود مرفوض', upItem(owner, 'x3', {status: 'available', updatedAt: now, lastLog: 'nope'}, {noLog: true}), false);
await t('v14-5: lastLog لقيد غرض آخر مرفوض', batch(owner, (b, r) => {
  b.set(r('logs/wrong1'), {...logDoc('owner', 'x', {itemId: 'x1'}), at: Date.now()});
  b.update(r('items/x3'), {status: 'available', updatedAt: now, lastLog: 'wrong1'}); }, {noLog: true}), false);
await t('v14-5: lastLog لقيد كتبه شخص آخر مرفوض', batch(owner, (b, r) => {
  b.set(r('logs/wrong2'), {...logDoc('staffA', 'x', {itemId: 'x3'}), at: Date.now()});
  b.update(r('items/x3'), {status: 'available', updatedAt: now, lastLog: 'wrong2'}); }, {noLog: true}), false);
await t('v14-5: تغيير الحالة مع قيد جديد مسموح', upItem(owner, 'x3', {status: 'available', updatedAt: now}));
await t('v14-5: إعادة استخدام قيد قديم مرفوضة', batch(owner, (b, r) => b.update(r('items/x3'), {status: 'archived', updatedAt: now, lastLog: 'wrong1'}), {noLog: true}), false);
await t('v14-5: تغيير lastLog وحده بلا قيد جديد مرفوض', upItem(A, 'x3', {lastLog: 'wrong2', updatedAt: now}, {noLog: true}), false);
await t('v14-5: حذف غرض بلا قيد del_ مرفوض', delItem(owner, 's3', {noLog: true}), false);
await t('v14-5: حذف غرض مع قيد del_ مسموح', delItem(owner, 's3'));
// 6) طلب مباشر على تصنيف مجمّع (اختبارات v14 أعلى) + المباشر على حقيبة مسموح
await t('v14-6: طلب مباشر على غرض عادي مسموح', mk(bob, 'claims/s1_bob', claim('s1', 'bob')));
// 7) أدلة التفاصيل السرية: 24 ساعة للموظف
await t('v14-7: الموظف لا يغيّر اللون بعد 24 ساعة', updateDoc(doc(A, 'itemSecrets/x2'), {color: 'red'}), false);
await t('v14-7: الموظف لا يغيّر المكان بعد 24 ساعة', updateDoc(doc(A, 'itemSecrets/x2'), {spot: 'الكافتيريا'}), false);
await t('v14-7: الموظف يغيّر موضع الحفظ بعد 24 ساعة', updateDoc(doc(A, 'itemSecrets/x2'), {storage: 'الخزانة 2'}));
await t('v14-7 → v16 (H22): الموظف لا يملأ وصفاً كان فارغاً بعد 24 ساعة', updateDoc(doc(A, 'itemSecrets/x2'), {desc: 'غلاف أحمر'}), false);
await t('v14-7: المدير يغيّر اللون بعد 24 ساعة', updateDoc(doc(owner, 'itemSecrets/x2'), {color: 'red'}));
await t('v14-7: الموظف يغيّر اللون خلال 24 ساعة', updateDoc(doc(A, 'itemSecrets/x3'), {color: 'blue'}));
await t('v14-7: الموظف لا يحذف الصورة الأصلية لغرض قديم', deleteDoc(doc(A, 'itemPhotosPrivate/x2')), false);
await t('v14-7: المدير يحذف الصورة الأصلية', deleteDoc(doc(owner, 'itemPhotosPrivate/x2')));
// 8) إعادة إنشاء الطلب نفسه بعد حذفه: بصمة رمز جديدة
await t('v14-8: طلب على x1', mk(alice, 'claims/x1_alice', claim('x1', 'alice')));
await t('v14-8: صاحبه يحذفه قبل السؤال', deleteDoc(doc(alice, 'claims/x1_alice')));
await setRate('alice', Date.now() - 60000); await setQuota('alice', {open: []});
await t('v14-8: ويعيد إرساله برمز جديد (claimCodes تُعاد كتابتها)', batch(alice, (b, r) => {
  b.set(r('claims/x1_alice'), claim('x1', 'alice')); b.set(r('rate/alice'), RATE());
  b.set(r('claimQuota/alice'), {open: arrayUnion('x1_alice'), lastByCat: {phones: serverTimestamp()}}, {merge: true});
  b.set(r('claimCodes/x1_alice'), {uid: 'alice', hash: H('x1_alice', 'NEWCODE1')}); }));
await t('v14-8: لا تُعاد كتابة البصمة والطلب موجود', setDoc(doc(alice, 'claimCodes/x1_alice'), {uid: 'alice', hash: H('x1_alice', 'X')}), false);
await t('v14-8: مستخدم آخر لا يكتب بصمة طلب غيره', setDoc(doc(bob, 'claimCodes/x1_alice'), {uid: 'bob', hash: H('x1_alice', 'X')}), false);
// 9) لا خروج من «مكتمل»، ولا إعادة تفعيل لطلب ألغاه صاحبه
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  await setDoc(doc(d, 'claims/x2_done'), {...claim('x2', 'carol'), status: 'done', doneAt: now});
  await setDoc(doc(d, 'claims/x2_canc'), {...claim('x2', 'dave'), status: 'cancelled', cancelledAt: now});
  await setDoc(doc(d, 'claims/x2_exp'), {...claim('x2', 'eve'), status: 'expired', decidedAt: now}); });
await t('v14-9: إعادة «مكتمل» إلى قيد المراجعة مرفوضة', updateDoc(doc(A, 'claims/x2_done'), {status: 'pending', decidedAt: now, decidedBy: 'staffA'}), false);
await t('v14-9: إعادة تفعيل طلب ألغاه صاحبه مرفوضة', updateDoc(doc(A, 'claims/x2_canc'), {status: 'pending', decidedAt: now, decidedBy: 'staffA'}), false);
await t('v14-9: إعادة تفعيل طلب منتهٍ (بلا cancelledAt) مسموحة', updateDoc(doc(A, 'claims/x2_exp'), {status: 'pending', decidedAt: now, decidedBy: 'staffA'}));
// 11) المديرون: للمالك فقط
await t('v14-11: مدير لا يضيف مديراً', setDoc(doc(adm2, 'admins/newadm'), {role: 'admin'}), false);
await t('v14-11: مدير لا يحذف مديراً', deleteDoc(doc(adm2, 'admins/adm3')), false);
await t('v14-11: المالك يضيف مديراً', setDoc(doc(owner, 'admins/newadm'), {role: 'admin'}));
await t('v14-11: المالك يحذف مديراً', deleteDoc(doc(owner, 'admins/adm3')));
// 12) حدود الحجم
await t('v14-12: صورة البلاغ نص طويل مرفوضة', mk(alice, 'reports/big1', {officeId: O, uid: 'alice', cat: 'bags', title: 'حقيبة', status: 'open', createdAt: now, photo: 'x'.repeat(500)}), false);
await t('v14-12: صورة البلاغ true مسموحة', mk(alice, 'reports/big2', {officeId: O, uid: 'alice', cat: 'bags', title: 'حقيبة', status: 'open', createdAt: now, photo: true}));
await t('v14-12: staffPick أطول من 100 مرفوض', updateDoc(doc(A, 'reports/big2'), {staffPick: 'x'.repeat(101), pickedAt: now}), false);
await t('v14-12: staffPick عادي مسموح', updateDoc(doc(A, 'reports/big2'), {staffPick: 'x1', pickedAt: now}));

// ── v15 (H20): فحص شامل ──
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  for (const k of ['z1', 'z2', 'z3', 'z4', 'z9', 'zq']){ await setDoc(doc(d, 'items/' + k), pub(k)); await setDoc(doc(d, 'itemSecrets/' + k), sec); }
  await setDoc(doc(d, 'claims/z2_alice'), claim('z2', 'alice'));
  // z3: محجوز لطلب ما زال «قيد المراجعة» (بيانات غير متسقة)، وبصمة رمزه صحيحة
  await setDoc(doc(d, 'items/z3'), {...pub('z3'), status: 'reserved', reservedFor: 'z3_alice'});
  await setDoc(doc(d, 'claims/z3_alice'), claim('z3', 'alice'));
  await setDoc(doc(d, 'claimCodes/z3_alice'), {uid: 'alice', hash: H('z3_alice')});
  // z4: محجوز لطلب مرفوض، وطلب آخر قيد المراجعة
  await setDoc(doc(d, 'items/z4'), {...pub('z4'), status: 'reserved', reservedFor: 'z4_bob'});
  await setDoc(doc(d, 'claims/z4_bob'), {...claim('z4', 'bob'), status: 'rejected', decidedAt: now});
  await setDoc(doc(d, 'claims/z4_alice'), claim('z4', 'alice'));
  // z5 عمره 3 أيام، وz6 عمره ساعة، ولكلٍّ صورة أصلية
  await setDoc(doc(d, 'items/z5'), {...pub('z5'), createdAt: now - 3 * 864e5}); await setDoc(doc(d, 'itemPhotosPrivate/z5'), {officeId: O, data: IMG});
  await setDoc(doc(d, 'items/z6'), {...pub('z6'), createdAt: now - 3600e3}); await setDoc(doc(d, 'itemPhotosPrivate/z6'), {officeId: O, data: IMG});
  await setDoc(doc(d, 'claims/zq_alice'), claim('zq', 'alice', {proofs: 1}));   // عدد الصور 1 (لولا v15 لقُبلت صورته)
  await setDoc(doc(d, 'staff/staffM'), {offices: [O, 'dom']});
});
const M = as('staffM');
// 1) حالة غير معروفة
await t('v15-1: حالة «lost» مرفوضة', upItem(A, 'z1', {status: 'lost', updatedAt: now}), false);
await t('v15-1: حالة معروفة (أرشفة المدير) مسموحة', upItem(owner, 'z1', {status: 'archived', updatedAt: now}));
// 2) reservedFor على غرض متاح
await t('v15-2: reservedFor على غرض متاح (بلا حجز) مرفوض', upItem(A, 'z2', {reservedFor: 'z2_alice', updatedAt: now}), false);
await t('v15-2: الحجز بقبول الطلب في العملية نفسها مسموح', approveB(A, 'z2', 'z2_alice', 'staffA'));
// 3) التسليم من «مقبول» فقط
await t('v15-3: تسليم طلب قيد المراجعة بالرمز الصحيح مرفوض', doneB(B, 'z3', 'z3_alice', CODE), false);
await env.withSecurityRulesDisabled(async c => { await updateDoc(doc(c.firestore(), 'claims/z3_alice'), {status: 'approved', decidedAt: now}); });
await t('v15-3: تسليم الطلب نفسه بعد قبوله مسموح', doneB(B, 'z3', 'z3_alice', CODE));
// 4) نقل الحجز
await t('v15-4: نقل حجز غرض (طلبه مرفوض) إلى طلب قيد المراجعة مرفوض', upItem(A, 'z4', {reservedFor: 'z4_alice', updatedAt: now}), false);
await t('v15-4: فكّ الحجز إلى «متاح» مسموح', upItem(A, 'z4', {status: 'available', reservedFor: deleteField(), updatedAt: now}));
// 5) استبدال الصورة الأصلية
await t('v15-5: الموظف لا يستبدل صورة غرض عمره 3 أيام', setDoc(doc(A, 'itemPhotosPrivate/z5'), {officeId: O, data: IMG + 'B'}), false);
await t('v15-5: المدير يستبدلها', setDoc(doc(owner, 'itemPhotosPrivate/z5'), {officeId: O, data: IMG + 'B'}));
await t('v15-5: الموظف يستبدل صورة غرض عمره ساعة', setDoc(doc(A, 'itemPhotosPrivate/z6'), {officeId: O, data: IMG + 'B'}));
// 6) حقول الأصل ثابتة
await t('v15-6: تغيير createdBy مرفوض', upItem(A, 'z9', {createdBy: 'staffB'}), false);
await t('v15-6: تغيير ref مرفوض', upItem(A, 'z9', {ref: 'TCA-HACK'}), false);
await t('v15-6: إضافة fromFound لاحقاً مرفوضة', upItem(A, 'z9', {fromFound: 'f1'}), false);
await t('v15-6: تعديل النوع (sub) مسموح', upItem(A, 'z9', {sub: 'حقيبة ظهر', updatedAt: now}));
// 7) من سجّله = من يكتب
await t('v15-7: إنشاء غرض باسم موظف آخر مرفوض', setDoc(doc(B, 'items/z7'), pub('z7')), false);
await t('v15-7: إنشاء غرض باسمه مسموح', setDoc(doc(B, 'items/z7'), {...pub('z7'), createdBy: 'staffB'}));
// 8) decidedBy/askedBy باسم من يكتب
await t('v15-8: سؤال باسم موظف آخر مرفوض', updateDoc(doc(A, 'claims/zq_alice'), {question: 'ما لون الغلاف؟', askedAt: now, askedBy: 'staffB'}), false);
await t('v15-8: سؤال باسمه مسموح', updateDoc(doc(A, 'claims/zq_alice'), {question: 'ما لون الغلاف؟', askedAt: now, askedBy: 'staffA'}));
await t('v15-8: رفض باسم موظف آخر مرفوض', updateDoc(doc(A, 'claims/zq_alice'), {status: 'rejected', decidedAt: now, decidedBy: 'staffB', note: 'لا يطابق'}), false);
await t('v15-8: رفض باسمه مسموح', updateDoc(doc(A, 'claims/zq_alice'), {status: 'rejected', decidedAt: now, decidedBy: 'staffA', note: 'لا يطابق'}));
// 9) قيد السجل في مكتب الغرض نفسه (موظف في مكتبين)
await t('v15-9: تغيير التصنيف بقيد في مكتب آخر (dom) مرفوض', batch(M, (b, r) => {
  b.set(r('logs/m15a'), {...logDoc('staffM', 'edit', {itemId: 'z9'}), officeId: 'dom'}); b.update(r('items/z9'), {cat: 'glasses', lastLog: 'm15a', updatedAt: now}); }, {noLog: true}), false);
await t('v15-9: وبقيد في مكتب الغرض مسموح', batch(M, (b, r) => {
  b.set(r('logs/m15b'), logDoc('staffM', 'edit', {itemId: 'z9'})); b.update(r('items/z9'), {cat: 'glasses', lastLog: 'm15b', updatedAt: now}); }, {noLog: true}));
// 10) صور الإثبات مع إنشاء الطلب فقط
await t('v15-10: صورة إثبات لطلب موجود مرفوضة', setDoc(doc(alice, 'claimProofs/zq_alice_0'), {claimId: 'zq_alice', officeId: O, uid: 'alice', data: IMG, createdAt: now}), false);
await setQuota('carol', {open: []}); await setRate('carol', Date.now() - 60000);
await t('v15-10: صورة إثبات مع إنشاء الطلب في batch واحد مسموحة', batch(carol, (b, r) => {
  b.set(r('claims/z6_carol'), claim('z6', 'carol', {proofs: 1})); b.set(r('rate/carol'), RATE());
  b.set(r('claimQuota/carol'), {open: arrayUnion('z6_carol'), lastByCat: {bags: serverTimestamp()}}, {merge: true});
  b.set(r('claimProofs/z6_carol_0'), {claimId: 'z6_carol', officeId: O, uid: 'carol', data: IMG, createdAt: now});
  b.set(r('claimCodes/z6_carol'), {uid: 'carol', hash: H('z6_carol')}); }));

// ── v16 (H22): حد يومي للإنشاء، وملء الأدلة، وحدود config وprivate وpublicStats ──
const setRateDoc = (uid, d) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'rate/' + uid), d); });
const fr = id => ({officeId: O, uid: 'dave2', cat: 'keys', status: 'pending', createdAt: Date.now()});
const dave2 = as('dave2');
const W = Date.now() - 3600e3;   // نافذة بدأت قبل ساعة
await setRateDoc('dave2', {at: Timestamp.fromMillis(Date.now() - 60000), n: 30, w: Timestamp.fromMillis(W)});
await t('v16-1: الإنشاء الحادي والثلاثون في النافذة مرفوض', batch(dave2, (b, r) => { b.set(r('foundReports/c31'), fr()); b.set(r('rate/dave2'), {at: serverTimestamp(), n: 31, w: Timestamp.fromMillis(W)}); }), false);
await t('v16-1: تصفير العداد داخل النافذة مرفوض', batch(dave2, (b, r) => { b.set(r('foundReports/c32'), fr()); b.set(r('rate/dave2'), RATE()); }), false);
await t('v16-1: كتابة rate مباشرة لتصفيره مرفوضة', setDoc(doc(dave2, 'rate/dave2'), {at: serverTimestamp(), n: 1, w: serverTimestamp()}), false);
await t('v16-1: حذف rate داخل النافذة مرفوض', deleteDoc(doc(dave2, 'rate/dave2')), false);
await setRateDoc('dave2', {at: Timestamp.fromMillis(Date.now() - 60000), n: 5, w: Timestamp.fromMillis(W)});
await t('v16-1: داخل النافذة وتحت الحد: n + 1 مسموح', batch(dave2, (b, r) => { b.set(r('foundReports/c33'), fr()); b.set(r('rate/dave2'), {at: serverTimestamp(), n: 6, w: Timestamp.fromMillis(W)}); }));
await setRateDoc('dave2', {at: Timestamp.fromMillis(Date.now() - 60000), n: 5, w: Timestamp.fromMillis(W)});
await t('v16-1: n غير متتالٍ مرفوض', batch(dave2, (b, r) => { b.set(r('foundReports/c34'), fr()); b.set(r('rate/dave2'), {at: serverTimestamp(), n: 5, w: Timestamp.fromMillis(W)}); }), false);
await setRateDoc('dave2', {at: Timestamp.fromMillis(Date.now() - 60000), n: 30, w: Timestamp.fromMillis(Date.now() - 25 * 3600e3)});
await t('v16-1: بعد انتهاء النافذة تبدأ نافذة جديدة (n = 1)', batch(dave2, (b, r) => { b.set(r('foundReports/c35'), fr()); b.set(r('rate/dave2'), RATE()); }));
await setRateDoc('dave2', {at: Timestamp.fromMillis(Date.now() - 60000), n: 30, w: Timestamp.fromMillis(Date.now() - 25 * 3600e3)});
await t('v16-1: حذف rate بعد انتهاء النافذة مسموح', deleteDoc(doc(dave2, 'rate/dave2')));
await env.withSecurityRulesDisabled(async c => { const d = c.firestore();
  await setDoc(doc(d, 'items/ev1'), {...pub('ev1'), createdAt: Date.now() - 3 * DAY});
  await setDoc(doc(d, 'itemSecrets/ev1'), {officeId: O, title: 'حقيبة', color: '', brand: '', desc: '', spot: '', bldg: '', room: '', storage: ''}); });
await t('v16-2: الموظف لا يملأ الماركة الفارغة بعد 24 ساعة', updateDoc(doc(A, 'itemSecrets/ev1'), {brand: 'نايكي'}), false);
await t('v16-2: ولا الإجابات الفارغة', updateDoc(doc(A, 'itemSecrets/ev1'), {details: {mark: 'ملصق'}}), false);
await t('v16-2: مكان العثور الفارغ يُملأ (نقل المكان القديم)', updateDoc(doc(A, 'itemSecrets/ev1'), {spot: 'المكتبة'}));
await t('v16-2: ولا يتغير بعد ملئه', updateDoc(doc(A, 'itemSecrets/ev1'), {spot: 'المواقف'}), false);
await t('v16-2: موضع الحفظ يتغير', updateDoc(doc(A, 'itemSecrets/ev1'), {storage: 'الخزانة 3'}));
await t('v16-2: المدير يملأ الماركة', updateDoc(doc(owner, 'itemSecrets/ev1'), {brand: 'نايكي'}));
await t('v16-3: وثيقة private باسم آخر مرفوضة', setDoc(doc(alice, 'users/alice/private/notes'), {x: 1}), false);
await t('v16-3: codes بمفتاح غريب مرفوضة', setDoc(doc(alice, 'users/alice/private/codes'), {codes: {a: 'X'}, other: 1}), false);
await t('v16-3: codes خريطة رموز مسموحة', setDoc(doc(alice, 'users/alice/private/codes'), {codes: {a_alice: 'ABCD2345'}}, {merge: true}));
await t('v16-4: المدير لا يضيف حقلاً غريباً إلى config/app', updateDoc(doc(owner, 'config/app'), {banner: '<b>x</b>'}), false);
await t('v16-4: samplesOff غير منطقي مرفوض', updateDoc(doc(owner, 'config/app'), {samplesOff: 'yes'}), false);
await t('v16-5: المُعاد أكثر من المُسجَّل مرفوض', setDoc(doc(A, 'publicStats/' + O), {...ps, updatedAt: Date.now(), totalReturned: 500}), false);
await t('v16-5: رضا فوق 5 مرفوض', setDoc(doc(A, 'publicStats/' + O), {...ps, updatedAt: Date.now(), avgRating: 9}), false);
await t('v16-5: رقم سالب مرفوض', setDoc(doc(A, 'publicStats/' + O), {...ps, updatedAt: Date.now(), monthReceived: -3}), false);
await t('v16-5: وقت تحديث قديم مرفوض', setDoc(doc(A, 'publicStats/' + O), {...ps, updatedAt: Date.now() - 3 * DAY}), false);
await t('v16-5: أرقام منطقية بوقت الآن مسموحة', setDoc(doc(A, 'publicStats/' + O), {...ps, updatedAt: Date.now()}));

console.log(R.join('\n')); const N = R.filter(x => !x.startsWith('ℹ')).length; console.log(fails ? `فشل ${fails} من ${N}` : `نجحت كل الاختبارات (${N})`);
await env.cleanup(); process.exit(fails ? 1 : 0);
