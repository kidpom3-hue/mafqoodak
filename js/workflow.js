// انتقالات حالة المفقودات وطلبات الاستلام في مكان واحد.
// كل انتقال يُكتب في writeBatch واحد (الغرض + الطلبات + قيد في السجل logs)،
// فإما ينجح كله أو لا يُكتب منه شيء، حتى لا تبقى البيانات ناقصة إذا انقطع الاتصال.
import { dbx } from './firebase.js';
import { S, full } from './state.js';
import { pubPhoto } from './views/common.js';
import { t, tAr } from './i18n.js';
// ملاحظات النظام تُخزَّن بالعربية (قيم في قاعدة البيانات) عبر tAr، وتُترجم عند العرض بـ noteText

// خطأ برسالة عربية تُعرض للموظف كما هي
export class FlowError extends Error { constructor(msg){ super(msg); this.msg = msg; } }
const fail = msg => { throw new FlowError(msg); };

export const OPEN = ['pending', 'approved'];   // الطلبات المفتوحة على الغرض
export const pickupDays = o => Math.max(1, Math.min(60, Number(o?.pickupDays) || 7));
// الطلبات المفتوحة على الغرض (من اشتراك الموظف في طلبات مكتبه)
export const openClaimsOf = itemId => S.claims.filter(c => c.itemId === itemId && OPEN.includes(c.status));

// قيد في سجل العمليات (سلسلة الحيازة). القيود تُحفظ مع كل batch لتُضاف للسجل المعروض بعد نجاحه
const PENDING_LOGS = new WeakMap();
function log(b, officeId, action, x = {}){
  const id = dbx.newId('logs');
  const e = {officeId, itemId: x.itemId || '', claimId: x.claimId || '', reportId: x.reportId || '',
    action, by: S.uid, at: Date.now(), note: String(x.note || '').slice(0, 600)};
  b.set(dbx.ref('logs/' + id), e);
  PENDING_LOGS.set(b, [...(PENDING_LOGS.get(b) || []), {id, ...e}]);
}
// تنفيذ الـbatch، ثم إضافة قيوده إلى سجل الحيازة المعروض (إن كان محمّلاً) دون قراءة جديدة
async function commit(b){
  await b.commit();
  for (const e of PENDING_LOGS.get(b) || []) if (Array.isArray(S.logs[e.itemId])) S.logs[e.itemId] = [...S.logs[e.itemId], e];
}
// التفاصيل السرية كما هي في itemSecrets (دون حقل id الذي يضيفه الاشتراك)
function secretOf(i){ const {id, ...s} = S.secrets[i.id] || {}; return {...s, officeId: i.officeId}; }

// الغرض بأحدث نسخة: من الاشتراك، أو من الخادم إن لم يكن محمّلاً (مثل المُسلَّم)
async function freshItem(id){
  const i = S.items.find(x => x.id === id) || await dbx.get('items/' + id).then(d => d && {id, ...d}).catch(() => null);
  if (!i) fail(t('wf.gone'));
  return i;
}
const notMine = c => { if (c.uid === S.uid) fail(t('wf.own')); };
// إنهاء بقية الطلبات المفتوحة على الغرض. طلب الموظف نفسه يُستثنى لأن القواعد تمنعه من تعديله.
function closeOthers(b, itemId, exceptId, status, note){
  let skippedOwn = false;
  for (const o of openClaimsOf(itemId)){
    if (o.id === exceptId) continue;
    if (o.uid === S.uid){ skippedOwn = true; continue; }
    b.update(dbx.ref('claims/' + o.id), {status, note, decidedAt: Date.now(), decidedBy: S.uid});
  }
  return skippedOwn;
}

/* قبول طلب: الغرض متاح، أو محجوز دون طلب مقبول فعلي */
export async function approveClaim(c){
  notMine(c);
  if (c.status !== 'pending') fail(t('wf.notPending'));
  const i = await freshItem(c.itemId);
  const holder = i.status === 'reserved' && S.claims.find(x => x.id === i.reservedFor && x.status === 'approved');
  if (!(i.status === 'available' || (i.status === 'reserved' && !holder))) fail(t('wf.notAvailable'));
  const o = S.offices.find(x => x.id === i.officeId);
  const pickupBy = Date.now() + pickupDays(o) * 864e5;
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'approved', decidedAt: Date.now(), decidedBy: S.uid, pickupBy});
  b.update(dbx.ref('items/' + i.id), {status: 'reserved', reservedFor: c.id, updatedAt: Date.now()});
  log(b, i.officeId, 'approve', {itemId: i.id, claimId: c.id});
  await commit(b);
}

