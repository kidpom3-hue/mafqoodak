// عناصر واجهة مشتركة بين الصفحات
import { icon, otype, otypeName, oCity, brandOf, cat, normCat, CATS, COLORS, catName, colorName, subName, subLabel, spotLabel, claimOf, statusLabel, ITEM_STATUS, latinDigits, detailValue } from '../constants.js';
import { t, hasKey } from '../i18n.js';
import { LS, esc, relDay, relTime, colorDot, isBuilding, roomWord, spotText, showTitle, when, fullWhen, fmtDate, fmtDateFull, isoDay, okMs, isoMs } from '../utils.js';
import { aiReady } from '../firebase.js';   // H8: ai.js يُحمَّل عند الحاجة فقط
import { THEMES, theme, TEXTS, textSize } from '../theme.js';
import { S, isStaffHere, answered, singleMode, lastAt } from '../state.js';

/* H27: هاتف المكتب رابط اتصال بلمسة (tel:) في الجوال. النص كما كتبه المكتب، والرابط أرقام فقط (و+ في أوله)،
   فلا يُحقن في href شيء من بيانات المكتب */
export function telLink(phone){
  const s = latinDigits(String(phone || '')).trim(), n = (s.startsWith('+') ? '+' : '') + s.replace(/\D/g, '');
  return n.replace('+', '').length >= 3
    ? `<a class="tel" href="tel:${n}" dir="ltr" aria-label="${t('c.callNum', {phone: esc(s)})}">${esc(phone)}</a>`
    : `<span dir="ltr">${esc(phone)}</span>`;
}
/* H19: نموذج من خطوات (البلاغ والطلب، 3 خطوات بحد أقصى). كل الخانات في النموذج نفسه (لا يضيع ما كُتب)،
   وتظهر خطوة واحدة فقط. stepper = مؤشر الخطوات أعلى النموذج؛ step = جسم خطوة بعنوانها؛ stepNav = «السابق/التالي».
   التنقل في actions.js (stepNext/stepPrev/showStep)، وخطأ الإرسال يفتح الخطوة التي فيها الخانة */
export const stepper = labels => `<ol class="stepper" aria-label="${t('step.aria')}">${labels.map((l, k) => `<li data-n="${k + 1}" ${k ? '' : 'aria-current="step" class="cur"'}><span class="sn" aria-hidden="true">${k + 1}</span><span class="sl">${l}</span></li>`).join('')}</ol>`;
export const step = (n, total, title, body) => `<div class="step" data-step="${n}" ${n > 1 ? 'hidden' : ''}>
  <h2 class="step-h" tabindex="-1"><span class="sr-only">${t('step.of', {n, total})}: </span>${title}</h2>${body}</div>`;
export const stepNav = (n, total) => n >= total ? '' : `<div class="step-nav">${n > 1 ? `<button type="button" class="btn ghost" data-act="stepPrev">${icon('back')}${t('step.prev')}</button>` : ''}<button type="button" class="btn" data-act="stepNext">${t('step.next')}${icon('fwd')}</button></div>`;
export const stepBack = () => `<button type="button" class="btn ghost step-back" data-act="stepPrev">${icon('back')}${t('step.prev')}</button>`;

/* H19: قائمة فارغة: عنوان واضح، وسطر يشرح ما يظهر هنا، وزر للخطوة التالية */
export const emptyBox = (ic, title, sub = '', act = '', cls = '') => `<div class="empty ${cls}">${icon(ic)}<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}${act}</div>`;
export const navBtn = (r, ic, label) => `<button class="btn soft" data-act="nav" data-r="${r}">${icon(ic)}${label}</button>`;

/* مدة مراجعة الطلب ومهلة الاستلام كما ضبطها المكتب (بحدود معقولة). H31: نُقلتا من gov.js (يُحمَّل عند الحاجة)
   لأن صفحة التأكيد بعد الإرسال (visitor.js) تحتاجهما أيضاً */
export const reviewDaysOf = o => Math.max(1, Math.min(30, Number(o?.reviewDays) || 2));
export const pickupDaysOf = o => Math.max(1, Math.min(60, Number(o?.pickupDays) || 7));

/* H19: سطر فوق اسم المكتب: نوع المنشأة والمدينة؛ في وضع المكتب الواحد المدينة فقط (لا أنواع منشآت للزائر) */
export const oKicker = o => singleMode() ? (oCity(o) ? icon('pin') + esc(oCity(o)) : '')
  : `${icon(otype(o.type).icon)}${esc(otypeName(o.type))}${oCity(o) ? ' · ' + esc(oCity(o)) : ''}`;

