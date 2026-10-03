// انتقالات حالة المفقودات وطلبات الاستلام في مكان واحد.
// كل انتقال يُكتب في writeBatch واحد (الغرض + الطلبات + قيد في السجل logs)،
// فإما ينجح كله أو لا يُكتب منه شيء، حتى لا تبقى البيانات ناقصة إذا انقطع الاتصال.
import { dbx, deleteField, arrayRemove } from './firebase.js';
import { isHighValue, pubFlag, isHiddenCat, detailValue, claimOf, cat, keepUntilOf } from './constants.js';
import { makeRef, publicTitle, today } from './utils.js';
import { S, full, item, isOwner } from './state.js';
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
/* v14 (H19): كل تغيير في حالة الغرض أو تصنيفه، وكل حذف له، يحتاج قيداً جديداً في الـ batch نفسه (القواعد تفرضه):
   itemUpdate يحجز رقم قيد للغرض ويكتبه في lastLog؛ أول log() لهذا الغرض في الـ batch يستخدم الرقم المحجوز،
   وإن لم يُكتب قيد له يكتب commit قيداً عاماً «status:…» بالرقم نفسه. الحذف بالرقم الثابت del_{itemId} */
const RESERVED = new WeakMap();   // b -> Map(itemId -> {id, officeId, action})
function log(b, officeId, action, x = {}){
  const r = x.itemId && RESERVED.get(b)?.get(x.itemId);
  if (r) RESERVED.get(b).delete(x.itemId);
  const id = x.id || r?.id || dbx.newId('logs');
  const e = {officeId, itemId: x.itemId || '', claimId: x.claimId || '', reportId: x.reportId || '',
    action, by: S.uid, at: Date.now(), note: String(x.note || '').slice(0, 600), ...(x.checks?.length ? {checks: x.checks} : {}), ...(x.direct ? {direct: true} : {}), ...(x.claimId && SELF.has(x.claimId) ? {self: true} : {})};
  b.set(dbx.ref('logs/' + id), e);
  PENDING_LOGS.set(b, [...(PENDING_LOGS.get(b) || []), {id, ...e}]);
}
// تنفيذ الـbatch، ثم إضافة قيوده إلى سجل الحيازة المعروض (إن كان محمّلاً) دون قراءة جديدة.
// guarded: عملية تحرسها القواعد على الخادم (القبول، والتسليم بالرمز، وإعادة التفعيل). رفضها بعد تزامن
// يعني أن موظفاً آخر سبق بقرار على الغرض نفسه، فنعرض ذلك بوضوح بدل «ليست لديك صلاحية».
async function commit(b, guarded = false){
  flushQuota(b);
  for (const [itemId, r] of RESERVED.get(b) || []) log(b, r.officeId, r.action, {itemId});   // قيد عام لتغيير بلا قيد مكتوب
  RESERVED.delete(b);
  try { await b.commit(); }
  catch (e){ if (guarded && String(e?.code || '').includes('permission-denied')) fail(t('wf.race')); throw e; }
  for (const e of PENDING_LOGS.get(b) || []) if (Array.isArray(S.logs[e.itemId])) S.logs[e.itemId] = [...S.logs[e.itemId], e];
}
/* v7: إغلاق طلب (رفض، تسليم، انتهاء، إلغاء) في الـ batch نفسه مع:
   - حذف صور الإثبات (claimProofs) وتصفير عددها، لتقليل البيانات الشخصية؛
   - إزالته من حصة الطلبات الجارية لصاحبه (claimQuota.open). تُجمع الإزالات لكل صاحب طلب في كتابة واحدة عند commit */
const QUOTA = new WeakMap();
function closeClaim(b, c, patch){
  const n = Number(c.proofs) || 0;
  b.update(dbx.ref('claims/' + c.id), {...patch, ...(n ? {proofs: 0} : {})});
  for (let k = 0; k < n; k++) b.delete(dbx.ref(`claimProofs/${c.id}_${k}`));
  if (c.uid && c.uid !== 'deleted'){
    const m = QUOTA.get(b) || new Map(); QUOTA.set(b, m);
    m.set(c.uid, [...(m.get(c.uid) || []), c.id]);
  }
}
function flushQuota(b){
  for (const [uid, ids] of QUOTA.get(b) || []) b.set(dbx.ref('claimQuota/' + uid), {open: arrayRemove(...ids)}, {merge: true});
  QUOTA.delete(b);
}
// التفاصيل السرية كما هي في itemSecrets (دون حقل id الذي يضيفه الاشتراك)