/* رفض طلب: إن كان مقبولاً والغرض محجوزاً له يعود الغرض متاحاً */
export async function rejectClaim(c, note){
  notMine(c);
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'rejected', note: String(note || '').slice(0, 200), decidedAt: Date.now(), decidedBy: S.uid});
  const i = S.items.find(x => x.id === c.itemId);
  if (c.status === 'approved' && i?.reservedFor === c.id) b.update(dbx.ref('items/' + i.id), {status: 'available', reservedFor: '', updatedAt: Date.now()});
  log(b, c.officeId, 'reject', {itemId: c.itemId, claimId: c.id, note});
  await commit(b);
}

/* سؤال تحقق: يسأل الموظف صاحب طلب قيد المراجعة سؤالاً إضافياً، فيجيب من «طلباتي».
   السؤال الجديد يحلّ محل السابق، والإجابة الأقدم من السؤال تُعدّ غير مُجابة (answeredAt < askedAt) */
export async function askQuestion(c, q){
  notMine(c);
  if (c.status !== 'pending') fail(t('wf.notPending'));
  const question = String(q || '').trim().slice(0, 300);
  if (question.length < 5) fail(t('wf.needQuestion'));
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {question, askedAt: Date.now(), askedBy: S.uid});
  log(b, c.officeId, 'ask', {itemId: c.itemId, claimId: c.id, note: question});
  await commit(b);
}

/* التسليم بعد التحقق من الرمز: فقط للطلب المقبول الذي حُجز له الغرض */
export async function verifyHandover(c){
  notMine(c);
  const i = await freshItem(c.itemId);
  if (c.status !== 'approved' || i.status !== 'reserved' || i.reservedFor !== c.id) fail(t('wf.notReserved'));
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'done', doneAt: Date.now(), doneBy: S.uid});
  b.update(dbx.ref('items/' + i.id), {status: 'returned', returnedAt: Date.now(), updatedAt: Date.now()});
  const skippedOwn = closeOthers(b, i.id, c.id, 'rejected', tAr('sys.handedVerified'));
  log(b, i.officeId, 'handover', {itemId: i.id, claimId: c.id});
  await commit(b);
  return {skippedOwn};
}

/* إنهاء الحجز: انتهت مهلة الاستلام أو قرار الموظف. الطلب «انتهى» والغرض متاح */
export async function releaseReservation(c, note = tAr('sys.pickupEnded')){
  notMine(c);
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'expired', note, decidedAt: Date.now(), decidedBy: S.uid});
  const i = S.items.find(x => x.id === c.itemId);
  if (i?.reservedFor === c.id) b.update(dbx.ref('items/' + i.id), {status: 'available', reservedFor: '', updatedAt: Date.now()});
  log(b, c.officeId, 'release', {itemId: c.itemId, claimId: c.id, note});
  await commit(b);
}

/* تغيير الحالة يدوياً من «تغيير الحالة»
   available: يُنهي الطلب المقبول (expired) · returned: تسليم مباشر مع ملاحظة تحفظ في itemSecrets
   archived: تُلغى الطلبات المفتوحة */
export async function setItemStatus(i, to, note = ''){
  const b = dbx.batch(); const now = Date.now();
  const patch = {status: to, updatedAt: now, reservedFor: ''};
  let skippedOwn = false;
  if (to === 'available'){
    const held = S.claims.find(x => x.id === i.reservedFor && x.status === 'approved');
    if (held){
      if (held.uid === S.uid) fail(t('wf.heldForOwn'));
      b.update(dbx.ref('claims/' + held.id), {status: 'expired', note: tAr('sys.madeAvailable'), decidedAt: now, decidedBy: S.uid});
    }
  } else if (to === 'returned'){
    if (String(note).trim().length < 6) fail(t('wf.needHandoverNote'));
    patch.returnedAt = now;
    b.set(dbx.ref('itemSecrets/' + i.id), {...secretOf(i), handoverNote: String(note).slice(0, 600)});
    skippedOwn = closeOthers(b, i.id, '', 'cancelled', tAr('sys.handedDirect'));
  } else if (to === 'archived'){
    skippedOwn = closeOthers(b, i.id, '', 'cancelled', tAr('sys.archived'));
  } else fail(t('wf.badStatus'));
  b.update(dbx.ref('items/' + i.id), patch);
  log(b, i.officeId, 'status:' + to, {itemId: i.id, note: to === 'returned' ? tAr('sys.directHandover') : note});
  await commit(b);
  return {skippedOwn};
}