/* حالة نموذج الإدخال الحالي (الصورة المختارة) */
// copyFrom: مفتاح صورة بلاغ تُنسخ للغرض عند قبول البلاغ (مثل r_abc)
export const FORM = {photo: null, blob: null, removed: false, hadPhoto: false, copyFrom: null, proofs: [], t0: 0};   // proofs (v7): صور إثبات طلب الاستلام
// t0 (H9): وقت فتح النموذج، لقياس مدة إضافة الغرض (من الفتح إلى الحفظ)
export function resetForm(hadPhoto = false, copyFrom = null){ Object.assign(FORM, {photo: null, blob: null, removed: false, hadPhoto, copyFrom, proofs: [], t0: Date.now()}); }

/* ---------- الإضافة السريعة (H9) ----------
   آخر تصنيف ومكان عثور استخدمهما الموظف: في التخزين المحلي، لكل موظف (addPrefs:<uid>)، ويُختاران مسبقاً في غرض جديد.
   AGAIN: ما يبقى بعد «أضف آخر» (المكان وتفاصيله والتاريخ) لهذه الجلسة فقط */
export const addPrefs = () => LS.get('addPrefs:' + S.uid, {}) || {};
export const saveAddPrefs = p => LS.set('addPrefs:' + S.uid, {cat: String(p.cat || ''), spot: String(p.spot || '')});
export const AGAIN = {v: null};

/* ---------- هوية الكلية (H15) ----------
   brandLogo(o, on, cls, kind): شعار الجهة صوراً من المستودع (img-src 'self' في CSP).
   on: 'dark' = فوق خلفية داكنة دائماً (الواجهة الرئيسية والتذييل) → النسخة البيضاء الرسمية.
   on: 'light' = فوق سطح الصفحة → صورتان: الملوّنة تظهر في الوضع الفاتح والبيضاء في الداكن (CSS: .lg-l/.lg-d)،
   والمخفية بـ display:none لا يقرؤها قارئ الشاشة. kind: 'logo' (أفقي بالاسم) أو 'mark' (النجمة وحدها) */
export function brandLogo(o, on = 'light', cls = '', kind = 'logo'){
  const b = brandOf(o); if (!b) return '';
  // H21: width/height من BRANDS.size (مكان محجوز قبل التحميل)، وبلا decoding="async" حتى لا يُرسم فارغاً لحظة
  const img = (src, k) => { const [w, h] = b.size?.[src] || []; return `<img class="br-logo ${k} ${cls}" src="${esc(src)}" alt="${t('br.logoAlt')}"${w ? ` width="${w}" height="${h}"` : ''}>`; };
  const color = kind === 'mark' ? b.mark : b.logo, white = kind === 'mark' ? b.markWhite : b.logoWhite;
  return on === 'dark' ? img(white, 'on-dark') : img(color, 'lg-l') + img(white, 'lg-d');
}
export function collegeLinks(o, cls = ''){
  const b = brandOf(o); if (!b?.links?.length) return '';
  // H23: في الشبكة (صفحة المكتب) اسم قصير ووصف صغير تحته، والبطاقات بارتفاع واحد
  const grid = cls.includes('grid');
  return `<ul class="br-links ${cls}">${b.links.map(l => `<li><a class="link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon(l.k === 'x' ? 'share' : l.k === 'lms' ? 'book' : l.k === 'rayat' ? 'idcard' : 'college')}${grid ? `<span class="grow"><b>${t('br.link.' + l.k)}</b><small>${t('br.linkD.' + l.k)}</small></span>` : `<span>${t('br.link.' + l.k)}</span>`}${icon('ext', 'ext')}<span class="sr-only">${t('br.newTab')}</span></a></li>`).join('')}</ul>`;
}

// H13a: حالة غرض طلبٍ لم يعد متاحاً، بنص واضح: حُذف من المستودع، أو حالته الفعلية (سُلّم، مؤرشف، تُصرّف فيه)
export const orphanText = i => !i ? t('st.orphanGone') : t('st.orphanState', {status: esc(statusLabel(ITEM_STATUS[i.status] || ITEM_STATUS.archived))});
export const backBtn = (label = t('c.back')) => `<button class="back" data-act="back">${icon('back')}${label}</button>`;

/* ---------- صور المفقودات ----------
   items.photo: 'clear' واضحة للعامة، 'blur' مموّهة للعامة، 'none' مخفية عن العامة (الأصل عند الموظف)، false بلا صورة.
   true قيمة قديمة (قبل نقل الأغراض إلى الملف السري) وتعني صورة عامة واضحة. */