/* مكان العثور سري منذ المرحلة E5: مكانه itemSecrets، والقواعد ترفض أي تعديل على غرض ما زال spot في مستنده العام.
   احتياط للأغراض القديمة التي لم تنقلها migrate.js بعد: كل تعديل على الغرض هنا يمر عبر itemUpdate،
   فيحذف spot من items (deleteField) وينقله إلى itemSecrets في الـ batch نفسه:
   ضمن الكتابة الكاملة لـ itemSecrets إن كانت في العملية (secret)، وإلا بـ merge */
function publicSpot(i){
  const p = item(i.id) || i;   // المستند العام كما وصل من Firestore (لا full)
  return p && Object.prototype.hasOwnProperty.call(p, 'spot') ? String(p.spot ?? '') : null;
}
function itemUpdate(b, i, patch, secret = null){
  const base = item(i.id) || i;   // المستند العام كما وصل من Firestore
  // v14: تغيّرت الحالة أو التصنيف: رقم قيد في lastLog (قيد موجود لهذا الغرض في الـ batch، أو رقم محجوز)
  const changed = (patch.status !== undefined && patch.status !== base.status) || (patch.cat !== undefined && patch.cat !== base.cat);
  if (changed){
    const had = (PENDING_LOGS.get(b) || []).find(e => e.itemId === i.id);
    if (had) patch = {...patch, lastLog: had.id};
    else {
      const m = RESERVED.get(b) || new Map(); RESERVED.set(b, m);
      if (!m.has(i.id)) m.set(i.id, {id: dbx.newId('logs'), officeId: i.officeId, action: patch.status !== undefined && patch.status !== base.status ? 'status:' + patch.status : 'edit'});
      patch = {...patch, lastLog: m.get(i.id).id};
    }
  }
  // v14: مدة الحفظ (keepUntil) لغرض قديم ليس فيه: تُحسب من تاريخ العثور ومدة التصنيف (الموظف يضيفها مرة، ولا يغيّرها)
  if (base.keepUntil === undefined && (patch.foundDate || base.foundDate)){
    const k = keepUntilOf(patch.cat || base.cat, S.offices.find(o => o.id === i.officeId), patch.foundDate || base.foundDate);
    if (k) patch = {...patch, keepUntil: k};
  }
  const sp = publicSpot(i);
  if (sp !== null){
    patch = {...patch, spot: deleteField()};
    const keep = S.secrets[i.id]?.spot ?? sp;
    if (secret){ if (secret.spot === undefined) secret.spot = keep; }
    else b.set(dbx.ref('itemSecrets/' + i.id), {officeId: i.officeId, spot: keep}, {merge: true});
  }
  if (secret) b.set(dbx.ref('itemSecrets/' + i.id), secret);
  // H16: public يطابق التصنيف بعد كل تعديل (القواعد v11 تفرضه؛ ويرحّل الأغراض القديمة بلا الحقل)
  b.update(dbx.ref('items/' + i.id), {...patch, public: pubFlag(patch.cat || i.cat)});
}

// الغرض بأحدث نسخة: من الاشتراك، أو من الخادم إن لم يكن محمّلاً (مثل المُسلَّم)
async function freshItem(id){
  const i = S.items.find(x => x.id === id) || await dbx.get('items/' + id).then(d => d && {id, ...d}).catch(() => null);
  if (!i) fail(t('wf.gone'));
  return i;
}
// فصل المهام: لا يقرر الموظف في طلب أرسله هو. H18: إلا المالك، وكل قيد لقراره في طلبه يُعلَّم self: true
const SELF = new Set();
const notMine = c => { if (c.uid !== S.uid) return; if (!isOwner()) fail(t('wf.own')); SELF.add(c.id); };
/* H13a: الغرض كما هو على الخادم (أو null إن حُذف فعلاً)، لا من S.items (النشطة فقط) */
export async function fetchItem(id){
  if (!id) return null;
  return item(id) || await dbx.get('items/' + id).then(d => d ? {id, ...d} : null);
}
/* H13a: طلب مفتوح على غرض لم يعد متاحاً (سُلّم، أُرشف، تُصرّف فيه، أو حُذف): يُنهى «منتهياً» بملاحظة واضحة.
   القواعد لا تقرأ الغرض في هذا الانتقال (حالة الطلب فقط)، فيعمل ولو حُذف الغرض */
