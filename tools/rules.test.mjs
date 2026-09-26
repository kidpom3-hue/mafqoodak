// اختبارات قواعد Firestore على المحاكي (للمطوّر فقط؛ لا يحمّلها التطبيق)
// التشغيل: cd tools && npm install && npm run test:rules   (يحتاج Java)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({projectId: 'demo-mafqoodak',
  firestore: {rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085}});
const now = Date.now(), O = 'tc';
const pub = x => ({officeId: O, ref: 'TCA-' + x, cat: 'phones', sub: 'جوال', title: 'جوال', spot: 'المكتبة', foundDate: '2026-09-20', photo: false, status: 'available', createdBy: 'staffA', createdAt: now, updatedAt: now, sample: false});
const sec = {officeId: O, title: 'جوال أسود', color: 'black', brand: '', desc: 'غلاف أحمر', bldg: '', room: '', storage: 'الخزانة 1'};
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  await setDoc(doc(d, 'config/app'), {ownerUid: 'owner'});
  await setDoc(doc(d, 'admins/owner'), {role: 'owner'});
  for (const s of ['staffA', 'staffB']) await setDoc(doc(d, 'staff/' + s), {offices: [O]});
  for (const k of ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']){ await setDoc(doc(d, 'items/' + k), pub(k)); await setDoc(doc(d, 'itemSecrets/' + k), sec); }
});
// الحساب الموثّق وغير الموثّق
const as = (uid, verified = true) => env.authenticatedContext(uid, {email_verified: verified}).firestore();
const alice = as('alice'), bob = as('bob'), carol = as('carol'), dave = as('dave', false), A = as('staffA'), B = as('staffB'), anon = env.unauthenticatedContext().firestore();
const R = []; let fails = 0;
async function t(name, p, ok = true){ try { await (ok ? assertSucceeds(p) : assertFails(p)); R.push('✔ ' + name); } catch (e){ fails++; R.push('✘ ' + name + ' — ' + String(e.message || e).slice(0, 160)); } }
const claim = (item, uid, extra = {}) => ({itemId: item, officeId: O, uid, proof: 'غلاف أحمر وخلفية قطة', color: 'black', brand: '', lostSpot: 'المكتبة', bldg: '', room: '', lostDate: '2026-09-19', status: 'pending', codeHash: 'a'.repeat(64), createdAt: now, ...extra});
const logDoc = (by, action, x = {}) => ({officeId: O, itemId: x.itemId || '', claimId: x.claimId || '', reportId: '', action, by, at: now, note: x.note || ''});
const batch = (db, fn) => { const b = writeBatch(db); fn(b, p => doc(db, p)); return b.commit(); };
let L = 0; const lid = () => 'log' + (++L);

// ── 9) توثيق البريد ──
await t('غير موثّق لا يرسل طلب استلام', setDoc(doc(dave, 'claims/i1_dave'), claim('i1', 'dave')), false);
await t('غير موثّق لا يسجّل بلاغاً', setDoc(doc(dave, 'reports/r1'), {officeId: O, uid: 'dave', cat: 'phones', title: 'جوال', status: 'open', createdAt: now}), false);
await t('موثّق يرسل طلب استلام (مع reportId)', setDoc(doc(alice, 'claims/i1_alice'), claim('i1', 'alice', {reportId: 'r9'})));
await t('موثّق يسجّل بلاغاً', setDoc(doc(alice, 'reports/r1'), {officeId: O, uid: 'alice', cat: 'phones', title: 'جوال', status: 'open', createdAt: now, renewedAt: now}));

// ── 1-3) القبول ضمن batch، ثم طلب منافس على المحجوز ──
await t('قبول الطلب: الطلب + الغرض + السجل في batch واحد', batch(A, (b, r) => {
  b.update(r('claims/i1_alice'), {status: 'approved', decidedAt: now, decidedBy: 'staffA', pickupBy: now + 7 * 864e5});
  b.update(r('items/i1'), {status: 'reserved', reservedFor: 'i1_alice', updatedAt: now});
  b.set(r('logs/' + lid()), logDoc('staffA', 'approve', {itemId: 'i1', claimId: 'i1_alice'}));
}));
await t('10) طلب منافس على غرض محجوز يُقبل إرساله', setDoc(doc(bob, 'claims/i1_bob'), claim('i1', 'bob')));
await t('حالة طلب غير معروفة مرفوضة', updateDoc(doc(A, 'claims/i1_bob'), {status: 'hacked'}), false);