export const staffView = () => isStaffHere() && (S.mode === 'staff' || S.mode === 'admin');
export const pubPhoto = i => i.photo === 'clear' || i.photo === 'blur' || i.photo === true;
export const isBlur = i => !staffView() && i.photo === 'blur';
// وسم الصورة: الموظف يرى الأصل الواضح (p_)، والزائر يرى النسخة العامة فقط
export function photoImg(i, alt = ''){
  if (!i.photo || cat(i.cat).sensitive) return '';
  if (staffView()) return `<img data-photo="${esc(i.photo === true ? i.id : 'p_' + i.id)}" alt="${esc(alt)}" hidden>`;
  return pubPhoto(i) ? `<img data-photo="${esc(i.id)}" alt="${esc(alt)}" hidden>` : '';
}
export const blurBadge = i => isBlur(i) ? `<span class="blur-badge">${icon('lock')}${t('c.blurBadge')}</span>` : '';

export function thumbHtml(i, cls = 'row-thumb'){
  const c = cat(i.cat);
  return `<div class="${cls}${isBlur(i) ? ' blurred' : ''}">${icon(c.icon)}${photoImg(i)}</div>`;
}
// الموظف يمرّر full(i) فيظهر اللون ومكان العثور والمبنى والقاعة. الزائر يرى النوع والتاريخ فقط:
// مكان العثور سري (المرحلة E5) لأنه جواب «أين فقدته؟» في طلب الاستلام
export const miniItem = (i, extra = '') => { const place = staffView() ? spotText(i) : '';
  return `<button class="mini" data-act="openItem" data-id="${esc(i.id)}">${thumbHtml(i)}<span class="grow"><b>${esc(showTitle(i))}</b><span class="meta">${i.color ? colorDot(i.color) + esc(colorName(i.color)) + ' · ' : ''}${place ? esc(place) + ' · ' : ''}${relDayT(i.foundDate)}</span></span>${extra}</button>`; };
// G2: سطر وقت دقيق صغير، مثل «أُرسل: الأحد 27 سبتمبر · 9:31 م»
export const whenLine = (key, ms) => okMs(ms) ? `<span class="meta when">${icon('clock')}<time datetime="${isoMs(ms)}" title="${esc(fullWhen(ms))}">${t(key, {when: when(ms)})}</time></span>` : '';
// H23: وقت نسبي («قبل 3 أيام»، «اليوم») وعليه التاريخ الكامل تلميحاً عند المرور أو اللمس
export const relT = ms => okMs(ms) ? `<time title="${esc(fullWhen(ms))}">${relTime(ms)}</time>` : '';
export const relDayT = s => s ? `<time datetime="${esc(s)}" title="${esc(fmtDateFull(s))}">${relDay(s)}</time>` : '';
/* G2: مسار طلب الاستلام: خط عمودي صغير بالأحداث الموجودة فقط، مرتّبة بالوقت
   staff: نص «أجاب صاحب الطلب» بدل «أجبت».
   H34: كل تحديث على الطلب بتاريخه ووقته الكاملين، من إرساله حتى نهايته: ومنه التفويض بالاستلام والتقييم.
   timelineEvents = [مفتاح النص، الوقت] (يستخدمها أيضاً مسار الموظف المكتمل من السجل في staff.js) */
