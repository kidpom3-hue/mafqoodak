// حالة التطبيق والاشتراك في البيانات من Firestore
import { auth, db, dbx, configured, onAuthStateChanged, getRedirectResult, deleteField } from './firebase.js';
import { LS, matchScore, toast, dayNum, subKey, setSpotHook, tokens, norm } from './utils.js';
import { t, LANG, saved, setLang } from './i18n.js';
import { oName, spotLabel, cat, catName, COLORS, autoSuggestOk, SUGG_STOP, claimOf, GROUP_DAYS, AMOUNT_TOL } from './constants.js';
import { SETTINGS } from './config.js';

// رابط مشاركة غرض: ./#item/<رقم المكتب>/<رقم الغرض> يفتح صفحة الغرض مباشرة
export const SHARE_RE = /^item\/([\w-]+)\/([\w-]+)$/;
// رابط مكتب (من ملصق QR المعلّق في المبنى): ./#o/<رقم المكتب> يفتح مفقودات هذا المكتب
export const OFFICE_RE = /^o\/([\w-]+)$/;
const SHARED = SHARE_RE.exec(location.hash.slice(1));
const OFFICE_LINK = OFFICE_RE.exec(location.hash.slice(1));
if (SHARED) LS.set('office', SHARED[1]);
else if (OFFICE_LINK) LS.set('office', OFFICE_LINK[1]);

export const S = {
  configured,
  authReady: false, uid: null, me: null,
  isAdmin: false, adminLoaded: false,
  rejecting: {},
  staffSub: {},         // H4: التبويب الفرعي المختار للموظف: {claims: 'decide'|'come'|'incoming'|'ended', reports: 'picked'|'open'|'closed'}        // G5: «ليس غرضي» ينتظر انتهاء مهلة «تراجع» (5 ثوانٍ): {reportId: [itemId]}
  config: null, configLoaded: false,
  offices: [], officesLoaded: false,
  // items: الأغراض النشطة (متاح ومحجوز) فقط. البقية تُجلب عند الحاجة حفاظاً على حصة القراءة اليومية
  items: [], itemsLoaded: false, reports: [], claims: [], allItems: [],
  myReports: [], myClaims: [],   // بلاغات المستخدم وطلباته في كل المكاتب
  links: {},                    // H11: ربط الطلبات المجمّعة بأغراض (claimLinks، للموظف فقط): {claimId: {itemId, by, at}}
  myFound: [], found: [],        // إشعارات التسليم: ما أبلغ المستخدم أنه وجده، وللموظف: المعلّقة في مكتبه
  itemCache: {},                 // غرض مفرد جُلب عند الحاجة (مُسلَّم أو من مكتب آخر): رقم ← غرض أو null
  extraItems: {},                // للموظف: المُسلَّم والمؤرشف والمُتصرَّف فيه عند اختيار الفلتر
  claimHist: null,               // للموظف: سجل الطلبات المنتهية عند الطلب
  counts: {},                    // أعداد من الخادم (getCountFromServer)
  stats: {},                     // الإحصاءات: رقم المكتب ← {items} (تُجلب عند فتح صفحتها فقط)
  logs: {},                      // للموظف: سجل الحيازة لكل غرض فُتح (رقم الغرض ← قائمة أو 'loading')
  finders: {},                   // للموظف: صاحب إشعار التسليم المرتبط بالغرض (رقم الإشعار ← uid)، لتنبيه تضارب المصالح
  showStale: false,              // للموظف: إظهار البلاغات القديمة (أكثر من 60 يوماً دون تجديد)
  adminList: [],                 // للإدارة: حسابات المديرين (admins)
  pubStats: {},                  // مؤشرات المكتب للزوار: رقم المكتب ← وثيقة publicStats أو null أو 'loading'
  audit: {},                     // للإدارة: «سجل العمليات» (مكتب|فلتر ← قائمة أو 'loading')
  verified: false,               // البريد موثّق؟
  secrets: {},   // تفاصيل المفقودات السرية (للموظف فقط): رقم الغرض ← {title, color, brand, desc, bldg, room, storage}
  staffDoc: null, staffLoaded: false, staffList: [], invites: [], priv: {},
  officeId: LS.get('office', null),
  mode: LS.get('mode', 'visitor'),
  // فتح صفحة محددة من اختصارات أيقونة التطبيق (مثل ./#report)
  route: SHARED ? {name: 'item', params: {id: SHARED[2]}} : {name: ['report', 'browse', 'mine', 'found', 'office', 'privacy', 'numbers', 'a11y', 'service'].includes(location.hash.slice(1)) ? location.hash.slice(1) : ({staff: 'staff', admin: 'admin'})[LS.get('mode', 'visitor')] || 'home', params: {}},
  hist: [],
  filter: {q: '', cat: 'all', status: 'available', range: 'all'},
  staffTab: 'items', staffQ: '', claimQ: '', staffStatus: 'active', adminTab: 'overview',
  sheet: null,
};

/* ربط الواجهة: changed = تحديث جزئي، reset = إعادة رسم كاملة */
let changedFn = () => {}, resetFn = () => {};
export function onChange(fn){ changedFn = fn; }
export function onReset(fn){ resetFn = fn; }
// نجمع التحديثات المتقاربة في رسم واحد (مثل وصول تفاصيل عشرات الأغراض معاً)
let changeTimer = null;
const changed = () => { if (changeTimer) return; changeTimer = setTimeout(() => { changeTimer = null; changedFn(); }, 16); };
const reset = () => resetFn();
// لوحدات أخرى (مثل الإحصاءات): إعادة رسم بعد وصول بيانات جلبتها بنفسها
export const touch = () => changed();

/* ---------- قراءات مساعدة ---------- */
export const curOffice = () => S.offices.find(o => o.id === S.officeId) || null;
export const ACTIVE = ['available', 'reserved'];
export const item = id => S.items.find(i => i.id === id)
  || Object.values(S.extraItems).flat().find(i => i.id === id) || S.itemCache[id] || null;
// جلب غرض غير محمّل (مرة واحدة)، ثم إعادة الرسم
const fetching = new Set();
export function ensureItem(id){
  if (!id || !db || item(id) || id in S.itemCache || fetching.has(id)) return;
  fetching.add(id);
  dbx.get('items/' + id).then(d => { S.itemCache[id] = d ? {id, ...d} : null; }).catch(() => { S.itemCache[id] = null; })
    .finally(() => { fetching.delete(id); watchSecrets(); changed(); });
}
// ما زال الغرض قيد التحميل؟ (ننتظر الاشتراك أو الجلب المفرد قبل أن نقول «غير موجود»)
export const itemLoading = id => !item(id) && (!S.itemsLoaded || fetching.has(id) || !(id in S.itemCache));
// الغرض كاملاً للموظف: البيانات العامة + التفاصيل السرية (تُستخدم في كل شاشات الموظف)
export const full = i => i ? {...i, ...(S.secrets[i.id] || {})} : i;
export const staffOffices = () => S.isAdmin ? S.offices.map(o => o.id) : (S.staffDoc?.offices || []);
// H18: المالك (config/app.ownerUid) وحده يقرر في طلبه هو (استثناء من فصل المهام)
export const isOwner = () => !!S.uid && S.config?.ownerUid === S.uid;
export const isStaffHere = () => !!S.officeId && staffOffices().includes(S.officeId);
export function modes(){ const m = ['visitor']; if (isStaffHere()) m.push('staff'); if (S.isAdmin) m.push('admin'); return m; }
export const homeRoute = () => S.mode === 'staff' ? 'staff' : S.mode === 'admin' ? 'admin' : 'home';
// G2: آخر حدث في البلاغ أو الطلب أو الإشعار؛ القوائم مرتّبة به (الأحدث أولاً)
export const lastAt = x => Math.max(0, ...['createdAt', 'editedAt', 'renewedAt', 'pickedAt', 'closedAt', 'askedAt', 'answeredAt', 'decidedAt', 'doneAt', 'ratedAt', 'receivedAt', 'cancelledAt']
  .map(k => typeof x?.[k] === 'number' ? x[k] : 0));
