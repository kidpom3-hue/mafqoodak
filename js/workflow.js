// انتقالات حالة المفقودات وطلبات الاستلام في مكان واحد.
// كل انتقال يُكتب في writeBatch واحد (الغرض + الطلبات + قيد في السجل logs)،
// فإما ينجح كله أو لا يُكتب منه شيء، حتى لا تبقى البيانات ناقصة إذا انقطع الاتصال.
import { dbx, deleteField } from './firebase.js';
import { S, full, item } from './state.js';
import { SETTINGS } from './config.js';
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
// تنفيذ الـbatch، ثم إضافة قيوده إلى سجل الحيازة المعروض (إن كان محمّلاً) دون قراءة جديدة.
// guarded: عملية تحرسها القواعد على الخادم (القبول، والتسليم بالرمز، وإعادة التفعيل). رفضها بعد تزامن
// يعني أن موظفاً آخر سبق بقرار على الغرض نفسه، فنعرض ذلك بوضوح بدل «ليست لديك صلاحية».
async function commit(b, guarded = false){
  try { await b.commit(); }
  catch (e){ if (guarded && String(e?.code || '').includes('permission-denied')) fail(t('wf.race')); throw e; }
  for (const e of PENDING_LOGS.get(b) || []) if (Array.isArray(S.logs[e.itemId])) S.logs[e.itemId] = [...S.logs[e.itemId], e];
}
// التفاصيل السرية كما هي في itemSecrets (دون حقل id الذي يضيفه الاشتراك)
function secretOf(i){ const {id, ...s} = S.secrets[i.id] || {}; return {...s, officeId: i.officeId}; }

/* مكان العثور سري منذ المرحلة E5: مكانه itemSecrets، والقواعد ترفض أي تعديل على غرض ما زال spot في مستنده العام.
   احتياط للأغراض القديمة التي لم تنقلها migrate.js بعد: كل تعديل على الغرض هنا يمر عبر itemUpdate،
   فيحذف spot من items (deleteField) وينقله إلى itemSecrets في الـ batch نفسه:
   ضمن الكتابة الكاملة لـ itemSecrets إن كانت في العملية (secret)، وإلا بـ merge */
function publicSpot(i){
  const p = item(i.id) || i;   // المستند العام كما وصل من Firestore (لا full)
  return p && Object.prototype.hasOwnProperty.call(p, 'spot') ? String(p.spot ?? '') : null;
}
function itemUpdate(b, i, patch, secret = null){
  const sp = publicSpot(i);
  if (sp !== null){
    patch = {...patch, spot: deleteField()};
    const keep = S.secrets[i.id]?.spot ?? sp;
    if (secret){ if (secret.spot === undefined) secret.spot = keep; }
    else b.set(dbx.ref('itemSecrets/' + i.id), {officeId: i.officeId, spot: keep}, {merge: true});
  }
  if (secret) b.set(dbx.ref('itemSecrets/' + i.id), secret);
  b.update(dbx.ref('items/' + i.id), patch);
}

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

/* قبول طلب: الغرض متاح، أو محجوز دون طلب مقبول فعلي.
   القواعد تشترط أن يكون الغرض «متاحاً» قبل القبول، وأن يُحجز لهذا الطلب في العملية نفسها (approveOk)،
   فلا يُقبل طلبان معاً من جهازين. «المحجوز» دون طلب مقبول (بيانات قديمة) يُعاد متاحاً أولاً في batch مستقل.
   reason: سبب القبول، إلزامي إذا كان صاحب الطلب هو من سلّم الغرض أو سجّله (تضارب مصالح)؛ يُحفظ في note والسجل */
export async function approveClaim(c, {reason = ''} = {}){
  notMine(c);
  if (c.status !== 'pending') fail(t('wf.notPending'));
  const i = await freshItem(c.itemId);
  const holder = i.status === 'reserved' && S.claims.find(x => x.id === i.reservedFor && x.status === 'approved');
  if (!(i.status === 'available' || (i.status === 'reserved' && !holder))) fail(t('wf.notAvailable'));
  if (i.status === 'reserved'){
    const b0 = dbx.batch();
    itemUpdate(b0, i, {status: 'available', reservedFor: '', updatedAt: Date.now()});
    log(b0, i.officeId, 'status:available', {itemId: i.id, note: tAr('sys.orphanReserved')});
    await commit(b0, true);
  }
  const o = S.offices.find(x => x.id === i.officeId);
  const pickupBy = Date.now() + pickupDays(o) * 864e5;
  const note = String(reason || '').trim().slice(0, 600);
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'approved', decidedAt: Date.now(), decidedBy: S.uid, pickupBy, ...(note ? {note} : {})});
  itemUpdate(b, i, {status: 'reserved', reservedFor: c.id, updatedAt: Date.now()});
  log(b, i.officeId, 'approve', {itemId: i.id, claimId: c.id, note});
  await commit(b, true);
}