export function timelineEvents(c, staff = false){
  const ev = [['ctl.sent', c.createdAt]];
  if (c.askedAt) ev.push(['ctl.asked', c.askedAt]);
  if (c.answer && c.answeredAt) ev.push([staff ? 'ctl.answeredStaff' : 'ctl.answered', c.answeredAt]);
  if (c.editedAt) ev.push(['ctl.edited', c.editedAt]);
  if (c.decidedAt) ev.push(['ctl.dec.' + (c.status === 'done' ? 'approved' : c.status), c.decidedAt]);
  if (c.doneAt) ev.push(['ctl.done', c.doneAt]);
  // H20: سحبه صاحبه
  if (c.cancelledAt) ev.push([staff ? 'ctl.withdrawnStaff' : 'ctl.withdrawn', c.cancelledAt]);
  // H34: فوّض صاحبُ الطلب شخصاً بالاستلام (H33)، وقيّم الخدمة بعد الاستلام
  const d = delegateOf(c); if (d?.at) ev.push([staff ? 'ctl.delegatedStaff' : 'ctl.delegated', d.at]);
  if (c.ratedAt) ev.push([staff ? 'ctl.ratedStaff' : 'ctl.rated', c.ratedAt]);
  return ev.filter(e => okMs(e[1])).sort((a, b) => a[1] - b[1]);
}
// سطر حدث في المسار: النص، والتاريخ والوقت كاملان (<time datetime>)، ومن قام به وملاحظته (مسار الموظف فقط)
export const ctlRow = (label, ms, extra = '') => `<li><b>${label}</b> <time datetime="${isoMs(ms)}">${when(ms)}</time>${extra}</li>`;
export function claimTimeline(c, staff = false){
  // H23: آخر موعد للاستلام لا يُكرَّر هنا: يظهر في بطاقة الرمز (صاحب الطلب) وفي سطر المهلة (الموظف)
  return `<div class="ctl-box"><span class="ctl-h">${icon('clock')}${t('ctl.title')}</span>
    <ol class="ctl" aria-label="${t('ctl.title')}">${timelineEvents(c, staff).map(([k, ms]) => ctlRow(t(k), ms)).join('')}</ol></div>`;
}
// حالة الفتح والطي التي اختارها المستخدم (تبقى عند إعادة الرسم الحيّ): مفتاح البطاقة ← مفتوحة؟ (actions.js يحدّثها)
export const CARD_OPEN = new Map(), ENDED_OPEN = new Map();
const openOf = (key, dflt) => CARD_OPEN.has(key) ? CARD_OPEN.get(key) : !!dflt;
// بطاقة مختصرة: الملخّص (عنوان، رقم، حالة، الخطوة التالية) والتفاصيل عند الفتح
/* رقم التبويب (لـ«طلباتي» ولوحة الموظف): رقم واحد فقط، لا الرقمان معاً أبداً.
   فيه جديد غير مقروء ← الشارة الحمراء بعدد الجديد (مع نص لقارئ الشاشة)، وإلا ← الرقم الرمادي بعدد العناصر، ولا شيء إن كان صفراً */
export function tabNum(newCount, count){
  if (newCount) return `<span class="count"><span aria-hidden="true">${newCount}</span><span class="sr-only">${t('mine.newSr', {n: newCount})}</span></span>`;
  return count ? `<span class="tab-n">${count}</span>` : '';
}
// H34: upd = وقت آخر تحديث (ملّي ثانية): سطر صغير «آخر تحديث: قبل ساعة» في الملخّص، وعليه التاريخ الكامل تلميحاً
export const updOf = x => Math.max(lastAt(x), Number(x?.delegate?.at) || 0);
export function mcard({key, id = '', open, head, pillHtml, next, tone = '', body, fresh, muted, upd = 0}){
  return `<details class="mcard${tone === 'warn' ? ' attn' : ''}${fresh ? ' new' : ''}${muted ? ' muted' : ''}" data-card="${esc(key)}"${id ? ` id="${esc(id)}"` : ''} ${openOf(key, open) ? 'open' : ''}>
    <summary class="mcard-sum"><span class="mcard-top"><span class="mcard-h">${head}</span>${pillHtml}</span>
      <span class="next ${tone}">${icon(tone === 'warn' ? 'alert' : 'fwd')}<span>${next}</span></span>
      ${okMs(upd) ? `<span class="upd">${t('c.lastUpd', {when: relT(upd)})}</span>` : ''}</summary>
    <div class="mcard-body">${body}</div>
  </details>`;
}
export const person = uid => `<span class="person"><img data-avatar="${esc(uid)}" alt="" hidden><span data-uname="${esc(uid)}"></span></span>`;

// ids (H9): جزء من التصنيفات فقط (الأزرار السريعة في نموذج الإضافة، ثم البقية داخل «كل التصنيفات»)
export function catPicker(sel, ids = null){
  const list = ids ? ids.map(id => CATS.find(c => c.id === id)).filter(Boolean) : CATS;
  return `<div class="catpick${ids ? '' : ' all'}" role="radiogroup" aria-label="${t('c.category')}">${list.map(c => `<label><input type="radio" name="cat" value="${c.id}" ${normCat(sel) === c.id ? 'checked' : ''}>${icon(c.icon)}<span>${esc(catName(c.id))}</span></label>`).join('')}</div>`;
}
export function subsPicker(catId, sel){
  const subs = catId ? cat(catId).subs : []; sel = subName(sel);   // الاسم القديم يُختار باسمه الحالي
  if (!subs.length) return '';
  return `<div class="subs" role="radiogroup" aria-label="${t('c.type')}">${subs.map(s => `<label><input type="radio" name="sub" value="${esc(s)}" ${sel === s ? 'checked' : ''}>${esc(subLabel(s))}</label>`).join('')}</div>`;
}
// unknown: يضيف خيار «لا أتذكر» (في نموذج الاستلام)
export function colorPicker(sel, unknown = false){
  return `<div class="swatches" role="radiogroup" aria-label="${t('c.color')}">${unknown ? `<label><input type="radio" name="color" value="" ${!sel ? 'checked' : ''}><span class="sw sw-unknown">?</span>${t('c.dontRemember')}</label>` : ''}${COLORS.map(c => `<label><input type="radio" name="color" value="${c.id}" ${sel === c.id ? 'checked' : ''}><span class="sw" style="background:${c.hex}"></span>${esc(colorName(c.id))}</label>`).join('')}</div>`;
}
/* ---------- أسئلة التصنيف (المرحلة E) ----------
   تُرسم داخل <div id="cat-fields"> في نموذج الغرض (item) والبلاغ (report) والطلب (claim)، وتُعاد عند تغيير التصنيف.
   الخانات: اللون (color)، والماركة (brand)، وإجابات الأسئلة d_<k>. src: {color, brand, details} لتعبئتها */