export const byLast = (a, b) => lastAt(b) - lastAt(a);
export const myReports = () => S.myReports.slice().sort(byLast);
export const myClaims = () => S.myClaims.slice().sort(byLast);
export const myFound = () => S.myFound.slice().sort(byLast);
export const officeName = id => oName(S.offices.find(o => o.id === id));
// اسم المكان بلغة الواجهة (من spotsEn في المكتب)
setSpotHook((s, officeId) => spotLabel(S.offices.find(o => o.id === (officeId || S.officeId)), s));
// سؤال التحقق: هل أجاب صاحب الطلب عن آخر سؤال؟ (الإجابة الأقدم من السؤال لا تُحسب)
export const answered = c => !!c?.answer && (c.answeredAt || 0) >= (c.askedAt || 0);
// G3: صاحب الطلب يعدّله ما دام قيد المراجعة ولم يسأله الموظف (القواعد تفرض ذلك أيضاً)
export const claimEditable = c => !!c && c.uid === S.uid && c.status === 'pending' && !c.question;
export const awaitingAnswer = c => c?.status === 'pending' && !!c.question && !answered(c);
/* تضارب المصالح: صاحب الطلب هو من سلّم الغرض (إشعار التسليم المرتبط به) أو الموظف الذي سجّله.
   صاحب الإشعار يُجلب مرة واحدة لكل غرض (get) */
export function ensureFinder(i){
  const f = i?.fromFound; if (!f || !db || f in S.finders) return;
  S.finders[f] = null;
  dbx.get('foundReports/' + f).then(d => { S.finders[f] = d?.uid || ''; }).catch(() => { S.finders[f] = ''; }).finally(changed);
}
export function conflictOf(c, i){
  if (!c || !i || !c.uid || c.uid === 'deleted') return '';
  if (i.fromFound){ ensureFinder(i); if (S.finders[i.fromFound] === c.uid) return 'finder'; }
  return i.createdBy === c.uid ? 'recorder' : '';
}
/* صلاحية البلاغ: المفتوح الذي مضى على إنشائه أو تجديده (renewedAt) أكثر من 60 يوماً يُسأل صاحبه «هل ما زلت تبحث؟»،
   ويُخفى عند الموظف افتراضياً ولا يدخل في مطابقة الأغراض الجديدة */
export const STALE_DAYS = 60;
export const isStale = r => r?.status === 'open' && Date.now() - (r.renewedAt || r.createdAt || 0) > STALE_DAYS * 864e5;
// رقم الطلب القصير (المرحلة F): REQ-XXXX يُحفظ عند الإنشاء، والطلبات القديمة يُشتق رقمها من آخر 4 أحرف من رقمها الطويل
export const claimNo = c => c?.no || ('REQ-' + String(c?.id || '').slice(-4).toUpperCase());
export const myCode = id => S.priv?.codes?.[id] || LS.get('codes', {})[id] || null;
export const MATCH_MIN = SETTINGS.matchThreshold;

/* G5: «ليس غرضي»: الأغراض التي رفضها صاحب البلاغ = القائمة rejected (تكبر فقط، 30 على الأكثر)
   + pickRejected القديم (قبل المرحلة G) + ما ضغط عليه الآن وما زالت مهلة «تراجع» جارية (S.rejecting) */
export const rejectedOf = r => new Set([...(Array.isArray(r?.rejected) ? r.rejected : []), ...(r?.pickRejected ? [r.pickRejected] : []), ...(S.rejecting[r?.id] || [])]);
// ترشيح الموظف ما دام الغرض متاحاً أو محجوزاً ولم يرفضه صاحب البلاغ
export function pickOf(r){
  if (!r?.staffPick) return null;
  const i = item(r.staffPick); if (!i){ ensureItem(r.staffPick); return null; }
  return ACTIVE.includes(i.status) && !rejectedOf(r).has(i.id) ? i : null;
}
// المرشحون لبلاغ: الزائر يقارن بالبيانات العامة فقط، والموظف يمرّر full ليقارن بالتفاصيل السرية أيضاً
// ما رفضه صاحب البلاغ («ليس غرضي») لا يُرشَّح له مرة أخرى
export function candidatesFor(r, n = 3, view = x => x){
  if (isStale(r)) return [];
  const no = rejectedOf(r);
  return S.items.filter(i => (i.status === 'available' || i.status === 'reserved') && !no.has(i.id))
    .map(i => ({i: view(i), s: matchScore(r, view(i))})).filter(x => x.s >= MATCH_MIN)
    .sort((a, b) => b.s - a.s).slice(0, n);
}

/* ---------- «قد يكون لك» للزائر (H10: أذكى وأقل إزعاجاً) ----------
   بالبيانات العامة فقط، بلا نسب مئوية. الشروط:
   - التصنيف يسمح بالاقتراح الآلي (autoSuggest، لا نقود ولا بطاقات ولا محافظ ولا مفاتيح ولا جوالات ولا مجوهرات)،
     والنوع نفسه إن حدّده البلاغ، وعُثر عليه بين يوم قبل الفقد و14 يوماً بعده؛
   - ودليل عام واحد على الأقل (publicClues): لون البلاغ = لون الغرض الظاهر في صورته العامة (pubColor)،
     أو كلمة مميزة مشتركة بين عنوان البلاغ ووصفه والعنوان العام للغرض (بلا اسم التصنيف والنوع والألوان والكلمات العامة).
   مكان العثور وماركة الغرض سريّان (هما من أسئلة إثبات الملكية)، فلا يُستعملان هنا */