export async function closeOrphan(c){
  notMine(c);
  if (!OPEN.includes(c.status)) fail(t('wf.notPending'));
  const b = dbx.batch(), note = tAr('sys.itemUnavailable');
  closeClaim(b, c, {status: 'expired', note, decidedAt: Date.now(), decidedBy: S.uid});
  log(b, c.officeId, 'expire', {itemId: c.itemId, claimId: c.id, note});
  await commit(b);
}
/* H13a: الطلبات المفتوحة على غرض (قيد المراجعة والمقبولة) من الخادم، لا من S.claims المحلية وحدها:
   الاشتراك المحلي قد لا يرى طلباً وصل قبل ثوانٍ، ولا يرى طلبات مكتب آخر (الإدارة). تُدمج القائمتان بلا تكرار.
   الاستعلام بالمكتب والغرض والحالة (مساواة و«in» فقط، بلا فهرس مركّب؛ والمكتب شرط قواعد القراءة للموظف) */
export async function openClaimsFor(itemId, officeId){
  const srv = await dbx.list('claims', [['officeId', '==', officeId], ['itemId', '==', itemId], ['status', 'in', OPEN]]);
  const m = new Map(openClaimsOf(itemId).map(c => [c.id, c]));
  for (const c of srv) m.set(c.id, c);
  return [...m.values()].filter(c => OPEN.includes(c.status));
}
/* إنهاء بقية الطلبات المفتوحة على الغرض في الـ batch نفسه (مع حذف صور الإثبات وإزالتها من الحصة: closeClaim).
   طلب الموظف نفسه يُستثنى لأن القواعد تمنعه من تعديله */
async function closeOthers(b, i, exceptId, status, note){
  let skippedOwn = false;
  for (const o of await openClaimsFor(i.id, i.officeId)){
    if (o.id === exceptId) continue;
    if (o.uid === S.uid){ skippedOwn = true; continue; }
    closeClaim(b, o, {status, note, decidedAt: Date.now(), decidedBy: S.uid});
  }
  return skippedOwn;
}

/* قبول طلب: الغرض متاح، أو محجوز دون طلب مقبول فعلي.
   القواعد تشترط أن يكون الغرض «متاحاً» قبل القبول، وأن يُحجز لهذا الطلب في العملية نفسها (approveOk)،
   فلا يُقبل طلبان معاً من جهازين. «المحجوز» دون طلب مقبول (بيانات قديمة) يُعاد متاحاً أولاً في batch مستقل.
   reason: سبب القبول، إلزامي إذا كان صاحب الطلب هو من سلّم الغرض أو سجّله (تضارب مصالح)؛ يُحفظ في note والسجل */
/* H11: ربط طلب مجمّع (بالوصف) بغرض: موظف المكتب يختاره من المرشّحين، مرة واحدة (claimLinks، لا يراه صاحب الطلب).
   الغرض متاح ومن المكتب والتصنيف نفسيهما (القواعد تفرض ذلك). بعده يكمل الطلب التدفق العادي: سؤال، قبول، رمز، تسليم */