// تسمية السؤال: الخاصة بالتصنيف (df.<cat>.<k>) إن وُجدت، وإلا العامة (df.<k>)
export const dfLabel = (catId, k) => t(hasKey(`df.${catId}.${k}`) ? `df.${catId}.${k}` : `df.${k}`);
// اسم خيار في سؤال اختيار (مثل «كان في»: ظرف، محفظة…)
export const dfOpt = (k, o) => t(`df.${k}.${o}`);
// هل السؤال إجباري في هذا النموذج؟ (البلاغ: كلها اختيارية)
export const detailReq = (d, mode) => mode === 'item' ? d.req === 'both' || d.req === 'staff' : mode === 'claim' ? d.req === 'both' || d.req === 'claim' : false;
/* H1: part يقسّم خانات طلب الاستلام: 'req' المطلوبة فقط (ظاهرة دائماً)، و'opt' الاختيارية فقط
   (داخل «تفاصيل إضافية» المطوية)، وبدونه كل الخانات (نموذج الغرض والبلاغ). العرض فقط: ما يُحفظ لا يتغيّر */
// H37: علامة الخانة الإلزامية (النجمة للعين فقط؛ required على الخانة نفسها لقارئ الشاشة)
export const reqMark = () => ` <span class="req-mark" aria-hidden="true">*</span>`;
/* H37: «اسم الغرض باختصار» (البلاغ ونموذج الغرض): بعد التصنيف مباشرة، إلزامي، 40 حرفاً مع عدّاد (data-count في actions.js)،
   ومثاله يتبدّل مع التصنيف (data-nameph، onCatChange) دون مسح ما كُتب. بلا لون في الأمثلة: اللون خانة مستقلة */