const SUGG_DAYS = 14;
function distinct(text, catId){
  const skip = new Set([...tokens(`${catName(catId)} ${cat(catId).name} ${cat(catId).en || ''} ${cat(catId).subs.join(' ')} ${(cat(catId).subsEn || []).join(' ')}`),
    ...COLORS.flatMap(c => tokens(`${c.name} ${c.en} ${c.alt || ''} ${c.altEn || ''}`))]);
  return new Set(tokens(text).filter(w => w.length >= 3 && !skip.has(w) && !SUGG_STOP.has(w) && !/^\d+$/.test(w)));
}
export function publicClues(r, i){
  let n = 0;
  if (r.color && i.pubColor && r.color === i.pubColor) n++;
  const a = distinct(`${r.title || ''} ${r.desc || ''}`, r.cat), b = distinct(i.title || '', i.cat);
  for (const w of a) if (b.has(w)){ n++; break; }
  return n;
}
export function mayBeYours(r, i){
  if (!r || !i || r.cat !== i.cat || r.officeId !== i.officeId || !autoSuggestOk(r.cat)) return false;
  if (r.sub && subKey(i.sub) !== subKey(r.sub)) return false;
  const d = dayNum(i.foundDate) - dayNum(r.lostDate);
  if (!isNaN(d) && (d < -1 || d > SUGG_DAYS)) return false;
  return publicClues(r, i) > 0;
}
// ترشيح موظف نشط (أو غرضه ما زال يُحمَّل): يُخفي الاقتراحات الآلية لهذا البلاغ تماماً
const pickActive = r => { if (!r?.staffPick || rejectedOf(r).has(r.staffPick)) return false; const i = item(r.staffPick); return !i || ACTIVE.includes(i.status); };
/* المرشحون الآليون مرتّبين: الأبعد شبهاً بما رُفض أولاً (نفس التصنيف والنوع ويوم العثور = أولوية أقل)، ثم الأكثر أدلة، ثم الأحدث */
function autoRanked(r){
  const no = rejectedOf(r);
  const rej = [...no].map(id => item(id)).filter(Boolean);
  const like = i => rej.some(x => x.cat === i.cat && subKey(x.sub) === subKey(i.sub) && x.foundDate === i.foundDate) ? 1 : 0;
  return S.items.filter(i => ACTIVE.includes(i.status) && !no.has(i.id) && i.id !== r.staffPick && mayBeYours(r, i))
    .map(i => ({i, like: like(i), n: publicClues(r, i)}))
    .sort((a, b) => a.like - b.like || b.n - a.n || (b.i.createdAt || 0) - (a.i.createdAt || 0)).map(x => x.i);
}
/* اقتراح واحد في كل مرة: يبقى الاقتراح الحالي حتى يردّ عليه صاحب البلاغ («ليس غرضي» أو «هذا غرضي» فيصير له طلب)
   أو تمضي 7 أيام، ثم يظهر التالي. الحالي محفوظ على الجهاز: LS «suggHold» = {reportId: {id, at}} */
const HOLD_MS = 7 * 864e5;
export function suggestFor(r){
  if (!r || r.status !== 'open' || isStale(r) || pickActive(r)) return null;
  const list = autoRanked(r); if (!list.length) return null;
  const hold = LS.get('suggHold', {}), h = hold[r.id], cur = h && list.find(i => i.id === h.id);
  let pick = cur;
  if (!cur || Date.now() - h.at >= HOLD_MS) pick = (cur && list.find(i => i.id !== cur.id)) || list[0];
  if (!cur || pick.id !== cur.id){ hold[r.id] = {id: pick.id, at: Date.now()}; LS.set('suggHold', hold); }
  return pick;
}
/* مفتاح تنبيه الاقتراح الآلي: يتغيّر فقط حين يتغيّر «أفضل اقتراح واحد»، وتنبيه آلي واحد على الأكثر لكل بلاغ كل 24 ساعة
   (قبل مرور 24 ساعة يبقى المفتاح السابق، وهو مقروء، فلا تنبيه جديد). LS «suggAlert» = {reportId: {id, at}} */
const ALERT_GAP = 864e5;
function suggAlertKey(r, m){
  const all = LS.get('suggAlert', {}), last = all[r.id];
  if (last && last.id !== m.id && Date.now() - last.at < ALERT_GAP) return `m:${r.id}:${last.id}`;
  if (!last || last.id !== m.id){ all[r.id] = {id: m.id, at: Date.now()}; LS.set('suggAlert', all); }
  return `m:${r.id}:${m.id}`;
}

/* ---------- الموظف: مرشّح قوي (H10) ----------
   تطابق تفصيل سري واحد على الأقل بين البلاغ والغرض (full): إجابة سؤال التصنيف نفسها (المبلغ، آخر 4 أرقام، عدد المفاتيح…)،
   أو الماركة نفسها. (مكان العثور لا يكفي وحده: أغراض كثيرة تُوجد في المكان نفسه كالمكتبة) */
export function secretHit(r, fi){
  const a = r?.details || {}, b = fi?.details || {};
  if (Object.keys(a).some(k => a[k] && b[k] && norm(String(a[k])) === norm(String(b[k])))) return true;
  return !!(r?.brand && fi?.brand && norm(r.brand) === norm(fi.brand));
}
// مرشّحو الموظف: في التصنيفات بلا اقتراح آلي لا يظهر إلا ما طابق تفصيلاً سرياً
export const staffCands = (r, n = 3) => candidatesFor(r, 10, full).filter(x => autoSuggestOk(r.cat) || secretHit(r, x.i)).slice(0, n);
// «مرشّح محتمل»: بلاغ مفتوح بلا ترشيح، وأفضل مرشّح له (≥ MATCH_MIN) يطابق تفصيلاً سرياً
export const strongFor = r => r?.status === 'open' && !isStale(r) && !r.staffPick ? staffCands(r, 10).find(x => secretHit(r, x.i)) || null : null;

/* ---------- H11: الطلب المجمّع (بالوصف، بلا اختيار غرض) ----------
   صاحب الطلب يصف ما فقده في تصنيف مجمّع (نقود، بطاقات، محافظ، مفاتيح)، والموظف يربطه بالغرض الصحيح (claimLinks).
   itemId يبقى فارغاً في الطلب حتى القبول، فلا يرى صاحبه الغرض ولا المرشّحين قبل ذلك */
export const isGroupClaim = c => !!c?.grouped;
export const linkOf = c => (c && S.links[c.id]) || null;
// رقم الغرض عند الموظف: المكتوب في الطلب (بعد القبول)، أو المربوط في claimLinks (قبله)
export const claimItemId = c => c?.itemId || linkOf(c)?.itemId || '';
// الطلب بصيغة البلاغ لمقارنته بالأغراض (matchScore): الوصف، ومكان الفقد، وإجابات التصنيف (ومنها الاسم وآخر 4 أرقام للوثائق)
function groupRep(c){
  const det = {...(c.details || {})};
  for (const d of claimOf(c.cat).details) if (d.as && c[d.as] && !det[d.k]) det[d.k] = String(c[d.as]);
  return {cat: c.cat, sub: '', color: c.color || '', brand: c.brand || '', title: '', desc: c.proof || '', spot: c.lostSpot || '', bldg: c.bldg || '', lostDate: c.lostDate || '', details: det};
}
const amountOf = x => { const n = Number(String(x?.details?.amount || '').replace(/[^\d.]/g, '')); return n > 0 ? n : null; };
/* المرشّحون للطلب المجمّع (للموظف): فلاتر إلزامية ثم الترتيب بالمقارنة السرية، 3 على الأكثر:
   نفس المكتب والتصنيف، متاح، عُثر عليه بين يوم قبل الفقد و14 يوماً بعده، والمبلغ ضمن ±10% إن ذُكر في الطلب والغرض */