export async function linkClaim(c, itemId, {silent = false} = {}){
  notMine(c);
  if (!c?.grouped || c.itemId || c.status !== 'pending') fail(t('wf.notPending'));
  if (S.links[c.id]) fail(t('wf.alreadyLinked'));
  const i = await freshItem(itemId);
  if (i.status !== 'available' || i.officeId !== c.officeId || i.cat !== c.cat) fail(t('wf.notAvailable'));
  const b = dbx.batch(), link = {officeId: c.officeId, itemId: i.id, by: S.uid, at: Date.now()};
  b.set(dbx.ref('claimLinks/' + c.id), link);
  if (!silent) log(b, c.officeId, 'link', {itemId: i.id, claimId: c.id});   // H17: القبول المباشر للنقود يكتب قيداً واحداً
  await commit(b, true);
  S.links = {...S.links, [c.id]: {id: c.id, ...link}};
}
/* H17: قبول بلاغ النقود مباشرة دون غرض مسجّل في المستودع (النقود فقط: hiddenPublic).
   المكتب يحتفظ بالمبلغ فعلاً وقد لا يكون مسجّلاً في التطبيق؛ الموظف يطابق البلاغ بما لديه ويؤكد المبلغ.
   الخطوات (القواعد كما هي: الغرض يُنشأ ويُربط قبل القبول):
   1) غرض نقود جديد (items ثم itemSecrets، بالترتيب المعتاد) متاح وغير عام (public: false)، فيه createdFrom = رقم الطلب،
      والمبلغ المؤكَّد والفئات والحاوية من البلاغ. يُنشأ «متاحاً» لا «محجوزاً»: القواعد تشترط غرضاً متاحاً للربط
      (claimLinks) وقبل القبول (approveOk)، والقبول نفسه يحجزه له. الزائر لا يراه في أي حال (H16).
   2) الربط بالطلب (claimLinks) دون قيد، ثم 3) القبول بالتدفق العادي (رمز الاستلام، ومهلة الحضور) بقيد واحد
      «قبول مباشر لبلاغ نقود» (approveCash، direct: true).
   إن فشل 1 أو 2 بعد إنشاء الغرض: يُحذف (للإدارة) أو يُؤرشف (للموظف؛ حذف النقود للإدارة فقط)، فلا يبقى غرض يتيم.
   إن فشل 3 بعد الربط: يبقى الغرض مربوطاً بالطلب، وزر «قبول» العادي يكمله */
export async function approveCashDirect(c, {amount, foundDate = ''} = {}){
  notMine(c);
  if (!c?.grouped || !isHiddenCat(c.cat) || c.itemId || c.status !== 'pending') fail(t('wf.notPending'));
  if (S.links[c.id]) return approveClaim(c);   // مربوط من قبل: القبول العادي
  const amt = detailValue({type: 'num'}, amount);
  if (!amt || Number(amt) <= 0) fail(t('wf.cashAmount'));
  const day = /^\d{4}-\d{2}-\d{2}$/.test(foundDate) && foundDate <= today() ? foundDate : today();
  const o = S.offices.find(x => x.id === c.officeId);
  // الفئات والحاوية كما في البلاغ (المفاتيح المعروفة للتصنيف فقط)، والمبلغ المؤكَّد
  const keys = claimOf(c.cat).details.map(d => d.k), det = {};
  for (const k of keys) if (c.details?.[k]) det[k] = String(c.details[k]);
  det.amount = amt;
  // النوع: «ظرف نقود» إن كانت الحاوية ظرفاً، وإلا «نقود ورقية» (القيم المخزّنة من قائمة التصنيف في constants.js)
  const subs = cat(c.cat).subs, sub = (det.holder === 'envelope' ? subs[2] : subs[0]) || subs[0] || '';
  const id = dbx.newId('items'), now = Date.now();
  await dbx.set('items/' + id, {officeId: c.officeId, ref: makeRef(o), cat: c.cat, sub, title: publicTitle(c.cat, sub), foundDate: day,
    photo: false, status: 'available', createdBy: S.uid, createdAt: now, updatedAt: now, sample: false, public: pubFlag(c.cat), createdFrom: c.id,
    keepUntil: keepUntilOf(c.cat, o, day)});   // v14: مدة الحفظ تُكتب عند الإنشاء
  let secret = false;
  try {
    await dbx.set('itemSecrets/' + id, {officeId: c.officeId, title: tAr('sys.cashTitle', {n: amt}), color: '', brand: '',
      desc: tAr('sys.cashFrom', {no: c.no || ''}), spot: '', bldg: '', room: '', storage: '', details: det});
    secret = true;
    await linkClaim(c, id, {silent: true});
  } catch (e){
    // لا غرض يتيم: حذف (الإدارة)، وإلا أرشفة مع قيد يشرح السبب
    // v14: الحذف (للمدير) في batch واحد مع قيد del_{id}. الموظف لا يحذف النقود ولا يؤرشفها قبل مدة الحفظ:
    // يبقى الغرض «متاحاً» مُعلَّماً (createdFrom) مع قيد يشرح السبب، فيربطه الموظف لاحقاً أو يحذفه المدير
    try {
      const b = dbx.batch();
      if (secret) b.delete(dbx.ref('itemSecrets/' + id));
      b.delete(dbx.ref('items/' + id));
      log(b, c.officeId, 'delete', {itemId: id, id: 'del_' + id, claimId: c.id, note: tAr('sys.cashUndo')});
      await b.commit();
    } catch {
      try { const b = dbx.batch(); log(b, c.officeId, 'cashUndo', {itemId: id, claimId: c.id, note: tAr('sys.cashUndo')}); await b.commit(); } catch (e2){ console.warn(e2); }
    }
    throw e;
  }
  return approveClaim(c, {action: 'approveCash', direct: true});
}
/* H11: طلب مجمّع بلا مطابقة بعد 30 يوماً: يُغلق «منتهياً» (عند فتح لوحة الموظف)، ويُبلَّغ صاحبه */
export async function expireGroupClaim(c){
  if (!c?.grouped || c.itemId || c.status !== 'pending' || S.links[c.id] || c.uid === S.uid) return false;
  const b = dbx.batch();
  closeClaim(b, c, {status: 'expired', note: tAr('sys.noMatch'), decidedAt: Date.now(), decidedBy: S.uid});
  log(b, c.officeId, 'expire', {claimId: c.id, note: tAr('sys.noMatch')});
  await commit(b);
  return true;
}