export const NAME_MAX = 40;
export const namePh = catId => { const k = 'nm.ph.' + normCat(catId); return t(catId && hasKey(k) ? k : 'nm.ph'); };
export function nameField(id, v, catId){
  v = String(v || '');
  return `<div class="field req"><label for="${id}">${t('rp.name')}${reqMark()}</label>
    <input id="${id}" name="title" class="input" required maxlength="${NAME_MAX}" data-count="1" data-nameph="1" autocomplete="off" aria-describedby="${id}-h" value="${esc(v)}" placeholder="${esc(namePh(catId))}">
    <div class="name-foot"><span class="hint" id="${id}-h">${t('nm.hint')}</span><span class="char-n" id="${id}-n" dir="ltr">${v.length}/${NAME_MAX}</span></div></div>`;
}
// H37: مثال الخانة حسب التصنيف (df.<cat>.<k>.ph) وإلا العام (df.<k>.ph)
const dfPh = (catId, k) => hasKey(`df.${catId}.${k}.ph`) ? t(`df.${catId}.${k}.ph`) : hasKey(`df.${k}.ph`) ? t(`df.${k}.ph`) : '';
export function catFields(catId, src = {}, mode = 'item', part = ''){
  if (!catId) return '';
  const q = claimOf(catId), det = src?.details || {};
  const show = req => !part || (part === 'req') === !!req;
  // H37: لا «(اختياري)» على الخانات: الإلزامية عليها نجمة، والاختيارية تحت سطر «تفاصيل إضافية»
  const opt = on => on ? reqMark() : '';
  const colorLabel = hasKey(`df.${catId}.color`) ? t(`df.${catId}.color`) : t(mode === 'claim' ? 'cl.color' : 'c.color');
  const brandReq = mode === 'claim' && q.req.includes('brand');
  const out = [], secret = [];
  if (q.fields.includes('color') && show(mode === 'claim' && q.req.includes('color'))) out.push(`<div class="field"><span class="label">${colorLabel}</span>${colorPicker(src?.color || '', mode === 'claim')}</div>`);
  const brandPh = hasKey(`if.brandPh.${catId}`) ? t(`if.brandPh.${catId}`) : t('if.brandPh');
  if (q.fields.includes('brand') && mode !== 'report' && show(brandReq)) out.push(`<div class="field"><label for="cf-brand">${t('if.brand')}${mode === 'item' ? ` <span class="hint">${t('if.staffOnly')}</span>` : opt(brandReq)}</label>
    <input id="cf-brand" name="brand" class="input" maxlength="40" autocomplete="off" value="${esc(src?.brand || '')}" placeholder="${esc(brandPh)}" ${brandReq ? 'required' : ''}></div>`);
  for (const d of q.details){
    if (mode === 'claim' && d.as) continue;   // الاسم وآخر 4 أرقام في صندوق الهوية أصلاً
    const id = `cf-${d.k}`, v = det[d.k] || '', req = detailReq(d, mode);
    // H33: المعرّف الفريد (الرقم التسلسلي، آخر 4 من بطاقة، النقش…) ظاهر دائماً مع المطلوب، ولو كان اختيارياً:
    // هو أقوى ما يثبت الملكية، فلا يُخفى في «تفاصيل إضافية»
    if (!show(req || !!d.unique)) continue;
    // (النص داخل span: التلميح flex، وكل عنصر فيه مباشرة يصبح قطعة مستقلة فينكسر ترتيب «*#06#»)
    const hk = hasKey(`df.${catId}.${d.k}.hint`) ? `df.${catId}.${d.k}.hint` : `df.${d.k}.hint`;
    const hint = d.unique && hasKey(hk) ? `<span class="hint">${icon('shield')}<span>${t(hk)}</span></span>` : '';
    const ph = dfPh(catId, d.k), phA = ph ? ` placeholder="${esc(ph)}"` : '';
    if (d.type === 'pick'){
      // H37: الاختيار أزرار سريعة (لا قائمة منسدلة)، وأولها «لا أعرف» (قيمة فارغة = لا شيء يُحفظ)
      // H41: القيمة القديمة بنص حر (قبل H37، مثل «STC» في بلاغ قديم) تُفهم عبر detailValue (SIM_ALIAS)، وإلا ظهرت «لا أعرف»
      // وضاعت الإجابة عند حفظ التعديل
      const opts = ['', ...d.opts], cur = detailValue(d, String(v));
      secret.push(`<div class="field${req ? ' req' : ''}"><span class="label" id="${id}-l">${dfLabel(catId, d.k)}${opt(req)}</span>
        <div class="subs pick" role="radiogroup" aria-labelledby="${id}-l">${opts.map(o => `<label><input type="radio" name="d_${d.k}" value="${o}" ${cur === o ? 'checked' : ''}>${o ? dfOpt(d.k, o) : t('df.pickUnknown')}</label>`).join('')}</div></div>`);
      continue;
    }
    const lab = `<label for="${id}">${dfLabel(catId, d.k)}${opt(req)}</label>`;
    const rq = req ? ' required' : '';
    const input = d.type === 'text' ? `<input id="${id}" name="d_${d.k}" class="input" maxlength="80" autocomplete="off" value="${esc(v)}"${phA}${rq}>`
      // H33: الرقم التسلسلي أو IMEI: يُلصق كاملاً (40 خانة) ويُحفظ آخر 4 منه فقط (detailValue). بلا .num-in (ذلك المرشّح يحذف الحروف).
      // H37: لوحة أرقام في الجوالات (IMEI أرقام)، وتحته «سيُحفظ: ••••4521» حين يُلصق رقم أطول (data-tail في actions.js)
      : d.type === 'tail' ? `<input id="${id}" name="d_${d.k}" class="input" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" data-tail="1" aria-describedby="${id}-save"${catId === 'phones' ? ' inputmode="numeric"' : ''} value="${esc(v)}"${phA}${rq}>
        <span class="hint tail-save" id="${id}-save" ${String(v).replace(/[^0-9A-Za-z]/g, '').length > 4 ? '' : 'hidden'}>${t('df.tailSave', {v: `<b dir="ltr">••••${esc(detailValue(d, v))}</b>`})}</span>`
      : `<input id="${id}" name="d_${d.k}" class="input num-in" inputmode="numeric" dir="ltr" autocomplete="off" maxlength="${d.type === 'last4' ? 4 : 9}" value="${esc(v)}"${phA}${rq}>`;
    secret.push(`<div class="field${req ? ' req' : ''}${d.unique ? ' uniq' : ''}">${lab}${input}${hint}</div>`);
  }
  // H37: سطر «تفاصيل إضافية» فوق الخانات الاختيارية (البلاغ ونموذج الغرض الكامل؛ في الإضافة السريعة هو عنوان «تفاصيل إضافية» المطوية)،
  // وتحت الخانات الخاصة (IMEI، الخلفية، الغطاء…): لا تظهر للعامة
  const all = [...out, ...secret];
  if (!all.length) return '';
  const head = mode !== 'claim' && !part ? `<p class="xd-h">${icon('plus')}<span>${t('xd.head')}</span></p>` : '';
  const lock = mode !== 'claim' && secret.length ? `<p class="hint xd-lock">${icon('lock')}<span>${t('xd.private')}</span></p>` : '';
  return head + all.join('') + lock;
}
// كيف تظهر صورة الغرض للعامة (يختارها الموظف)
export function photoModePicker(sel = 'blur'){
  const opts = ['clear', 'blur', 'none'];
  return `<div class="field" id="photo-mode"><span class="label">${t('c.photoMode')}</span>
    <div class="seg wide" role="radiogroup" aria-label="${t('c.photoModeAria')}">${opts.map(v => `<label class="seg-opt"><input type="radio" name="photoMode" value="${v}" ${sel === v ? 'checked' : ''}><span>${t('c.mode.' + v)}</span></label>`).join('')}</div>
    <span class="hint">${t('c.photoModeHint')}</span>
    <span class="hint">${t('c.blurColorHint')}</span></div>`;
}
// H20: locked = الصورة الأصلية دليل بعد 24 ساعة: لا تغيير ولا حذف (القواعد تفرضه للموظف)، وطريقة الظهور تبقى
export function photoField(existingKey, label, extra = '', locked = false){
  return `<div class="field" id="photo-field"><span class="label">${label}</span>
    <div class="photo-drop">
      <div class="pv" id="pv">${existingKey ? `<img data-photo="${esc(existingKey)}" alt="" hidden>` : ''}${icon('camera')}</div>
      <div class="col">
        ${locked ? '' : `<div class="btn-row">
          <span class="btn sm ghost filebtn">${icon('camera')}${t('c.pickPhoto')}<input type="file" accept="image/*" id="photo-in" aria-label="${t('c.pickPhoto')}"></span>
          <button type="button" class="btn sm ghost" data-act="removePhoto" id="rm-photo" ${existingKey ? '' : 'hidden'}>${icon('x')}${t('c.remove')}</button>
        </div>`}
        ${aiReady() ? `<button type="button" class="btn sm soft" data-act="aiFill" id="ai-btn" disabled>${icon('spark')}${t('c.aiFill')}</button>` : ''}
        <span class="ai-status" id="ai-status"></span>
      </div>
    </div>
    ${locked ? `<span class="hint">${icon('lock')}${t('st.photoLocked')}</span>` : ''}
    ${extra}
  </div>
  <div class="note warn" id="sens-note" hidden>${icon('lock')}<span>${t('c.sensNote')}</span></div>`;
}
export function spotOptions(o, sel){
  const spots = o?.spots || [];
  const extra = sel && !spots.includes(sel) ? [sel] : [];
  // القيمة المخزّنة عربية دائماً، والنص الظاهر بلغة الواجهة
  return `<option value="">${t('c.spotUnknown')}</option>${[...spots, ...extra].map(s => `<option value="${esc(s)}" ${s === sel ? 'selected' : ''}>${esc(spotLabel(o, s))}</option>`).join('')}`;
}
// خانتا رقم المبنى ورقم القاعة/المعمل: تظهران فقط إذا كان المكان المختار داخل مبنى
export function spotExtra(x){
  const s = x?.spot || '';
  return `<div class="two" id="spot-extra" ${isBuilding(s) ? '' : 'hidden'}>
    <div class="field"><label for="f-bldg">${t('c.bldgNo')}</label><input id="f-bldg" name="bldg" class="input" inputmode="numeric" maxlength="6" value="${esc(x?.bldg || '')}" placeholder="${t('c.egBldg')}"></div>
    <div class="field"><label for="f-room" id="room-label">${roomWord(s)}</label><input id="f-room" name="room" class="input" maxlength="10" value="${esc(x?.room || '')}" placeholder="${t('c.egRoom')}"></div>
  </div>`;
}
// البلاغات وطلبات الاستلام تشترط بريداً موثّقاً (القواعد تفرض ذلك أيضاً)
export const verifyPrompt = what => `<div class="empty">${icon('lock')}<b>${t('c.verifyTitle')}</b><span>${t('c.verifyBody', {what})}</span>
  <div class="btn-row" style="justify-content:center"><button class="btn" data-act="checkVerified">${icon('check')}${t('c.verified')}</button><button class="btn ghost" data-act="resendVerify">${t('c.resendLink')}</button></div></div>`;