export function groupCands(c, n = 3){
  if (!isGroupClaim(c)) return [];
  const r = groupRep(c), a = amountOf(r);
  return S.items.filter(i => i.officeId === c.officeId && i.cat === c.cat && i.status === 'available')
    .map(i => full(i))
    .filter(i => {
      const d = dayNum(i.foundDate) - dayNum(r.lostDate);
      if (!isNaN(d) && (d < -1 || d > GROUP_DAYS)) return false;
      const b = amountOf(i);
      return !(a && b) || Math.abs(a - b) <= a * AMOUNT_TOL;
    })
    .map(i => ({i, s: matchScore(r, i)})).sort((x, y) => y.s - x.s).slice(0, n);
}
// الإجابة الرقمية الأساسية للتصنيف (المبلغ، عدد المفاتيح، آخر 4 أرقام من الوثيقة)
const keyNum = c => { const r = groupRep(c); for (const k of ['amount', 'keyCount', 'docLast4']) if (r.details[k]) return [k, r.details[k]]; return null; };
/* «مطابقة مؤكدة»: مرشّح واحد قوي فقط: إجابته الرقمية مطابقة تماماً + نفس المبنى أو المكان السري، ولا منافس ضمن 15 نقطة */
export function groupStrong(c, cands = groupCands(c)){
  const [top, second] = cands; if (!top) return null;
  const kn = keyNum(c); if (!kn || String(top.i.details?.[kn[0]] || '') !== String(kn[1])) return null;
  const r = groupRep(c);
  const place = (r.spot && top.i.spot && r.spot === top.i.spot) || (r.bldg && top.i.bldg && r.bldg === top.i.bldg);
  return place && (!second || second.s < top.s - 15) ? top : null;
}
/* سؤال تحقق جاهز يفرّق بين مرشّحين متقاربين (ضمن 15 نقطة): أول تفصيل سري مختلف بينهم لم يجب عنه صاحب الطلب
   (الفئات، الحاوية، الميدالية…)، وإلا المكان إن اختلف، وإلا سؤال عام. يرجع مفتاح السؤال في القاموس (gq.<k>) */
export function groupQuestion(c, cands = groupCands(c)){
  const close = cands.filter(x => x.s >= (cands[0]?.s || 0) - 15);
  if (close.length < 2) return '';
  const r = groupRep(c);
  for (const d of claimOf(c.cat).details){
    if (d.as || r.details[d.k]) continue;
    const vals = close.map(x => norm(String(x.i.details?.[d.k] || ''))).filter(Boolean);
    if (vals.length >= 2 && new Set(vals).size > 1) return 'gq.' + d.k;
  }
  const spots = close.map(x => x.i.spot || '').filter(Boolean);
  if (new Set(spots).size > 1) return 'gq.spot';
  return 'gq.any';
}

/* تنبيهات الزائر: ترشيح الموظف، وتغيّر حالة الطلب، والاقتراح الآلي الحالي لكل بلاغ (H10: يتغيّر مفتاحه مع الاقتراح الحالي فقط) */
export function alertKeys(){
  const keys = [];
  for (const r of myReports()){
    if (r.status !== 'open') continue;
    if (isStale(r)){ keys.push(`s:${r.id}:${r.renewedAt || r.createdAt}`); continue; }   // هل ما زلت تبحث؟
    // ترشيح الموظف ينبّه فقط ما دام الغرض متاحاً أو محجوزاً
    const pi = pickOf(r);
    if (pi) keys.push(`p:${r.id}:${pi.id}`);
    // الاقتراح الآلي: مفتاح يتغيّر مع «أفضل اقتراح واحد» فقط، ولا أكثر من تنبيه آلي كل 24 ساعة (ترشيح الموظف مستثنى)
    const m = suggestFor(r);
    if (m) keys.push(suggAlertKey(r, m));
  }
  for (const c of myClaims()){
    if (['approved', 'rejected', 'expired', 'cancelled'].includes(c.status)) keys.push(`c:${c.id}:${c.status}`);
    if (awaitingAnswer(c)) keys.push(`q:${c.id}:${c.askedAt}`);   // سؤال تحقق من المكتب بانتظار إجابتك
    // تقترب مهلة الاستلام (يومان أو أقل)
    if (c.status === 'approved' && c.pickupBy && c.pickupBy > Date.now() && c.pickupBy - Date.now() <= 2 * 864e5) keys.push(`d:${c.id}`);
  }
  // إشعار التسليم: استلمه المكتب، ثم عاد الغرض لصاحبه
  for (const f of S.myFound){
    if (f.status !== 'received') continue;
    keys.push(`f:${f.id}:r`);
    const it = f.itemId && item(f.itemId); if (f.itemId && !it) ensureItem(f.itemId);
    if (it?.status === 'returned') keys.push(`f:${f.id}:ret`);
    if (it?.status === 'disposed' && it.disposal === 'finder') keys.push(`f:${f.id}:fin`);   // أصبح الغرض لمن وجده
  }
  return keys;
}
/* H4: التنبيهات غير المقروءة حسب تبويب «طلباتي» وبطاقته. مفاتيح alertKeys: c/q/d = طلب استلام، p/m/s = بلاغ، f = إشعار تسليم.
   تُسجَّل مقروءة عند النقر على التبويب أو فتح البطاقة (markSeenKeys)، وتبقى كذلك بعد تحديث الصفحة (localStorage «seen») */
const TAB_OF = {c: 'claims', q: 'claims', d: 'claims', p: 'reports', m: 'reports', s: 'reports', f: 'found'};
export const keyTab = k => TAB_OF[String(k).split(':')[0]] || '';
export const keyCard = k => { const tab = keyTab(k); return tab ? {claims: 'c:', reports: 'r:', found: 'f:'}[tab] + String(k).split(':')[1] : ''; };
export function unseenKeys(){ const seen = new Set(LS.get('seen', [])); return alertKeys().filter(k => !seen.has(k)); }
export function markSeenKeys(keys){
  if (!keys?.length) return;
  const all = new Set([...LS.get('seen', []), ...keys]); LS.set('seen', [...all].slice(-400)); changed();
}
/* H5: أحداث الموظف الجديدة (مستقلة عن تنبيهات الزائر). كل حدث: k = المفتاح، sub = التبويب الفرعي، card = البطاقة، at = وقته.
   «قراري»: nc = طلب استلام جديد، na = إجابة جديدة عن سؤال التحقق.  «قادمة»: nf = إشعار تسليم جديد.
   «مفتوحة»: nr = بلاغ جديد، re = تعديل صاحب البلاغ.  «مرشّح محتمل» (H10): nm = مرشّح قوي جديد (تطابق تفصيل سري).  «لها مرشّح»: pr = ردّ صاحب البلاغ على الترشيح
   («ليس غرضي» أو طلب استلام الغرض المرشّح). مجرد وجود ترشيح بانتظار الرد ليس حدثاً.
   المقروء في localStorage «staffSeen» = {since, keys}: since وقت أول استخدام، فالأحداث الأقدم منه لا تُعدّ جديدة
   (فلا تظهر كل البطاقات جديدة في أول مرة)، وkeys ما سُجّل مقروءاً بعد ذلك، فيبقى مقروءاً بعد تحديث الصفحة */