// ── 8) فصل المهام ──
await t('موظف يرسل طلباً على غرض', setDoc(doc(A, 'claims/i2_staffA'), claim('i2', 'staffA')));
await t('8) الموظف لا يقبل طلبه هو', updateDoc(doc(A, 'claims/i2_staffA'), {status: 'approved', decidedAt: now, decidedBy: 'staffA'}), false);
await t('موظف آخر يقبل طلبه', updateDoc(doc(B, 'claims/i2_staffA'), {status: 'approved', decidedAt: now, decidedBy: 'staffB', pickupBy: now}));

// ── 3) التسليم: الطلب المحجوز له + إغلاق المنافس + السجل ──
await t('التسليم في batch: done + returned + رفض المنافس + سجل', batch(B, (b, r) => {
  b.update(r('claims/i1_alice'), {status: 'done', doneAt: now, doneBy: 'staffB'});
  b.update(r('items/i1'), {status: 'returned', returnedAt: now, updatedAt: now});
  b.update(r('claims/i1_bob'), {status: 'rejected', note: 'سُلّم الغرض لصاحبه بعد التحقق', decidedAt: now, decidedBy: 'staffB'});
  b.set(r('logs/' + lid()), logDoc('staffB', 'handover', {itemId: 'i1', claimId: 'i1_alice'}));
}));
await t('لا طلب جديد على غرض مُسلَّم', setDoc(doc(carol, 'claims/i1_carol'), claim('i1', 'carol')), false);

// ── 6) انتهاء مهلة الاستلام ──
await t('إنهاء الحجز: expired + available + سجل', batch(B, (b, r) => {
  b.update(r('claims/i2_staffA'), {status: 'expired', note: 'انتهت مهلة الاستلام', decidedAt: now, decidedBy: 'staffB'});
  b.update(r('items/i2'), {status: 'available', reservedFor: '', updatedAt: now});
  b.set(r('logs/' + lid()), logDoc('staffB', 'release', {itemId: 'i2', claimId: 'i2_staffA'}));
}));

// ── 4) تسليم مباشر مع طلب معلّق ──
await t('طلب معلّق على i3', setDoc(doc(carol, 'claims/i3_carol'), claim('i3', 'carol')));
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
await t('7) التصرّف: disposed + disposalNote + سجل', batch(A, (b, r) => {
  b.update(r('items/i4'), {status: 'disposed', disposal: 'donated', disposedAt: now, reservedFor: '', updatedAt: now});
  b.set(r('itemSecrets/i4'), {...sec, disposalNote: 'جمعية البر'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'dispose', {itemId: 'i4'}));
}));
await t('disposalNote السري مرفوض في items', updateDoc(doc(A, 'items/i4'), {storage: 'x'}), false);

// ── 5) حذف غرض عليه طلب ──
await t('طلب على i5', setDoc(doc(bob, 'claims/i5_bob'), claim('i5', 'bob')));
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
await t('طلب على i6', setDoc(doc(alice, 'claims/i6_alice'), claim('i6', 'alice')));
await t('الموظف يطرح سؤالاً', updateDoc(doc(A, 'claims/i6_alice'), {question: 'ما خلفية الشاشة؟', askedAt: now, askedBy: 'staffA'}));
await t('صاحب الطلب يجيب', updateDoc(doc(alice, 'claims/i6_alice'), {answer: 'صورة قطة', answeredAt: now}));
await t('صاحب الطلب لا يغيّر حالة طلبه', updateDoc(doc(alice, 'claims/i6_alice'), {status: 'approved'}), false);

// ── إشعار التسليم foundReports (للجزء C) ──
await t('إشعار تسليم من حساب موثّق', setDoc(doc(bob, 'foundReports/f1'), {officeId: O, uid: 'bob', cat: 'keys', sub: '', spot: 'المواقف', bldg: '', room: '', foundDate: '2026-09-25', note: 'مفتاح', status: 'pending', createdAt: now}));
await t('إشعار تسليم من غير موثّق مرفوض', setDoc(doc(dave, 'foundReports/f2'), {officeId: O, uid: 'dave', status: 'pending', createdAt: now}), false);
await t('الموظف يؤكد الاستلام', updateDoc(doc(A, 'foundReports/f1'), {status: 'received', receivedAt: now, receivedBy: 'staffA', itemId: 'i6'}));

// ── لغة المستخدم (للجزء B) ──
await t('lang = en مسموح', setDoc(doc(alice, 'users/alice'), {name: 'A', email: 'a@x.com', photo: '', lastSeen: now, lang: 'en'}));
await t('lang غير معروفة مرفوضة', setDoc(doc(alice, 'users/alice'), {name: 'A', lang: 'fr'}), false);
await t('الزائر غير المسجّل يقرأ المفقودات العامة', getDoc(doc(anon, 'items/i2')));

console.log(R.join('\n')); console.log(fails ? `فشل ${fails} من ${R.length}` : `نجحت كل الاختبارات (${R.length})`);
await env.cleanup(); process.exit(fails ? 1 : 0);