// اختيار المظهر: تلقائي / فاتح / داكن (في نافذة الحساب وأسفل الصفحة الرئيسية)
// حجم الخط: عادي / كبير / أكبر (في نافذة الحساب وأسفل الصفحة الرئيسية، بجانب المظهر)
export const textPicker = () => `<div class="seg theme-seg text-seg" role="radiogroup" aria-label="${t('tx.label')}">${TEXTS.map((v, k) => `<button type="button" class="${textSize() === v ? 'on' : ''}" data-act="textSize" data-v="${v}" role="radio" aria-checked="${textSize() === v}"><span class="tx-a" style="font-size:${13 + 3 * k}px" aria-hidden="true">${t('tx.a')}</span><span>${t('tx.' + v)}</span></button>`).join('')}</div>`;
export const themePicker = () => `<div class="seg theme-seg" role="radiogroup" aria-label="${t('th.label')}">${THEMES.map(v => `<button type="button" class="${theme() === v ? 'on' : ''}" data-act="theme" data-v="${v}" role="radio" aria-checked="${theme() === v}">${icon(v === 'light' ? 'sun' : v === 'dark' ? 'moon' : 'contrast')}<span>${t('th.' + v)}</span></button>`).join('')}</div>`;
export const loginPrompt = (msg) => `<div class="empty">${icon('lock')}<b>${msg}</b><button class="btn" data-act="login">${icon('users')}${t('c.signIn')}</button></div>`;