export async function approveClaim(c, {reason = '', action = 'approve', direct = false} = {}){
  notMine(c);
  if (c.status !== 'pending') fail(t('wf.notPending'));
  // H11: الطلب المجمّع يُقبل بعد ربطه بغرض فقط؛ ويُكتب رقم الغرض في الطلب عند القبول النهائي (لا قبله)
  const linked = c.grouped && !c.itemId ? S.links[c.id]?.itemId || '' : '';
  if (c.grouped && !c.itemId && !linked) fail(t('wf.needLink'));
  const i = await freshItem(c.itemId || linked);
  // H14: القبول بموظف واحد لكل التصنيفات (لا موافقة ثانية ولا حقل approvals)
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
  b.update(dbx.ref('claims/' + c.id), {status: 'approved', decidedAt: Date.now(), decidedBy: S.uid, pickupBy, ...(note ? {note} : {}),
    ...(linked ? {itemId: linked} : {})});
  itemUpdate(b, i, {status: 'reserved', reservedFor: c.id, updatedAt: Date.now()});
  log(b, i.officeId, action, {itemId: i.id, claimId: c.id, note, direct});
  await commit(b, true);
  return 'approved';
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
  // H14: الغرض المتاح يعود «مقبولاً» مباشرة لكل التصنيفات
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
  closeClaim(b, c, {status: 'rejected', note: String(note || '').slice(0, 200), decidedAt: Date.now(), decidedBy: S.uid});
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
   receiver: {name, last4} من طابق الموظف بطاقته (المستلم الفعلي، وقد يكون مفوّضاً)، تُحفظ في handoverNote بالطلب.
   checks (v7): مفاتيح فحوص التسليم حسب التصنيف التي علّمها الموظف كلها؛ تُحفظ في قيد السجل بلا أي بيانات شخصية */
export async function verifyHandover(c, receiver = {}, checks = [], code = ''){
  notMine(c);
  /* H19: سبب الرفض محدد: صلاحية، أو الطلب ليس مقبولاً، أو الغرض محجوز لغيره، أو رمز خاطئ.
     الرمز نفسه يُفحص على الخادم (القواعد تحسب بصمته وتقارنها بـ claimCodes)، فلا مقارنة هنا */
  if (!S.isAdmin && !(S.staffDoc?.offices || []).includes(c.officeId)) fail(t('wf.hoPerm'));
  if (c.codeHash && !S.isAdmin) fail(t('st.legacyAdmin'));   // v14: الرموز القديمة (6 أرقام) للمدير فقط
  if (!/^[A-Z0-9]{6,8}$/.test(code)) fail(t('a.codeWrong'));
  if (c.status !== 'approved') fail(t('wf.hoNotApproved'));
  const i = await freshItem(c.itemId);
  if (i.status === 'reserved' && i.reservedFor !== c.id) fail(t('wf.hoOther'));
  if (i.status !== 'reserved' || i.reservedFor !== c.id) fail(t('wf.notReserved'));
  const name = String(receiver.name || '').trim().slice(0, 120), last4 = String(receiver.last4 || '').trim();
  if (name.length < 3 || !/^\d{4}$/.test(last4)) fail(t('wf.needReceiver'));
  const b = dbx.batch();
  closeClaim(b, c, {status: 'done', doneAt: Date.now(), doneBy: S.uid, handoverNote: tAr('sys.receivedBy', {name, last4}), handoverCode: code});
  itemUpdate(b, i, {status: 'returned', returnedAt: Date.now(), updatedAt: Date.now()});
  // اختُبر في المحاكي: التسليم + إغلاق 3 منافسين (بصورهم وحصصهم) يبقى ضمن حد القراءات في batch واحد
  const skippedOwn = await closeOthers(b, i, c.id, 'rejected', tAr('sys.handedVerified'));
  log(b, i.officeId, 'handover', {itemId: i.id, claimId: c.id, note: tAr('sys.receivedBy', {name, last4}), checks: checks.map(String).slice(0, 10)});
  // رفض القواعد: نقرأ الطلب والغرض من جديد لنعرف السبب؛ إن لم يتغيرا فالرمز لا يطابق البصمة
  await commit(b, true).catch(async e => {
    if (!(e instanceof FlowError)) throw e;
    const [c2, i2] = await Promise.all([dbx.get('claims/' + c.id).catch(() => null), dbx.get('items/' + i.id).catch(() => null)]);
    if (c2 && c2.status !== 'approved') fail(t('wf.hoNotApproved'));
    if (i2 && i2.reservedFor !== c.id) fail(t('wf.hoOther'));
    fail(t('a.codeWrong'));
  });
  return {skippedOwn};
}

/* v9: صاحب الطلب يسحب طلبه قيد المراجعة. قبل سؤال الموظف: يُحذف. بعده: «إلغاء» (يبقى الطلب،
   فلا يُحذف ويُعاد إرساله لتخمين إجابة السؤال). في العملية نفسها: حذف صور الإثبات وإزالته من الحصة */
export const canDeleteOwnClaim = c => c?.status === 'pending' && !c.question;
export async function withdrawClaim(c){
  if (!c || c.uid !== S.uid || c.status !== 'pending') fail(t('wf.notPending'));
  const b = dbx.batch();
  for (let k = 0; k < (Number(c.proofs) || 0); k++) b.delete(dbx.ref(`claimProofs/${c.id}_${k}`));
  if (canDeleteOwnClaim(c)) b.delete(dbx.ref('claims/' + c.id));
  else b.update(dbx.ref('claims/' + c.id), {status: 'cancelled', cancelledAt: Date.now()});
  b.set(dbx.ref('claimQuota/' + c.uid), {open: arrayRemove(c.id)}, {merge: true});
  await b.commit();
}

/* v9/H14: صلاحيات الأغراض الثمينة (القواعد تفرضها أيضاً، والواجهة تخفي أزرارها):
   التسليم المباشر لغرض ثمين (بلا رمز استلام): للإدارة فقط.
   الحذف: للإدارة، أو للموظف إن كان مثالاً، أو متاحاً سُجّل قبل أقل من 24 ساعة وليس ثميناً (خطأ إدخال) */
export const canDirectReturn = i => S.isAdmin || !isHighValue(i?.cat);
/* v14 (H19) — القواعد تفرضها أيضاً:
   تخفيض التصنيف من ثمين إلى غير ثمين: للمدير فقط (الرفع إلى ثمين مسموح للموظف).
   الأرشفة والتصرّف: للمدير، أو بعد انتهاء مدة الحفظ (keepUntil، أو محسوبة لغرض قديم ليس فيه).
   أدلة التفاصيل السرية (اللون، الماركة، الوصف، الإجابات، المكان، المبنى، القاعة): للموظف خلال 24 ساعة من التسجيل فقط */
export const canChangeCat = (from, to) => S.isAdmin || from === to || !isHighValue(from) || isHighValue(to);
export const keepEnd = i => typeof i?.keepUntil === 'number' ? i.keepUntil : keepUntilOf(i?.cat, S.offices.find(o => o.id === i?.officeId), i?.foundDate);
export const canArchive = i => !!i && (S.isAdmin || (keepEnd(i) > 0 && keepEnd(i) <= Date.now()));
export const EVIDENCE = ['color', 'brand', 'desc', 'details', 'spot', 'bldg', 'room'];
export const evidenceLocked = i => !!i && !S.isAdmin && !((i.createdAt || 0) > Date.now() - 864e5);
export const canDeleteItem = i => !!i && (S.isAdmin || i.sample === true
  || (i.status === 'available' && typeof i.createdAt === 'number' && i.createdAt > Date.now() - 864e5 && !isHighValue(i.cat)));

/* v9: تعديل غرض من نموذج الموظف: batch واحد فيه update للحقول المعدّلة فقط (لا status ولا reservedFor ولا returnedAt
   ولا disposal)، والتفاصيل السرية كاملة، وقيد «تعديل» في السجل */
export async function editItem(i, patch, secret){
  for (const k of ['status', 'reservedFor', 'returnedAt', 'disposal', 'disposedAt', 'officeId', 'createdBy', 'createdAt', 'ref', 'sample', 'keepUntil', 'lastLog']) delete patch[k];
  if (patch.cat && !canChangeCat(i.cat, patch.cat)) fail(t('wf.hvDowngrade'));
  // v14: بعد 24 ساعة تبقى الأدلة كما سُجّلت (للموظف)، ويُكتب الباقي
  if (evidenceLocked(i)){ const old = S.secrets[i.id] || {}; for (const k of EVIDENCE){ if (old[k] !== undefined && old[k] !== '') secret[k] = old[k]; } }
  const b = dbx.batch();
  itemUpdate(b, i, {...patch, updatedAt: Date.now()}, {...secret, officeId: i.officeId});
  log(b, i.officeId, 'edit', {itemId: i.id});
  await commit(b);
}

/* إنهاء الحجز: انتهت مهلة الاستلام أو قرار الموظف. الطلب «انتهى» والغرض متاح */
export async function releaseReservation(c, note = tAr('sys.pickupEnded')){
  notMine(c);
  const b = dbx.batch();
  closeClaim(b, c, {status: 'expired', note, decidedAt: Date.now(), decidedBy: S.uid});
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
      closeClaim(b, held, {status: 'expired', note: tAr('sys.madeAvailable'), decidedAt: now, decidedBy: S.uid});
    }
  } else if (to === 'returned'){
    if (!canDirectReturn(i)) fail(t('wf.hvDirectAdmin'));
    if (String(note).trim().length < 6) fail(t('wf.needHandoverNote'));
    patch.returnedAt = now;
    // v14: merge (لا إعادة كتابة كاملة): الأدلة السرية تبقى كما هي حتى لو لم تُحمَّل محلياً
    b.set(dbx.ref('itemSecrets/' + i.id), {officeId: i.officeId, handoverNote: String(note).slice(0, 600)}, {merge: true});
    // H13a: التسليم (المباشر أيضاً) يرفض بقية الطلبات
    skippedOwn = await closeOthers(b, i, '', 'rejected', tAr('sys.handedDirect'));
  } else if (to === 'archived'){
    if (!canArchive(i)) fail(t('wf.keepNotOver'));
    skippedOwn = await closeOthers(b, i, '', 'cancelled', tAr('sys.archived'));
  } else fail(t('wf.badStatus'));
  itemUpdate(b, i, patch, secret);
  log(b, i.officeId, 'status:' + to, {itemId: i.id, note: to === 'returned' ? tAr('sys.directHandover') : note});
  await commit(b);
  return {skippedOwn};
}