function staffSeen(){
  let v = LS.get('staffSeen', null);
  if (!v || !v.since){ v = {since: Date.now(), keys: []}; LS.set('staffSeen', v); }
  return v;
}
export function staffEvents(){
  if (!isStaffHere()) return [];
  const out = [], add = (k, sub, card, at) => out.push({k, sub, card, at});
  for (const c of S.claims){
    if (c.status !== 'pending' || c.uid === S.uid) continue;
    add('nc:' + c.id, 'claims:decide', 's:' + c.id, c.createdAt);
    if (answered(c)) add(`na:${c.id}:${c.answeredAt}`, 'claims:decide', 's:' + c.id, c.answeredAt);
    // H11: طلب مجمّع لم يُربط: أفضل مرشّح له حدث جديد (بوقت تسجيل الغرض)، فغرض جديد مطابق يظهر جديداً
    if (isGroupClaim(c) && !claimItemId(c)){ const top = groupCands(c, 1)[0]; if (top) add(`gm:${c.id}:${top.i.id}`, 'claims:decide', 's:' + c.id, top.i.createdAt || null); }
  }
  for (const f of S.found) add('nf:' + f.id, 'claims:incoming', 'sf:' + f.id, f.createdAt);
  for (const r of S.reports){
    if (r.status !== 'open' || isStale(r)) continue;
    // H10: بلاغ بلا ترشيح وله مرشّح قوي (تطابق تفصيل سري) = «مرشّح محتمل»، وكل مرشّح قوي جديد حدث جديد (nm)
    const strong = strongFor(r);
    const sub = r.staffPick ? 'reports:picked' : strong ? 'reports:likely' : 'reports:open', card = 'sr:' + r.id;
    if (!r.staffPick) add('nr:' + r.id, sub, card, r.createdAt);
    if (strong) add(`nm:${r.id}:${strong.i.id}`, sub, card, strong.i.createdAt || null);
    if (r.editedAt) add(`re:${r.id}:${r.editedAt}`, sub, card, r.editedAt);
    if (!r.staffPick) continue;
    // ردّ صاحب البلاغ: «ليس غرضي» (لا وقت له، فيُعدّ جديداً حتى يُقرأ) أو طلب استلام للغرض المرشّح
    if (rejectedOf(r).has(r.staffPick)) add(`pr:${r.id}:no:${r.staffPick}`, sub, card, null);
    for (const c of S.claims) if (c.itemId === r.staffPick) add(`pr:${r.id}:claim:${c.id}`, sub, card, c.createdAt);
  }
  return out;
}
/* v7: البلاغ المرتبط بطلب الاستلام إن كان سابقاً للعثور (أُنشئ قبل تسجيل الغرض): أقوى دليل على الملكية.
   يُقرأ مرة واحدة إن لم يكن في بلاغات المكتب المحمّلة، ويجب أن يكون لصاحب الطلب نفسه */
const REP = {};
export function priorReport(c, i){
  if (!c?.reportId || !i) return null;
  let r = S.reports.find(x => x.id === c.reportId) || (S.closedReps || []).find(x => x.id === c.reportId) || REP[c.reportId];
  if (r === undefined){
    REP[c.reportId] = 'loading';
    dbx.get('reports/' + c.reportId).then(d => { REP[c.reportId] = d ? {id: c.reportId, ...d} : null; changed(); }).catch(() => { REP[c.reportId] = null; });
    return null;
  }
  if (!r || r === 'loading') return null;
  return r.uid === c.uid && typeof r.createdAt === 'number' && typeof i.createdAt === 'number' && r.createdAt < i.createdAt ? r : null;
}
/* v7: سجل صاحب الطلب في هذا المكتب (للموظف): عدد طلباته السابقة والمرفوض منها. قراءة واحدة عند فتح البطاقة، بلا اشتراك */
const HIST = {};
export function claimerHist(c, open){
  if (!c || c.uid === 'deleted' || !isStaffHere()) return null;
  const k = c.uid + '|' + c.officeId, h = HIST[k];
  if (h === undefined){
    if (!open) return null;
    HIST[k] = 'loading';
    dbx.list('claims', [['officeId', '==', c.officeId], ['uid', '==', c.uid]]).then(l => { HIST[k] = l; changed(); }).catch(() => { HIST[k] = []; });
    return null;
  }
  if (!Array.isArray(h)) return null;
  const others = h.filter(x => x.id !== c.id);
  return {n: others.length, rejected: others.filter(x => x.status === 'rejected').length};
}
// عند فتح بطاقة طلب بيد الموظف (actions.js): نبدأ قراءة سجل صاحبه
export const openClaimCard = id => { const c = S.claims.find(x => x.id === id) || (S.claimHist || []).find(x => x.id === id); if (c) claimerHist(c, true); };
// الأحداث التي لم تُرَ بعد
export function staffKeys(){
  const {since, keys} = staffSeen(), seen = new Set(keys);
  return staffEvents().filter(x => !seen.has(x.k) && !(x.at && x.at <= since));
}
export function markStaffSeen(keys){
  if (!keys?.length) return;
  const v = staffSeen(); v.keys = [...new Set([...v.keys, ...keys])].slice(-600); LS.set('staffSeen', v); changed();
}
// عدد البطاقات الجديدة في تبويب رئيسي للموظف (claims أو reports) أو تبويب فرعي («claims:decide»)
export const staffNew = prefix => new Set(staffKeys().filter(x => x.sub === prefix || x.sub.startsWith(prefix + ':')).map(x => x.card)).size;
// كل التنبيهات غير المقروءة لبطاقة واحدة في «طلباتي»: تُسجَّل مقروءة عند فتحها
export const unseenFor = card => unseenKeys().filter(k => keyCard(k) === card);
export function unseenCount(){ const seen = new Set(LS.get('seen', [])); return alertKeys().filter(k => !seen.has(k)).length; }
export function markSeen(){ const all = new Set([...LS.get('seen', []), ...alertKeys()]); LS.set('seen', [...all].slice(-400)); }

/* ---------- الاشتراكات ---------- */
const subs = {user: [], admin: [], items: [], rc: [], mine: []};
function clear(k){ subs[k].forEach(u => { try { u(); } catch {} }); subs[k] = []; }
const errH = where => e => console.warn('[firestore]', where, e?.code || e);

export function start(){
  if (!configured){ S.authReady = true; reset(); return; }
  dbx.watchDoc('config/app', d => { const had = !!S.config; S.config = d; S.configLoaded = true; if (had !== !!d) reset(); else changed(); },
    e => { errH('config')(e); S.configLoaded = true; reset(); });
  dbx.watch('offices', [], list => {
    S.offices = list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const first = !S.officesLoaded; S.officesLoaded = true;
    const active = S.offices.filter(o => o.active !== false);
    if (!curOffice() && active.length === 1){ setOffice(active[0].id, true); return; }
    // H19: وضع المكتب الواحد: الزائر يدخل مكتب الكلية مباشرة (بلا قائمة المواقع)
    if (!curOffice() && singleOffice()){ setOffice(singleOffice(), true); return; }
    fixMode(); ensureOfficeSubs();
    if (first || !curOffice()) reset(); else changed();
  }, e => { errH('offices')(e); S.officesLoaded = true; reset(); });
  onAuthStateChanged(auth, onUser);
  getRedirectResult(auth).catch(e => { const m = authErr(e); if (m) toast(m); });
}