/* بعد حفظ غرض (جديد أو معدَّل): قيد في السجل، ومعه في batch واحد:
   ترشيح الغرض لصاحب البلاغ (قبول بلاغ)، أو تأكيد استلام إشعار التسليم وربطه بالغرض.
   إنشاء الغرض نفسه يبقى قبل ذلك ومتسلسلاً (items ثم التفاصيل والصور) لأن قواعدها تستخدم get(). */
export async function itemSaved(i, {created = false, fromReport = '', fromFound = ''} = {}){
  const b = dbx.batch(); const now = Date.now();
  if (fromReport) b.update(dbx.ref('reports/' + fromReport), {staffPick: i.id, pickedAt: now});
  if (fromFound) b.update(dbx.ref('foundReports/' + fromFound), {status: 'received', receivedAt: now, receivedBy: S.uid, itemId: i.id});
  log(b, i.officeId, created ? 'create' : fromFound ? 'receive' : 'edit', {itemId: i.id, reportId: fromReport || fromFound});
  await commit(b);
}
/* إشعار تسليم لم يصل صاحبه بالغرض إلى المكتب: يُغلق (يراه الواجد «مُلغى») */
export async function dropFound(f){
  if (f.status !== 'pending') fail(t('wf.badStatus'));
  const b = dbx.batch();
  b.update(dbx.ref('foundReports/' + f.id), {status: 'cancelled'});
  log(b, f.officeId, 'found:drop', {reportId: f.id});
  await commit(b);
}

/* التصرّف في الأغراض بعد انتهاء مدة الحفظ (تبرّع، إتلاف، تسليم للجهة المختصة، أخرى) */
// طرق التصرّف (أسماؤها في القاموس: disposal.<key>)
export const DISPOSAL = {donated: 1, destroyed: 1, authority: 1, other: 1};
export async function disposeItems(items, method, note = ''){
  if (!DISPOSAL[method]) fail(t('wf.pickMethod'));
  let n = 0;
  // دفعات صغيرة: حد writeBatch في Firestore 500 عملية
  for (let k = 0; k < items.length; k += 60){
    const b = dbx.batch(); const now = Date.now();
    for (const i of items.slice(k, k + 60)){
      if (i.status !== 'available') continue;
      b.update(dbx.ref('items/' + i.id), {status: 'disposed', disposal: method, disposedAt: now, reservedFor: '', updatedAt: now});
      b.set(dbx.ref('itemSecrets/' + i.id), {...secretOf(i), disposalNote: String(note).slice(0, 600)});
      closeOthers(b, i.id, '', 'cancelled', tAr('sys.retentionEnded'));
      log(b, i.officeId, 'dispose', {itemId: i.id, note: tAr('disposal.' + method) + (note ? ' — ' + note : '')});
      n++;
    }
    await commit(b);
  }
  return n;
}

/* حذف غرض: تُلغى طلباته المفتوحة، وتُحذف صوره وتفاصيله السرية، ثم الغرض نفسه، في batch واحد.
   القواعد ترفض حذف مستند غير موجود، لذلك نضيف الموجود فقط. */
export async function deleteItem(i){
  const b = dbx.batch();
  const skippedOwn = closeOthers(b, i.id, '', 'cancelled', tAr('sys.deleted'));
  if (pubPhoto(i)) b.delete(dbx.ref('itemPhotos/' + i.id));
  if (['clear', 'blur', 'none'].includes(i.photo)) b.delete(dbx.ref('itemPhotosPrivate/' + i.id));
  if (S.secrets[i.id]) b.delete(dbx.ref('itemSecrets/' + i.id));
  b.delete(dbx.ref('items/' + i.id));
  log(b, i.officeId, 'delete', {itemId: i.id, note: full(i).title || i.ref});
  await commit(b);
  return {skippedOwn};
}