/* إعادة تفعيل طلب منتهٍ أو ملغى (من سجل الطلبات عند الموظف):
   الغرض متاح ← يعود الطلب مقبولاً بمهلة استلام جديدة ويُحجز له الغرض في العملية نفسها.
   الغرض محجوز لطلب آخر ← يعود الطلب «قيد المراجعة». غير ذلك (سُلّم، أو حُذف...) لا يمكن. */
export async function reactivateClaim(c){
  notMine(c);
  if (!['expired', 'cancelled'].includes(c.status)) fail(t('wf.cantReactivate'));
  const i = await freshItem(c.itemId);
  if (!['available', 'reserved'].includes(i.status)) fail(t('wf.cantReactivate'));
  const now = Date.now(), b = dbx.batch();
  let to = 'pending';
  if (i.status === 'available'){
    to = 'approved';
    const o = S.offices.find(x => x.id === i.officeId);
    b.update(dbx.ref('claims/' + c.id), {status: 'approved', note: '', decidedAt: now, decidedBy: S.uid, pickupBy: now + pickupDays(o) * 864e5});
    itemUpdate(b, i, {status: 'reserved', reservedFor: c.id, updatedAt: now});
  } else b.update(dbx.ref('claims/' + c.id), {status: 'pending', note: '', decidedAt: now, decidedBy: S.uid});
  log(b, i.officeId, 'reactivate', {itemId: i.id, claimId: c.id, note: tAr(to === 'approved' ? 'sys.reactivatedApproved' : 'sys.reactivatedPending')});
  await commit(b, true);
  if (Array.isArray(S.claimHist)) S.claimHist = S.claimHist.filter(x => x.id !== c.id);   // انتقل إلى الطلبات المفتوحة
  return to;
}

/* رفض طلب: إن كان مقبولاً والغرض محجوزاً له يعود الغرض متاحاً */
export async function rejectClaim(c, note){
  notMine(c);
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'rejected', note: String(note || '').slice(0, 200), decidedAt: Date.now(), decidedBy: S.uid});
  const i = S.items.find(x => x.id === c.itemId);
  if (c.status === 'approved' && i?.reservedFor === c.id) itemUpdate(b, i, {status: 'available', reservedFor: '', updatedAt: Date.now()});
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
  // H7: السؤال الجديد يمسح الإجابة القديمة في العملية نفسها، فلا يظهر مُجاباً قبل أن يجيب صاحب الطلب عنه
  b.update(dbx.ref('claims/' + c.id), {question, askedAt: Date.now(), askedBy: S.uid, answer: deleteField(), answeredAt: deleteField()});
  log(b, c.officeId, 'ask', {itemId: c.itemId, claimId: c.id, note: question});
  await commit(b);
}

/* التسليم بعد التحقق من الرمز: فقط للطلب المقبول الذي حُجز له الغرض.
   receiver: {name, last4} من طابق الموظف بطاقته (المستلم الفعلي، وقد يكون مفوّضاً)، تُحفظ في handoverNote بالطلب */
export async function verifyHandover(c, receiver = {}){
  notMine(c);
  const i = await freshItem(c.itemId);
  if (c.status !== 'approved' || i.status !== 'reserved' || i.reservedFor !== c.id) fail(t('wf.notReserved'));
  const name = String(receiver.name || '').trim().slice(0, 120), last4 = String(receiver.last4 || '').trim();
  if (name.length < 3 || !/^\d{4}$/.test(last4)) fail(t('wf.needReceiver'));
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'done', doneAt: Date.now(), doneBy: S.uid, handoverNote: tAr('sys.receivedBy', {name, last4})});
  itemUpdate(b, i, {status: 'returned', returnedAt: Date.now(), updatedAt: Date.now()});
  const skippedOwn = closeOthers(b, i.id, c.id, 'rejected', tAr('sys.handedVerified'));
  log(b, i.officeId, 'handover', {itemId: i.id, claimId: c.id, note: tAr('sys.receivedBy', {name, last4})});
  await commit(b, true);
  return {skippedOwn};
}

/* إنهاء الحجز: انتهت مهلة الاستلام أو قرار الموظف. الطلب «انتهى» والغرض متاح */
export async function releaseReservation(c, note = tAr('sys.pickupEnded')){
  notMine(c);
  const b = dbx.batch();
  b.update(dbx.ref('claims/' + c.id), {status: 'expired', note, decidedAt: Date.now(), decidedBy: S.uid});
  const i = S.items.find(x => x.id === c.itemId);
  if (i?.reservedFor === c.id) itemUpdate(b, i, {status: 'available', reservedFor: '', updatedAt: Date.now()});
  log(b, c.officeId, 'release', {itemId: c.itemId, claimId: c.id, note});
  await commit(b);
}

/* تغيير الحالة يدوياً من «تغيير الحالة»
   available: يُنهي الطلب المقبول (expired) · returned: تسليم مباشر مع ملاحظة تحفظ في itemSecrets
   archived: تُلغى الطلبات المفتوحة */