function onUser(user){
  clear('user'); clear('admin');
  S.uid = user?.uid || null;
  S.me = user ? {name: user.displayName || (user.email || '').split('@')[0] || t('user.anon'), email: user.email || '', photo: user.photoURL || ''} : null;
  S.isAdmin = false; S.adminLoaded = !user; S.staffDoc = null; S.staffLoaded = !user;
  S.priv = {}; S.staffList = []; S.invites = []; S.allItems = []; S.adminList = []; S.audit = {};
  S.verified = !!user?.emailVerified;   // حسابات Google موثّقة تلقائياً
  clear('mine'); S.myReports = []; S.myClaims = []; S.myFound = [];
  S.authReady = true;
  if (user){
    saveProfile(user.uid, {name: S.me.name, photo: S.me.photo, lastSeen: Date.now(), ...(saved() ? {lang: LANG} : {})}, S.me.email);
    // لغة المستخدم المحفوظة في حسابه تُطبَّق إن لم يختر لغة على هذا الجهاز
    if (!saved()) dbx.get('users/' + user.uid).then(async d => { if (d?.lang && d.lang !== LANG){ await setLang(d.lang); if (auth) auth.languageCode = d.lang; reset(); } }).catch(() => {});
    subs.user.push(dbx.watchDoc('admins/' + user.uid, d => {
      const was = S.isAdmin; S.isAdmin = !!d; S.adminLoaded = true;
      if (S.isAdmin && !was) startAdmin();
      if (!S.isAdmin && was) clear('admin');
      fixMode(); ensureOfficeSubs(); changed();
    }, e => { errH('admins')(e); S.adminLoaded = true; fixMode(); }));
    subs.user.push(dbx.watchDoc('staff/' + user.uid, d => { S.staffDoc = d; S.staffLoaded = true; fixMode(); ensureOfficeSubs(); changed(); tryInvite(); },
      e => { errH('staff')(e); S.staffLoaded = true; fixMode(); }));
    subs.user.push(dbx.watchDoc('users/' + user.uid + '/private/codes', d => { S.priv = d || {}; changed(); }, errH('codes')));
    // «طلباتي»: بلاغات المستخدم وطلباته في كل المكاتب (بالمستخدم فقط، دون تقييد بالمكتب)
    subs.mine.push(dbx.watch('reports', [['uid', '==', user.uid]], l => { S.myReports = l; autoClose(); changed(); }, errH('my reports')));
    subs.mine.push(dbx.watch('claims', [['uid', '==', user.uid]], l => { S.myClaims = l; autoClose(); changed(); }, errH('my claims')));
    subs.mine.push(dbx.watch('foundReports', [['uid', '==', user.uid]], l => { S.myFound = l; changed(); }, errH('my found')));
  } else fixMode();
  ensureOfficeSubs();
  reset();
}
/* إغلاق البلاغ تلقائياً بعد استلام صاحبه الغرض من المكتب: لكل طلب «تم الاستلام»، يُغلق بلاغ المستخدم المفتوح
   المرتبط به (reportId، أو الغرض المرشَّح له) بسبب office. مرة واحدة لكل بلاغ، والفشل يُتجاهل (يُعاد عند الفتح التالي) */
const autoClosed = new Set();
function autoClose(){
  for (const c of S.myClaims){
    if (c.status !== 'done') continue;
    for (const r of S.myReports){
      if (r.status !== 'open' || autoClosed.has(r.id) || !(r.id === c.reportId || (r.staffPick && r.staffPick === c.itemId))) continue;
      autoClosed.add(r.id);
      dbx.update('reports/' + r.id, {status: 'closed', closedAt: Date.now(), closedReason: 'office'})   // H7: القواعد تقبل وقت «الآن» فقط.catch(e => console.warn('[auto close]', e?.code || e));
    }
  }
}
/* دعوة موظف: بعد تحميل وثيقة staff، إن لم يكن المستخدم موظفاً وبريده موثّقاً، نقرأ staffInvites/{بريده}
   وإن وُجدت نقبلها (workflow.acceptInvite). مرة واحدة لكل حساب وبريد؛ checkInvite() يعيد المحاولة بعد توثيق البريد.
   البريد غير الموثّق لا يقرأ الدعوة أصلاً (القواعد)، فتنتظر الدعوة حتى التوثيق */
let inviteTried = '';
async function tryInvite(){
  const u = auth?.currentUser;
  if (!u || !u.emailVerified || !u.email || !S.staffLoaded || S.staffDoc || u.uid !== S.uid) return;
  const email = u.email.trim().toLowerCase(), key = u.uid + '|' + email;
  if (inviteTried === key) return; inviteTried = key;
  try {
    const inv = await dbx.get('staffInvites/' + email);
    if (!inv?.offices?.length) return;
    const wf = await import('./workflow.js');   // استيراد عند الحاجة (workflow.js يستورد state.js)
    await wf.acceptInvite(email, inv);
    toast(t('inv.accepted'));
  } catch (e){ console.warn('[invite]', e?.code || e); }
}
export function checkInvite(){ inviteTried = ''; tryInvite(); }
function startAdmin(){
  clear('admin');
  subs.admin.push(dbx.watch('staff', [], l => { S.staffList = l; changed(); }, errH('staff list')));
  subs.admin.push(dbx.watch('staffInvites', [], l => { S.invites = l; changed(); }, errH('invites')));
  subs.admin.push(dbx.watch('admins', [], l => { S.adminList = l; changed(); }, errH('admins list')));
  // لا اشتراك في كل أغراض كل المكاتب: الأرقام تُجلب بـ getCountFromServer عند فتح «نظرة عامة»
}