/* بعد حفظ غرض (جديد أو معدَّل): قيد في السجل، ومعه في batch واحد:
   ترشيح الغرض لصاحب البلاغ (قبول بلاغ)، أو تأكيد استلام إشعار التسليم وربطه بالغرض.
   إنشاء الغرض نفسه يبقى قبل ذلك ومتسلسلاً (items ثم التفاصيل والصور) لأن قواعدها تستخدم get(). */
// ms (H9): مدة إضافة الغرض بالمللي ثانية، تُكتب في ملاحظة قيد الإنشاء «ms:<رقم>» فقط (بلا حقل جديد ولا تغيير في القواعد)
export const MS_NOTE = /^ms:(\d{1,9})$/;
export async function itemSaved(i, {created = false, fromReport = '', fromFound = '', ms = 0} = {}){
  const b = dbx.batch(); const now = Date.now();
  if (fromReport) b.update(dbx.ref('reports/' + fromReport), {staffPick: i.id, pickedAt: now});
  if (fromFound) b.update(dbx.ref('foundReports/' + fromFound), {status: 'received', receivedAt: now, receivedBy: S.uid, itemId: i.id});
  log(b, i.officeId, created ? 'create' : fromFound ? 'receive' : 'edit', {itemId: i.id, reportId: fromReport || fromFound, note: created && ms > 0 ? 'ms:' + Math.round(ms) : ''});
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
  const one = async (b, i, claims, now) => {
    if (!canArchive(i)) fail(t('wf.keepNotOver'));
    itemUpdate(b, i, {status: 'disposed', disposal: method, disposedAt: now, reservedFor: '', updatedAt: now});
    b.set(dbx.ref('itemSecrets/' + i.id), {officeId: i.officeId, disposalNote: String(note).slice(0, 600)}, {merge: true});   // v14: merge
    for (const o of claims) if (o.uid !== S.uid) closeClaim(b, o, {status: 'cancelled', note: tAr('sys.retentionEnded'), decidedAt: now, decidedBy: S.uid});
    log(b, i.officeId, 'dispose', {itemId: i.id, note: tAr('disposal.' + method) + (note ? ' — ' + note : '')});
    n++;
  };
  // H13a: طلبات كل غرض من الخادم. الغرض الذي له طلبات مفتوحة في batch وحده (مع إغلاقها)، والبقية معاً
  // في دفعات صغيرة (حد writeBatch في Firestore 500 عملية)
  const plain = [];
  for (const i of items){
    if (i.status !== 'available') continue;
    const claims = await openClaimsFor(i.id, i.officeId);
    if (!claims.length){ plain.push(i); continue; }
    const b = dbx.batch(); await one(b, i, claims, Date.now()); await commit(b);
  }
  for (let k = 0; k < plain.length; k += 60){
    const b = dbx.batch(); const now = Date.now();
    for (const i of plain.slice(k, k + 60)) await one(b, i, [], now);
    await commit(b);
  }
  return n;
}