export async function setItemStatus(i, to, note = ''){
  const b = dbx.batch(); const now = Date.now();
  const patch = {status: to, updatedAt: now, reservedFor: ''};
  let skippedOwn = false, secret = null;
  if (to === 'available'){
    const held = S.claims.find(x => x.id === i.reservedFor && x.status === 'approved');
    if (held){
      if (held.uid === S.uid) fail(t('wf.heldForOwn'));
      b.update(dbx.ref('claims/' + held.id), {status: 'expired', note: tAr('sys.madeAvailable'), decidedAt: now, decidedBy: S.uid});
    }
  } else if (to === 'returned'){
    if (String(note).trim().length < 6) fail(t('wf.needHandoverNote'));
    patch.returnedAt = now;
    secret = {...secretOf(i), handoverNote: String(note).slice(0, 600)};
    skippedOwn = closeOthers(b, i.id, '', 'cancelled', tAr('sys.handedDirect'));
  } else if (to === 'archived'){
    skippedOwn = closeOthers(b, i.id, '', 'cancelled', tAr('sys.archived'));
  } else fail(t('wf.badStatus'));
  itemUpdate(b, i, patch, secret);
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
// طرق التصرّف (أسماؤها في القاموس: disposal.<key>).
// finder «أُعيد لمن وجده»: فقط لغرض له إشعار تسليم (fromFound)، وإذا فعّلها المالك في config.js (allowReturnToFinder)
export const DISPOSAL = {donated: 1, destroyed: 1, authority: 1, finder: 1, other: 1};
export const finderOk = i => !!(SETTINGS.allowReturnToFinder && i?.fromFound);
// الطرق المتاحة لمجموعة أغراض
export const disposalsFor = items => Object.keys(DISPOSAL).filter(k => k !== 'finder' || (items.length && items.every(finderOk)));
export async function disposeItems(items, method, note = ''){
  if (!DISPOSAL[method]) fail(t('wf.pickMethod'));
  if (method === 'finder' && !items.every(finderOk)) fail(t('wf.noFinder'));
  let n = 0;
  // دفعات صغيرة: حد writeBatch في Firestore 500 عملية
  for (let k = 0; k < items.length; k += 60){
    const b = dbx.batch(); const now = Date.now();
    for (const i of items.slice(k, k + 60)){
      if (i.status !== 'available') continue;
      itemUpdate(b, i, {status: 'disposed', disposal: method, disposedAt: now, reservedFor: '', updatedAt: now}, {...secretOf(i), disposalNote: String(note).slice(0, 600)});
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

/* ---------- صلاحيات الموظفين (للإدارة) ----------
   كل تغيير في batch واحد مع قيد في السجل لكل مكتب معني (itemId فارغ، ورقم المستخدم في note).
   السجل يظهر في صفحة «سجل العمليات» (route: audit). */
const permLog = (b, offices, action, uid) => { for (const o of new Set(offices)) log(b, o, action, {note: uid}); };
const allOffices = () => S.offices.map(o => o.id);
/* دعوة موظف (بدل «طلب صلاحية موظف»): الإدارة تكتب staffInvites/{البريد بأحرف صغيرة} = {offices, createdBy, createdAt}.
   عند دخول صاحب البريد ببريد موثّق يقبلها تلقائياً (acceptInvite من state.js). القواعد تفرض كل الشروط */
export const inviteId = e => String(e || '').trim().toLowerCase();
export async function inviteStaff(email, offices){
  await dbx.set('staffInvites/' + inviteId(email), {offices: [...new Set(offices)], createdBy: S.uid, createdAt: Date.now()});
}
export async function cancelInvite(email){ await dbx.del('staffInvites/' + email); }
// قبول الدعوة (يكتبها المدعو نفسه): وثيقة staff بمكاتب الدعوة نفسها تماماً + حذف الدعوة + «منح الصلاحية» في السجل، في batch واحد
export async function acceptInvite(email, inv){
  const b = dbx.batch();
  b.set(dbx.ref('staff/' + S.uid), {offices: inv.offices, approvedAt: Date.now(), approvedBy: inv.createdBy});
  b.delete(dbx.ref('staffInvites/' + email));
  permLog(b, inv.offices, 'perm:grant', S.uid);
  await commit(b);
}
export async function revokeStaff(uid){
  const cur = S.staffList.find(s => s.id === uid);
  const b = dbx.batch();
  b.delete(dbx.ref('staff/' + uid));
  permLog(b, cur?.offices?.length ? cur.offices : allOffices(), 'perm:revoke', uid);
  await commit(b);
}
// الإدارة (admins): «اجعله مديراً» و«أزل الإدارة». المالك لا يُزال (القواعد تمنع ذلك أيضاً)
export async function setAdmin(uid, on){
  if (!on && uid === S.config?.ownerUid) fail(t('wf.ownerStays'));
  const b = dbx.batch();
  if (on) b.set(dbx.ref('admins/' + uid), {role: 'admin', addedAt: Date.now(), addedBy: S.uid});
  else b.delete(dbx.ref('admins/' + uid));
  permLog(b, allOffices(), on ? 'perm:admin' : 'perm:unadmin', uid);
  await commit(b);
}