let itemsKey = null, rcKey = null;
export function ensureOfficeSubs(){
  if (!db) return;
  /* H16: موظف المكتب والإدارة يشتركون في كل الأغراض النشطة (ومنها النقود)؛ الزائر في العامة فقط (public == true)،
     وإلا رفضت القواعد v11 الاستعلام. يتغير الاشتراك حين تصل صلاحية الموظف */
  const hid = isStaffHere();
  if (itemsKey !== `${S.officeId}|${hid}`){
    itemsKey = `${S.officeId}|${hid}`; clear('items'); S.items = []; S.itemsLoaded = false; S.counts = {}; S.extraItems = {}; S.claimHist = null; S.closedReps = null; S.logs = {};
    // الأغراض النشطة فقط (متاح ومحجوز): المُسلَّم القديم لا يُحمَّل لكل زائر
    if (S.officeId){
      subs.items.push(dbx.watch('items', [['officeId', '==', S.officeId], ['status', 'in', ACTIVE], ...(hid ? [] : [['public', '==', true]])], l => { S.items = l; S.itemsLoaded = true; watchSecrets(); changed(); },
        e => { errH('items')(e); S.itemsLoaded = true; changed(); }));
      refreshCounts();
    }
  }
  const staffView = isStaffHere();
  const k = `${S.officeId}|${S.uid}|${staffView}`;
  if (rcKey !== k){
    rcKey = k; clear('rc'); S.reports = []; S.claims = []; S.found = []; S.links = {}; S.secrets = {}; S.claimHist = null; S.closedReps = null;
    secSubs.forEach(u => { try { u(); } catch {} }); secSubs.clear();
    // للموظف فقط: البلاغات المفتوحة، والطلبات المفتوحة (قيد المراجعة والمقبولة)، والتفاصيل السرية لمكتبه.
    // الزائر يرى بلاغاته وطلباته من اشتراك «طلباتي» بالأعلى.
    if (S.officeId && S.uid && staffView){
      const o = ['officeId', '==', S.officeId];
      subs.rc.push(dbx.watch('reports', [o, ['status', '==', 'open']], l => { S.reports = l; changed(); }, errH('reports')));
      subs.rc.push(dbx.watch('claims', [o, ['status', 'in', ['pending', 'approved']]], l => { S.claims = l; changed(); }, errH('claims')));
      // إشعارات التسليم المعلّقة: من وجد غرضاً وسيسلّمه للمكتب
      subs.rc.push(dbx.watch('foundReports', [o, ['status', '==', 'pending']], l => { S.found = l; changed(); }, errH('found')));
      // H11: روابط الطلبات المجمّعة بأغراض المكتب (الموظف وحده يراها)
      subs.rc.push(dbx.watch('claimLinks', [o], l => { S.links = Object.fromEntries(l.map(x => [x.id, x])); changed(); }, errH('links')));
      watchSecrets();
    }
  }
}

// التفاصيل السرية للموظف: مستمع لكل غرض محمّل فقط (النشطة، وما جُلب عند الطلب)،
// بدل الاشتراك في تفاصيل كل أغراض المكتب القديمة
const secSubs = new Map();
export function watchSecrets(){
  if (!isStaffHere() || !S.uid) return;
  const ids = [...S.items, ...Object.values(S.extraItems).flat(), ...Object.values(S.itemCache).filter(Boolean)]
    .filter(i => i.officeId === S.officeId).map(i => i.id);
  for (const id of ids){
    if (secSubs.has(id)) continue;
    secSubs.set(id, dbx.watchDoc('itemSecrets/' + id, d => { if (d) S.secrets[id] = {id, ...d}; else delete S.secrets[id]; changed(); }, () => {}));
  }
}
// عدد المُسلَّم لأصحابه في المكتب (قراءة واحدة بدل تحميل كل الأغراض القديمة)
export function refreshCounts(){
  const id = S.officeId; if (!id || !db) return;
  // H16: الزائر يعدّ العام فقط (القواعد ترفض غيره)
  dbx.count('items', [['officeId', '==', id], ['status', '==', 'returned'], ...(isStaffHere() ? [] : [['public', '==', true]])])
    .then(n => { if (S.officeId === id){ S.counts.returned = n; changed(); } }).catch(errH('count'));
}
// للمالك: أعداد كل مكتب عند فتح «نظرة عامة» (4 استعلامات عدّ لكل مكتب بدل الاشتراك في كل الأغراض)
let adminLoading = false;
export async function loadAdminCounts(force = false){
  if (adminLoading || (S.counts.admin && !force) || !db) return;
  adminLoading = true;
  try {
    const out = {};
    for (const o of S.offices){
      const n = st => dbx.count('items', [['officeId', '==', o.id], ['status', '==', st]]);
      const [available, reserved, returned, disposed] = await Promise.all(['available', 'reserved', 'returned', 'disposed'].map(n));
      out[o.id] = {available, reserved, returned, disposed};
    }
    S.counts.admin = out;
    S.counts.samples = await dbx.count('items', [['sample', '==', true]]);
  } catch (e){ errH('admin counts')(e); S.counts.admin = S.counts.admin || {}; }
  finally { adminLoading = false; changed(); }
}
// للموظف: جلب الأغراض غير النشطة عند اختيار الفلتر فقط (مرة واحدة لكل اختيار)
export async function loadExtraItems(status){
  const id = S.officeId; const list = status === 'all' ? ['returned', 'archived', 'disposed'] : [status];
  for (const st of list){
    try { S.extraItems[st] = await dbx.list('items', [['officeId', '==', id], ['status', '==', st]]); } catch (e){ errH('extra items')(e); S.extraItems[st] = []; }
  }
  watchSecrets(); changed();
}
// للموظف: سجل حيازة الغرض (قيود logs) عند فتح صفحته، مرة واحدة لكل غرض.
// القيود الجديدة تُضاف محلياً بعد كل عملية (commit في workflow.js) دون قراءة جديدة.
export async function ensureLogs(i){
  if (!i || !db || S.logs[i.id]) return;
  S.logs[i.id] = 'loading';
  try { S.logs[i.id] = (await dbx.list('logs', [['officeId', '==', i.officeId], ['itemId', '==', i.id]])).sort((a, b) => a.at - b.at); }
  catch (e){ errH('logs')(e); S.logs[i.id] = []; }
  changed();
}
// للإدارة: «سجل العمليات» لمكتب مختار، عند الطلب فقط (officeId == و action in)
export const AUDIT = {
  handover: ['status:returned'], delete: ['delete'], dispose: ['dispose'],
  perms: ['perm:grant', 'perm:revoke', 'perm:admin', 'perm:unadmin'],
  backup: ['backup'],   // H8: من صدّر نسخة احتياطية ومتى
};
export async function loadAudit(officeId, filter, force = false){
  const k = officeId + '|' + filter; if (!db || !officeId || (S.audit[k] && !force)) return;
  const actions = filter === 'all' ? Object.values(AUDIT).flat() : AUDIT[filter] || [];
  S.audit[k] = 'loading'; changed();
  try { S.audit[k] = (await dbx.list('logs', [['officeId', '==', officeId], ['action', 'in', actions]])).sort((a, b) => b.at - a.at); }
  catch (e){ errH('audit')(e); S.audit[k] = []; }
  changed();
}
// للموظف: سجل الطلبات المنتهية عند الطلب
// البلاغات المغلقة لمكتب (للموظف، عند فتح «مغلقة» في تبويب البلاغات): قراءة واحدة عند الطلب، لا اشتراك
export async function loadClosedReports(){
  try { S.closedReps = await dbx.list('reports', [['officeId', '==', S.officeId], ['status', '==', 'closed']]); }
  catch (e){ errH('closed reports')(e); S.closedReps = []; }
  changed();
}
export async function loadClaimHistory(){
  try { S.claimHist = await dbx.list('claims', [['officeId', '==', S.officeId], ['status', 'in', ['done', 'rejected', 'expired', 'cancelled']]]); }
  catch (e){ errH('claim history')(e); S.claimHist = []; }
  changed();
}

