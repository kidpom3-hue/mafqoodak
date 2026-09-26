// انتقالات حالة المفقودات وطلبات الاستلام في مكان واحد.
// كل انتقال يُكتب في writeBatch واحد (الغرض + الطلبات + قيد في السجل logs)،
// فإما ينجح كله أو لا يُكتب منه شيء، حتى لا تبقى البيانات ناقصة إذا انقطع الاتصال.
import { dbx } from './firebase.js';
import { S, full } from './state.js';
import { pubPhoto } from './views/common.js';

// خطأ برسالة عربية تُعرض للموظف كما هي
export class FlowError extends Error { constructor(msg){ super(msg); this.msg = msg; } }
const fail = msg => { throw new FlowError(msg); };

export const OPEN = ['pending', 'approved'];   // الطلبات المفتوحة على الغرض
export const pickupDays = o => Math.max(1, Math.min(60, Number(o?.pickupDays) || 7));
// الطلبات المفتوحة على الغرض (من اشتراك الموظف في طلبات مكتبه)
export const openClaimsOf = itemId => S.claims.filter(c => c.itemId === itemId && OPEN.includes(c.status));

// قيد في سجل العمليات (سلسلة الحيازة)
function log(b, officeId, action, x = {}){
  b.set(dbx.ref('logs/' + dbx.newId('logs')), {officeId, itemId: x.itemId || '', claimId: x.claimId || '', reportId: x.reportId || '',
    action, by: S.uid, at: Date.now(), note: String(x.note || '').slice(0, 600)});
}
// التفاصيل السرية كما هي في itemSecrets (دون حقل id الذي يضيفه الاشتراك)
function secretOf(i){ const {id, ...s} = S.secrets[i.id] || {}; return {...s, officeId: i.officeId}; }

// الغرض بأحدث نسخة: من الاشتراك، أو من الخادم إن لم يكن محمّلاً (مثل المُسلَّم)
async function freshItem(id){
  const i = S.items.find(x => x.id === id) || await dbx.get('items/' + id).then(d => d && {id, ...d}).catch(() => null);
  if (!i) fail('لم يعد هذا الغرض موجوداً.');
  return i;
}
const notMine = c => { if (c.uid === S.uid) fail('طلبك الشخصي: يراجعه موظف آخر.'); };
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
  if (c.status !== 'pending') fail('هذا الطلب ليس قيد المراجعة.');
  const i = await freshItem(c.itemId);
  const holder = i.status === 'reserved' && S.claims.find(x => x.id === i.reservedFor && x.status === 'approved');
  if (!(i.status === 'available' || (i.status === 'reserved' && !holder))) fail('الغرض ليس متاحاً الآن؛ قد يكون محجوزاً لطلب مقبول آخر أو سُلّم.');
  const o = S.offices.find(x => x.id === i.officeId);
  const pickupBy = Date.now() + pickupDays(o) * 864e5;
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'approved', decidedAt: Date.now(), decidedBy: S.uid, pickupBy});
  b.update(dbx.ref('items/' + i.id), {status: 'reserved', reservedFor: c.id, updatedAt: Date.now()});
  log(b, i.officeId, 'approve', {itemId: i.id, claimId: c.id});
  await b.commit();
}

/* رفض طلب: إن كان مقبولاً والغرض محجوزاً له يعود الغرض متاحاً */
export async function rejectClaim(c, note){
  notMine(c);
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'rejected', note: String(note || '').slice(0, 200), decidedAt: Date.now(), decidedBy: S.uid});
  const i = S.items.find(x => x.id === c.itemId);
  if (c.status === 'approved' && i?.reservedFor === c.id) b.update(dbx.ref('items/' + i.id), {status: 'available', reservedFor: '', updatedAt: Date.now()});
  log(b, c.officeId, 'reject', {itemId: c.itemId, claimId: c.id, note});
  await b.commit();
}

/* التسليم بعد التحقق من الرمز: فقط للطلب المقبول الذي حُجز له الغرض */
export async function verifyHandover(c){
  notMine(c);
  const i = await freshItem(c.itemId);
  if (c.status !== 'approved' || i.status !== 'reserved' || i.reservedFor !== c.id) fail('هذا الغرض ليس محجوزاً لهذا الطلب؛ لا يمكن تسليمه به.');
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'done', doneAt: Date.now(), doneBy: S.uid});
  b.update(dbx.ref('items/' + i.id), {status: 'returned', returnedAt: Date.now(), updatedAt: Date.now()});
  const skippedOwn = closeOthers(b, i.id, c.id, 'rejected', 'سُلّم الغرض لصاحبه بعد التحقق');
  log(b, i.officeId, 'handover', {itemId: i.id, claimId: c.id});
  await b.commit();
  return {skippedOwn};
}