/* H8: دوال يحتاجها الزائر أيضاً (كانت في staff.js)، فلا يُحمَّل ملف لوحة الموظف لعرض «طلباتي» */
// تاريخ يوم من وقت بالمللي ثانية («3 أكتوبر»)
export const dateOf = ms => fmtDate(isoDay(ms));
/* H33: المفوَّض بالاستلام في طلب الاستلام (اسمه وآخر 4 أرقام من هويته) بأنواع آمنة، أو null */
export function delegateOf(c){
  const d = c?.delegate;
  if (!d || typeof d !== 'object' || typeof d.name !== 'string' || typeof d.last4 !== 'string' || !/^\d{4}$/.test(d.last4)) return null;
  return {name: d.name.slice(0, 120), last4: d.last4, at: Number(d.at) || 0};
}
// سؤال التحقق وإجابته
export function qaBox(c){
  if (!c.question) return '';
  const ok = answered(c);
  return `<div class="qa">
    <div class="qa-q">${icon('question')}<span><b>${t('qa.q')}</b> ${esc(c.question)}</span></div>
    <div class="qa-a">${ok ? `<b>${t('qa.a')}</b> ${esc(c.answer)}` : `<span class="muted">${t(c.status === 'pending' ? 'qa.waiting' : 'qa.none')}</span>`}</div>
  </div>`;
}
// رابط صفحة المكتب (رمز QR في التذييل والملصق)
export const officeUrl = o => `${location.origin + location.pathname}#o/${o.id}`;

/* v7: بريد الكلية لطلب الاستلام (إعداد لكل مكتب: offices.claimDomains، يعدّله المالك). القائمة الفارغة = بلا قيد.
   البريد يقبل النطاق نفسه أو نطاقاً فرعياً منه (مثل stu.tvtc.edu.sa لـ tvtc.edu.sa)، لا نطاقاً يشبهه (eviltvtc.edu.sa) */
export const claimDomainsOf = o => (Array.isArray(o?.claimDomains) ? o.claimDomains : []).map(d => String(d).toLowerCase()).filter(Boolean);
export function claimEmailOk(o, email){
  const ds = claimDomainsOf(o); if (!ds.length) return true;
  const e = String(email || '').toLowerCase();
  return ds.some(d => e.endsWith('@' + d) || (e.includes('@') && e.endsWith('.' + d)));
}
// النطاق كما يكتبه المالك ← صيغة صالحة فقط (أحرف وأرقام وشرطة ونقاط، بلا @)
export const cleanDomain = d => { d = String(d || '').trim().toLowerCase().replace(/^@/, ''); return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : ''; };
// النمط الذي تتحقق به القواعد (claimDomainRe): البريد كاملاً ينتهي بأحد النطاقات أو نطاق فرعي منها
export const domainRe = ds => ds.length ? `.*@([a-z0-9-]+[.])*(${ds.map(d => d.replace(/\./g, '[.]')).join('|')})` : '';