/* H19: وضع المكتب الواحد (SETTINGS.singleOffice): رقم المكتب إن كان موجوداً ونشطاً، وإلا '' (السلوك القديم).
   الزائر لا يرى قائمة المواقع ولا أنواع المنشآت؛ الموظف والإدارة يبقى لهم تغيير الموقع */
export const singleOffice = () => { const id = SETTINGS.singleOffice || ''; return id && S.offices.some(o => o.id === id && o.active !== false) ? id : ''; };
export const singleMode = () => !!singleOffice() && !S.isAdmin && !staffOffices().length;
export function setOffice(id, silent){
  const changedOffice = id !== S.officeId;
  S.officeId = id; LS.set('office', id);
  fixMode(); ensureOfficeSubs();
  S.hist = []; S.route = {name: homeRoute(), params: {}}; S.sheet = null;
  reset(); window.scrollTo(0, 0);
  if (!silent && changedOffice) toast(t('office.entered', {name: oName(curOffice()) || t('office.generic')}));
}
export function fixMode(){
  // ننتظر تسجيل الدخول أيضاً: وإلا يعود الموظف إلى وضع الزائر إذا وصلت المواقع قبل حالة الدخول
  if (!S.authReady || !S.officesLoaded || (S.uid && (!S.staffLoaded || !S.adminLoaded))) return;
  if (!modes().includes(S.mode)){
    S.mode = 'visitor'; LS.set('mode', 'visitor');
    if (['staff', 'add', 'admin', 'officeForm', 'audit'].includes(S.route.name)) S.route = {name: 'home', params: {}};
  }
}

/* ---------- الصور وأسماء المستخدمين (مع ذاكرة مؤقتة) ---------- */
const PHOTO = new Map();
// مفاتيح الصور: p_<id> الأصل الواضح (للموظفين)، r_<id> صورة بلاغ، وغير ذلك الصورة العامة للغرض
export const photoPath = key => key.startsWith('p_') ? 'itemPhotosPrivate/' + key.slice(2)
  : key.startsWith('r_') ? 'reportPhotos/' + key.slice(2)
  : key.startsWith('cp_') ? 'claimProofs/' + key.slice(3)   // v7: صور إثبات طلب الاستلام (للموظف وصاحب الطلب فقط)
  : 'itemPhotos/' + key;
export function getPhoto(key){
  if (PHOTO.has(key)) return PHOTO.get(key);
  const p = db ? dbx.get(photoPath(key)).then(d => d?.data || null).catch(() => null) : Promise.resolve(null);
  PHOTO.set(key, p);
  p.then(v => { if (!v) PHOTO.delete(key); });   // لا نحفظ النتيجة الفارغة؛ قد تُرفع الصورة بعد لحظات
  return p;
}
/* H18: البريد خاص: users/{uid}/private/profile {email} يقرؤه صاحبه والإدارة فقط؛ users/{uid} العام (الاسم والصورة واللغة
   وآخر دخول) يقرؤه الموظفون. كل دخول يكتب الاثنين في batch واحد ويحذف email القديم من الوثيقة العامة (ترحيل تلقائي) */
export function saveProfile(uid, pub, email){
  const b = dbx.batch();
  if (email) b.set(dbx.ref(`users/${uid}/private/profile`), {email});
  b.set(dbx.ref('users/' + uid), {...pub, email: deleteField()}, {merge: true});
  return b.commit().catch(errH('users'));
}
// بريد مستخدم (للإدارة فقط؛ لغيرها يرفض الخادم فيعود فارغاً)
const EMAILS = new Map();
export function getEmail(uid){
  if (!EMAILS.has(uid)) EMAILS.set(uid, dbx.get(`users/${uid}/private/profile`).then(d => typeof d?.email === 'string' ? d.email : '').catch(() => ''));
  return EMAILS.get(uid);
}
export const cachePhoto = (key, dataUrl) => { if (dataUrl) PHOTO.set(key, Promise.resolve(dataUrl)); else PHOTO.delete(key); };
const NAMES = new Map();
export function getName(uid){
  if (uid === S.uid) return Promise.resolve({name: t('user.you'), photo: S.me?.photo || ''});
  if (NAMES.has(uid)) return NAMES.get(uid);
  // صورة الحساب تُقبل من صور حسابات Google فقط (لا روابط تتبّع)
  const okPhoto = v => typeof v === 'string' && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(v);
  // H18: البريد ليس هنا (في private/profile، للإدارة فقط عبر getEmail)
  const p = dbx.get('users/' + uid).then(d => ({name: d?.name || t('user.anon'), photo: okPhoto(d?.photo) ? d.photo : ''})).catch(() => ({name: t('user.anon'), photo: ''}));
  NAMES.set(uid, p); return p;
}

/* ---------- الكتابة مع رسائل أخطاء واضحة ---------- */
/* H7: إنشاء محدود (بلاغ، إشعار تسليم، طلب استلام) عبر dbx.createLimited. القواعد تسمح بإنشاء واحد كل 20 ثانية لكل حساب؛
   نتحقق على الجهاز أولاً، وعند رفض الخادم نقرأ rate/{uid}: إن كان الإنشاء السابق قريباً تظهر رسالة ودّية «انتظر قليلاً ثم أعد المحاولة» */
const RATE_MS = 20000;
const rateErr = () => Object.assign(new Error('rate'), {msg: t('err.rateWait'), code: 'rate'});
export async function createLimited(path, data, extra){
  if (Date.now() - (LS.get('rateAt', 0) || 0) < RATE_MS) throw rateErr();
  try { await dbx.createLimited(path, data, S.uid, extra); LS.set('rateAt', Date.now()); }
  catch (e){
    if (String(e?.code || '').includes('permission-denied')){
      const r = await dbx.get('rate/' + S.uid).catch(() => null);
      const at = typeof r?.at?.toMillis === 'function' ? r.at.toMillis() : +r?.at || 0;
      if (at && Date.now() - at < RATE_MS + 10000) throw rateErr();
    }
    throw e;
  }
}
export async function write(fn, okMsg){
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e){
    console.warn(e);
    if (e?.msg){ toast(e.msg); return false; }   // رسالة عربية جاهزة من workflow.js
    const c = e?.code || '';
    toast(t(c.includes('permission-denied') ? 'err.denied' : c.includes('resource-exhausted') ? 'err.quota'
      : c.includes('unavailable') ? 'err.offline' : c.includes('invalid-argument') ? 'err.invalid' : 'err.save'));
    return false;
  }
}
export function authErr(e){
  const c = e?.code || '';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return '';
  const k = [['invalid-credential', 'badCred'], ['wrong-password', 'badCred'], ['user-not-found', 'badCred'], ['email-already-in-use', 'emailUsed'],
    ['weak-password', 'weakPass'], ['invalid-email', 'badEmail'], ['too-many-requests', 'tooMany'], ['network-request-failed', 'offline'],
    ['unauthorized-domain', 'domain'], ['user-mismatch', 'mismatch'], ['operation-not-allowed', 'method']].find(([x]) => c.includes(x));
  return t('auth.' + (k ? k[1] : 'fail'));
}