/* حذف غرض: تُلغى طلباته المفتوحة، وتُحذف صوره وتفاصيله السرية، ثم الغرض نفسه، في batch واحد.
   القواعد ترفض حذف مستند غير موجود، لذلك نضيف الموجود فقط. */
export async function deleteItem(i){
  if (!canDeleteItem(i)) fail(t('wf.cantDelete'));
  const b = dbx.batch();
  const skippedOwn = await closeOthers(b, i, '', 'cancelled', tAr('sys.deleted'));
  if (pubPhoto(i)) b.delete(dbx.ref('itemPhotos/' + i.id));
  // القواعد ترفض حذف مستند غير موجود (تقرأ resource.data)، فنتأكد من وجود الأصل الخاص والتفاصيل السرية قبل حذفهما
  // (الأمثلة من مكاتب أخرى ليست في الاشتراك المحلي)
  if (['clear', 'blur', 'none'].includes(i.photo) && await dbx.get('itemPhotosPrivate/' + i.id).catch(() => null)) b.delete(dbx.ref('itemPhotosPrivate/' + i.id));
  if (S.secrets[i.id] || await dbx.get('itemSecrets/' + i.id).catch(() => null)) b.delete(dbx.ref('itemSecrets/' + i.id));
  b.delete(dbx.ref('items/' + i.id));
  // v14: قيد الحذف بالرقم الثابت del_{itemId} (القواعد تشترطه في الـ batch نفسه)
  log(b, i.officeId, 'delete', {itemId: i.id, id: 'del_' + i.id, note: full(i).title || i.ref});
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

/* H8: قيد «نسخة احتياطية» في سجل العمليات (من صدّرها ومتى، وعدد السجلات). التصدير نفسه قراءة فقط */
export async function logBackup(officeId, note){
  const b = dbx.batch();
  log(b, officeId, 'backup', {note});
  await commit(b);
}