/* إنهاء الحجز: انتهت مهلة الاستلام أو قرار الموظف. الطلب «انتهى» والغرض متاح */
export async function releaseReservation(c, note = 'انتهت مهلة الاستلام'){
  notMine(c);
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'expired', note, decidedAt: Date.now(), decidedBy: S.uid});
  const i = S.items.find(x => x.id === c.itemId);
  if (i?.reservedFor === c.id) b.update(dbx.ref('items/' + i.id), {status: 'available', reservedFor: '', updatedAt: Date.now()});
  log(b, c.officeId, 'release', {itemId: c.itemId, claimId: c.id, note});
  await b.commit();
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
      if (held.uid === S.uid) fail('الغرض محجوز لطلبك الشخصي؛ يراجعه موظف آخر.');
      b.update(dbx.ref('claims/' + held.id), {status: 'expired', note: 'أعاد المكتب إتاحة الغرض', decidedAt: now, decidedBy: S.uid});
    }
  } else if (to === 'returned'){
    if (String(note).trim().length < 6) fail('اكتب اسم المستلم وآخر 4 أرقام من بطاقته.');
    patch.returnedAt = now;
    b.set(dbx.ref('itemSecrets/' + i.id), {...secretOf(i), handoverNote: String(note).slice(0, 600)});
    skippedOwn = closeOthers(b, i.id, '', 'cancelled', 'سُلّم الغرض لصاحبه مباشرة في المكتب');
  } else if (to === 'archived'){
    skippedOwn = closeOthers(b, i.id, '', 'cancelled', 'أُرشف الغرض');
  } else fail('حالة غير معروفة.');
  b.update(dbx.ref('items/' + i.id), patch);
  log(b, i.officeId, 'status:' + to, {itemId: i.id, note: to === 'returned' ? 'تسليم مباشر' : note});
  await b.commit();
  return {skippedOwn};
}

/* التصرّف في الأغراض بعد انتهاء مدة الحفظ (تبرّع، إتلاف، تسليم للجهة المختصة، أخرى) */
export const DISPOSAL = {donated: 'تبرّع', destroyed: 'إتلاف', authority: 'تسليم للجهة المختصة', other: 'أخرى'};
export async function disposeItems(items, method, note = ''){
  if (!DISPOSAL[method]) fail('اختر طريقة التصرّف.');
  let n = 0;
  // دفعات صغيرة: حد writeBatch في Firestore 500 عملية
  for (let k = 0; k < items.length; k += 60){
    const b = dbx.batch(); const now = Date.now();
    for (const i of items.slice(k, k + 60)){
      if (i.status !== 'available') continue;
      b.update(dbx.ref('items/' + i.id), {status: 'disposed', disposal: method, disposedAt: now, reservedFor: '', updatedAt: now});
      b.set(dbx.ref('itemSecrets/' + i.id), {...secretOf(i), disposalNote: String(note).slice(0, 600)});
      closeOthers(b, i.id, '', 'cancelled', 'انتهت مدة حفظ الغرض');
      log(b, i.officeId, 'dispose', {itemId: i.id, note: DISPOSAL[method] + (note ? ' — ' + note : '')});
      n++;
    }
    await b.commit();
  }
  return n;
}

/* حذف غرض: تُلغى طلباته المفتوحة، وتُحذف صوره وتفاصيله السرية، ثم الغرض نفسه، في batch واحد.
   القواعد ترفض حذف مستند غير موجود، لذلك نضيف الموجود فقط. */
export async function deleteItem(i){
  const b = dbx.batch();
  const skippedOwn = closeOthers(b, i.id, '', 'cancelled', 'حُذف الغرض من المستودع');
  if (pubPhoto(i)) b.delete(dbx.ref('itemPhotos/' + i.id));
  if (['clear', 'blur', 'none'].includes(i.photo)) b.delete(dbx.ref('itemPhotosPrivate/' + i.id));
  if (S.secrets[i.id]) b.delete(dbx.ref('itemSecrets/' + i.id));
  b.delete(dbx.ref('items/' + i.id));
  log(b, i.officeId, 'delete', {itemId: i.id, note: full(i).title || i.ref});
  await b.commit();
  return {skippedOwn};
}
