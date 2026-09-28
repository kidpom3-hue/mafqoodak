// اختبارات قواعد Firestore على المحاكي (للمطوّر فقط؛ لا يحمّلها التطبيق)
// التشغيل: cd tools && npm install && npm run test:rules   (يحتاج Java)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, collection, query, where, deleteField } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({projectId: 'demo-mafqoodak',
  firestore: {rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085}});
const now = Date.now(), O = 'tc';
// مكان العثور (spot) سري منذ المرحلة E5: في itemSecrets لا في items
const pub = x => ({officeId: O, ref: 'TCA-' + x, cat: 'phones', sub: 'جوال', title: 'جوال', foundDate: '2026-09-20', photo: false, status: 'available', createdBy: 'staffA', createdAt: now, updatedAt: now, sample: false});
const sec = {officeId: O, title: 'جوال أسود', color: 'black', brand: '', desc: 'غلاف أحمر', spot: 'المكتبة', bldg: '', room: '', storage: 'الخزانة 1'};
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  await setDoc(doc(d, 'config/app'), {ownerUid: 'owner'});
  await setDoc(doc(d, 'admins/owner'), {role: 'owner'});
  for (const s of ['staffA', 'staffB']) await setDoc(doc(d, 'staff/' + s), {offices: [O]});
  for (const k of ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i10', 'i11']){ await setDoc(doc(d, 'items/' + k), pub(k)); await setDoc(doc(d, 'itemSecrets/' + k), sec); }
  // أغراض قديمة (قبل المرحلة E5): المكان ما زال في المستند العام. L2 بلا itemSecrets، وL1 فيه fromFound
  const {spot, ...oldSec} = sec;
  await setDoc(doc(d, 'items/L1'), {...pub('L1'), spot: 'المكتبة', fromFound: 'f9'}); await setDoc(doc(d, 'itemSecrets/L1'), oldSec);
  await setDoc(doc(d, 'items/L2'), {...pub('L2'), spot: 'الكافتيريا'});
  await setDoc(doc(d, 'items/L3'), {...pub('L3'), spot: 'المواقف'}); await setDoc(doc(d, 'itemSecrets/L3'), oldSec);
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
// القبول يحجز الغرض في الـ batch نفسه (المرحلة D: القواعد تشترط ذلك)
await t('موظف آخر يقبل طلبه (مع حجز الغرض)', batch(B, (b, r) => {
  b.update(r('claims/i2_staffA'), {status: 'approved', decidedAt: now, decidedBy: 'staffB', pickupBy: now});
  b.update(r('items/i2'), {status: 'reserved', reservedFor: 'i2_staffA', updatedAt: now});
}));

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
await t('C: إشعار ثانٍ', setDoc(doc(bob, 'foundReports/f3'), {officeId: O, uid: 'bob', cat: 'phones', sub: 'جوال', spot: 'المكتبة', bldg: '', room: '', foundDate: '2026-09-26', note: '', status: 'pending', createdAt: now}));
await t('C: استلام الإشعار + سجل الإنشاء (batch)', batch(A, (b, r) => {
  b.update(r('foundReports/f3'), {status: 'received', receivedAt: now, receivedBy: 'staffA', itemId: 'i5'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'create', {itemId: 'i5'}));
}));
await t('C: إشعار ثالث', setDoc(doc(bob, 'foundReports/f4'), {officeId: O, uid: 'bob', cat: 'bags', sub: '', spot: '', bldg: '', room: '', foundDate: '2026-09-26', note: '', status: 'pending', createdAt: now}));
await t('C: «لم يصل» (إشعار + سجل)', batch(A, (b, r) => {
  b.update(r('foundReports/f4'), {status: 'cancelled'});
  b.set(r('logs/' + lid()), logDoc('staffA', 'found:drop'));
}));
await t('C: إشعار رابع', setDoc(doc(bob, 'foundReports/f5'), {officeId: O, uid: 'bob', cat: 'keys', sub: '', spot: '', bldg: '', room: '', foundDate: '2026-09-26', note: '', status: 'pending', createdAt: now}));
await t('C: الواجد يلغي إشعاره المعلّق', updateDoc(doc(bob, 'foundReports/f5'), {status: 'cancelled', cancelledAt: now}));
await t('C: الواجد يحذف الملغى', deleteDoc(doc(bob, 'foundReports/f5')));
await t('C: الواجد لا يحذف المستلَم', deleteDoc(doc(bob, 'foundReports/f3')), false);
await t('C: «حذف حسابي» يمسح بيانات المستلَم', updateDoc(doc(bob, 'foundReports/f3'), {uid: 'deleted', note: ''}));
await t('C: سجل حيازة غرض للموظف (استعلام)', q(A, 'logs', ['officeId', '==', O], ['itemId', '==', 'i6']));
await t('C: الزائر لا يستعلم عن السجل', q(alice, 'logs', ['officeId', '==', O], ['itemId', '==', 'i6']), false);
await t('C: الموظف يقرأ التفاصيل السرية لمكتبه (تصدير CSV)', q(A, 'itemSecrets', ['officeId', '==', O]));
await t('C: الزائر لا يقرأ التفاصيل السرية', q(alice, 'itemSecrets', ['officeId', '==', O]), false);
await t('C: الموظف يقرأ بريد صاحب الطلب (EmailJS)', getDoc(doc(A, 'users/alice')));
await t('C: رفض طلب i6 بعد الإجابة', updateDoc(doc(B, 'claims/i6_alice'), {status: 'rejected', note: 'لا يطابق', decidedAt: now, decidedBy: 'staffB'}));
await t('C: «حذف حسابي» يمسح الإجابة مع بيانات الطلب المنتهي', updateDoc(doc(alice, 'claims/i6_alice'), {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', answer: '', anonymizedAt: now}));

// ── المرحلة D4: حراسة سلسلة الحيازة على الخادم ──
const approveB = (db, item, cid, by) => batch(db, (b, r) => {
  b.update(r('claims/' + cid), {status: 'approved', decidedAt: now, decidedBy: by, pickupBy: now + 7 * 864e5});
  b.update(r('items/' + item), {status: 'reserved', reservedFor: cid, updatedAt: now});
  b.set(r('logs/' + lid()), logDoc(by, 'approve', {itemId: item, claimId: cid}));
});
await t('D: طلب بالاسم وآخر 4 أرقام', setDoc(doc(alice, 'claims/i7_alice'), claim('i7', 'alice', {claimantName: 'أليس محمد', idLast4: '1234'})));
await t('D: آخر 4 أرقام غير صحيحة مرفوضة', setDoc(doc(carol, 'claims/i7_carol'), claim('i7', 'carol', {idLast4: '12a4'})), false);
await t('D: طلب منافس', setDoc(doc(bob, 'claims/i7_bob'), claim('i7', 'bob')));
await t('D: القبول الأول (batch)', approveB(A, 'i7', 'i7_alice', 'staffA'));
await t('D: قبولان متتاليان من batchين: الثاني يُرفض', approveB(B, 'i7', 'i7_bob', 'staffB'), false);
await t('D: قبول دون حجز الغرض مرفوض', updateDoc(doc(B, 'claims/i7_bob'), {status: 'approved', decidedAt: now, decidedBy: 'staffB'}), false);
await t('D: طلب على i8', setDoc(doc(carol, 'claims/i8_carol'), claim('i8', 'carol')));
await t('D: «محجوز» دون طلب مقبول مرفوض', updateDoc(doc(A, 'items/i8'), {status: 'reserved', reservedFor: 'i8_carol', updatedAt: now}), false);
await t('D: «محجوز» لطلب غير موجود مرفوض', updateDoc(doc(A, 'items/i8'), {status: 'reserved', reservedFor: 'ghost', updatedAt: now}), false);
await t('D: «سُلّم» دون طلب مكتمل ودون handoverNote مرفوض', updateDoc(doc(A, 'items/i8'), {status: 'returned', returnedAt: now, updatedAt: now}), false);
await t('D: «مكتمل» دون حجز الغرض له مرفوض', batch(A, (b, r) => {
  b.update(r('claims/i8_carol'), {status: 'done', doneAt: now, doneBy: 'staffA'});
  b.update(r('items/i8'), {status: 'returned', returnedAt: now, updatedAt: now});
}), false);
await t('D: التسليم بالرمز (done + returned + handoverNote في الطلب) مقبول', batch(B, (b, r) => {
  b.update(r('claims/i7_alice'), {status: 'done', doneAt: now, doneBy: 'staffB', handoverNote: 'استلمه: أليس محمد — آخر 4: 1234'});
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
await t('D: طلب على i9', setDoc(doc(bob, 'claims/i9_bob'), claim('i9', 'bob')));
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
await t('D: طلب على i10 المحجوز', setDoc(doc(carol, 'claims/i10_carol'), claim('i10', 'carol')));
await t('D: قبول مباشر على «محجوز» يتيم مرفوض', approveB(A, 'i10', 'i10_carol', 'staffA'), false);
await t('D: إتاحة الغرض أولاً', batch(A, (b, r) => { b.update(r('items/i10'), {status: 'available', reservedFor: '', updatedAt: now}); b.set(r('logs/' + lid()), logDoc('staffA', 'status:available', {itemId: 'i10'})); }));
await t('D: ثم القبول', approveB(A, 'i10', 'i10_carol', 'staffA'));
// إشعار التسليم بكود
await t('D: إشعار تسليم بكود', setDoc(doc(bob, 'foundReports/f6'), {officeId: O, uid: 'bob', cat: 'cash', sub: '', spot: '', bldg: '', room: '', foundDate: '2026-09-26', note: '', code: 'K7M3TX', status: 'pending', createdAt: now}));
await t('D: الموظف يبحث بالكود (استعلام)', q(A, 'foundReports', ['officeId', '==', O], ['status', '==', 'pending']));
// إدارة الموظفين والسجل
const owner = as('owner');
await t('D: المالك يمنح إدارة لموظف', setDoc(doc(owner, 'admins/staffA'), {role: 'admin', addedAt: now, addedBy: 'owner'}));
await t('D: قيد صلاحية في السجل (itemId فارغ)', setDoc(doc(owner, 'logs/' + lid()), logDoc('owner', 'perm:admin', {note: 'staffA'})));
await t('D: المالك يزيل الإدارة', deleteDoc(doc(owner, 'admins/staffA')));
await t('D: لا يمكن إزالة المالك', deleteDoc(doc(owner, 'admins/owner')), false);
await t('D: سجل العمليات للمالك (officeId + action in)', q(owner, 'logs', ['officeId', '==', O], ['action', 'in', ['status:returned', 'delete', 'dispose', 'perm:grant', 'perm:revoke', 'perm:admin', 'perm:unadmin']]));
await t('D: المالك يقرأ بريد صاحب طلب الصلاحية', getDoc(doc(owner, 'users/alice')));

// ── المرحلة E: إجابات أسئلة التصنيف (details)، وإغلاق البلاغ ──
await t('E: itemSecrets مع details: {amount: "300"}', updateDoc(doc(A, 'itemSecrets/i11'), {details: {amount: '300', holder: 'envelope'}}));
await t('E: details بمفتاح غير معروف مرفوض', updateDoc(doc(A, 'itemSecrets/i11'), {details: {foo: 'x'}}), false);
await t('E: details مجموع أطوالها فوق 1200 مرفوض', updateDoc(doc(A, 'itemSecrets/i11'), {details: {denoms: 'x'.repeat(700), inside: 'y'.repeat(700)}}), false);
await t('E: details في items مرفوض', updateDoc(doc(A, 'items/i11'), {details: {amount: '300'}}), false);
// قيمة رقمية لا نصية: النتيجة تُسجَّل فقط (التطبيق يحفظ نصوصاً دائماً)
let numeric = 'قُبلت';
try { await assertFails(updateDoc(doc(A, 'itemSecrets/i11'), {details: {amount: 300}})); numeric = 'رُفضت'; } catch { numeric = 'قُبلت'; }
R.push('ℹ E: قيمة رقمية {amount: 300} في details: ' + numeric);
await t('E: طلب استلام مع details صحيح', setDoc(doc(carol, 'claims/i11_carol'), claim('i11', 'carol', {claimantName: 'كارول', idLast4: '5555', details: {amount: '300', holder: 'envelope'}})));
await t('E: طلب استلام بمفتاح details غير معروف مرفوض', setDoc(doc(bob, 'claims/i11_bob'), claim('i11', 'bob', {details: {secret: 'x'}})), false);
await t('E: رفض طلب i11', updateDoc(doc(A, 'claims/i11_carol'), {status: 'rejected', note: 'x', decidedAt: now, decidedBy: 'staffA'}));
await t('E: «حذف حسابي» مع details: {}', updateDoc(doc(carol, 'claims/i11_carol'), {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', claimantName: '', idLast4: '', details: {}, anonymizedAt: now}));
// البلاغ: «ليس غرضي» وسبب الإغلاق
const rep = (x = {}) => ({officeId: O, uid: 'alice', cat: 'cash', title: 'نقود', status: 'open', createdAt: now, ...x});
await t('E: بلاغ مع details', setDoc(doc(alice, 'reports/rE'), rep({details: {amount: '300'}})));
await t('E: إنشاء بلاغ فيه closedReason مرفوض', setDoc(doc(alice, 'reports/rE2'), rep({closedReason: 'self'})), false);
await t('E: إنشاء بلاغ فيه pickRejected مرفوض', setDoc(doc(alice, 'reports/rE3'), rep({pickRejected: 'i11'})), false);
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
await t('E5: تغيير حالة غرض قديم دون نقل مكانه مرفوض', updateDoc(doc(A, 'items/L1'), {status: 'archived', updatedAt: now}), false);
await t('E5: batch النقل (itemSecrets merge + deleteField) مقبول', batch(A, (b, r) => {
  b.set(r('itemSecrets/L1'), {officeId: O, spot: 'المكتبة'}, {merge: true});
  b.update(r('items/L1'), {spot: deleteField()});
}));
await t('E5: بعد النقل يبقى fromFound ويُقرأ المكان من itemSecrets', getDoc(doc(A, 'items/L1')).then(s => { if (s.data().fromFound !== 'f9' || 'spot' in s.data()) throw new Error('bad'); return getDoc(doc(A, 'itemSecrets/L1')); }).then(s => { if (s.data().spot !== 'المكتبة' || s.data().storage !== 'الخزانة 1') throw new Error('bad secret'); }));
await t('E5: تغيير حالة غرض قديم بلا itemSecrets مع نقل مكانه في الـ batch نفسه', batch(A, (b, r) => {
  b.set(r('itemSecrets/L2'), {officeId: O, spot: 'الكافتيريا'}, {merge: true});
  b.update(r('items/L2'), {status: 'archived', reservedFor: '', updatedAt: now, spot: deleteField()});
  b.set(r('logs/' + lid()), logDoc('staffA', 'status:archived', {itemId: 'L2'}));
}));
await t('E5: تسليم مباشر لغرض قديم (itemSecrets كاملاً مع spot وhandoverNote)', batch(A, (b, r) => {
  b.set(r('itemSecrets/L3'), {...sec, spot: 'المواقف', handoverNote: 'علي — آخر 4 أرقام: 1234'});
  b.update(r('items/L3'), {status: 'returned', returnedAt: now, updatedAt: now, reservedFor: '', spot: deleteField()});
}));
await t('E5: الموظف يجلب مكان أغراض مكتبه للإحصاءات (itemSecrets officeId ==)', q(A, 'itemSecrets', ['officeId', '==', O]));

// ── المرحلة F: رقم الطلب، والتقييم، ومؤشرات المكتب ──
await t('F: طلب فيه رقم قصير no', setDoc(doc(carol, 'claims/n1_carol'), claim('n1', 'carol', {no: 'REQ-7K3M'})));
await t('F: رقم طلب أطول من 16 مرفوض', setDoc(doc(bob, 'claims/n1_bob'), claim('n1', 'bob', {no: 'x'.repeat(17)})), false);
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
await t('G: إنشاء بلاغ فيه rejected مرفوض', setDoc(doc(alice, 'reports/rG0'), rep({rejected: ['i1']})), false);
await t('G: إنشاء بلاغ', setDoc(doc(alice, 'reports/rG'), rep()));
await t('G: إضافة إلى rejected', updateDoc(doc(alice, 'reports/rG'), {rejected: ['i1', 'i2']}));
await t('G: الحذف من rejected مرفوض', updateDoc(doc(alice, 'reports/rG'), {rejected: ['i1']}), false);
await t('G: أكثر من 30 في rejected مرفوض', updateDoc(doc(alice, 'reports/rG'), {rejected: ['i1', 'i2', ...Array.from({length: 29}, (_, k) => 'x' + k)]}), false);
await t('G: تعديل البلاغ مع editedAt', updateDoc(doc(alice, 'reports/rG'), {title: 'محفظة نقود', desc: 'بنية', editedAt: now}));
await t('G: editedAt نصي مرفوض', updateDoc(doc(alice, 'reports/rG'), {editedAt: 'now'}), false);
await t('G: غير صاحب البلاغ لا يضيف إلى rejected', updateDoc(doc(bob, 'reports/rG'), {rejected: ['i1', 'i2', 'i3']}), false);
await t('G: طلب استلام g1', setDoc(doc(alice, 'claims/g1_alice'), claim('g1', 'alice', {claimantName: 'أليس', idLast4: '1234'})));
await t('G: تعديل طلب قيد المراجعة بلا سؤال', updateDoc(doc(alice, 'claims/g1_alice'), {proof: 'غلاف أزرق', lostSpot: 'الممر', idLast4: '4321', details: {amount: '200'}, editedAt: now}));
await t('G: editedAt نصي في الطلب مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {proof: 'x', editedAt: 'now'}), false);
await t('G: صاحب الطلب يغيّر الحالة مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {status: 'approved', editedAt: now}), false);
await t('G: idLast4 = abcd مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {idLast4: 'abcd', editedAt: now}), false);
await t('G: مفتاح details غير معروف مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {details: {secret: 'x'}, editedAt: now}), false);
await t('G: غير صاحب الطلب لا يعدّله', updateDoc(doc(bob, 'claims/g1_alice'), {proof: 'x', editedAt: now}), false);
await t('G: الموظف يسأل', updateDoc(doc(A, 'claims/g1_alice'), {question: 'ما لون الغلاف من الداخل؟', askedAt: now, askedBy: 'staffA'}));
await t('G: التعديل بعد السؤال مرفوض', updateDoc(doc(alice, 'claims/g1_alice'), {proof: 'y', editedAt: now}), false);
await t('G: طلب استلام g2', setDoc(doc(bob, 'claims/g2_bob'), claim('g2', 'bob')));
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
await t('lang = en مسموح', setDoc(doc(alice, 'users/alice'), {name: 'A', email: 'a@x.com', photo: '', lastSeen: now, lang: 'en'}));
await t('lang غير معروفة مرفوضة', setDoc(doc(alice, 'users/alice'), {name: 'A', lang: 'fr'}), false);
await t('الزائر غير المسجّل يقرأ المفقودات العامة', getDoc(doc(anon, 'items/i2')));

console.log(R.join('\n')); const N = R.filter(x => !x.startsWith('ℹ')).length; console.log(fails ? `فشل ${fails} من ${N}` : `نجحت كل الاختبارات (${N})`);
await env.cleanup(); process.exit(fails ? 1 : 0);
