// عناصر واجهة مشتركة بين الصفحات
import { icon, otype, otypeName, oCity, brandOf, cat, CATS, COLORS, catName, colorName, subName, subLabel, spotLabel, claimOf, statusLabel, ITEM_STATUS } from '../constants.js';
import { t, hasKey } from '../i18n.js';
import { LS, esc, relDay, colorDot, isBuilding, roomWord, spotText, showTitle, when, fmtDate, isoDay } from '../utils.js';
import { aiReady } from '../firebase.js';   // H8: ai.js يُحمَّل عند الحاجة فقط
import { THEMES, theme, TEXTS, textSize } from '../theme.js';
import { S, isStaffHere, answered, singleMode } from '../state.js';

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
  const img = (src, k) => `<img class="br-logo ${k} ${cls}" src="${esc(src)}" alt="${t('br.logoAlt')}" decoding="async">`;
  const color = kind === 'mark' ? b.mark : b.logo, white = kind === 'mark' ? b.markWhite : b.logoWhite;
  return on === 'dark' ? img(white, 'on-dark') : img(color, 'lg-l') + img(white, 'lg-d');
}
export function collegeLinks(o, cls = ''){
  const b = brandOf(o); if (!b?.links?.length) return '';
  return `<ul class="br-links ${cls}">${b.links.map(l => `<li><a class="link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon(l.k === 'x' ? 'share' : l.k === 'lms' ? 'book' : l.k === 'rayat' ? 'idcard' : 'college')}<span>${t('br.link.' + l.k)}</span>${icon('ext', 'ext')}<span class="sr-only">${t('br.newTab')}</span></a></li>`).join('')}</ul>`;
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
  return `<button class="mini" data-act="openItem" data-id="${esc(i.id)}">${thumbHtml(i)}<span class="grow"><b>${esc(showTitle(i))}</b><span class="meta">${i.color ? colorDot(i.color) + esc(colorName(i.color)) + ' · ' : ''}${place ? esc(place) + ' · ' : ''}${relDay(i.foundDate)}</span></span>${extra}</button>`; };
// G2: سطر وقت دقيق صغير، مثل «أُرسل: الأحد 27 سبتمبر · 9:31 م»
export const whenLine = (key, ms) => ms ? `<span class="meta when">${icon('clock')}<span>${t(key, {when: when(ms)})}</span></span>` : '';
/* G2: مسار طلب الاستلام: خط عمودي صغير بالأحداث الموجودة فقط، مرتّبة بالوقت
   staff: نص «أجاب صاحب الطلب» بدل «أجبت» */
export function claimTimeline(c, staff = false){
  const ev = [['ctl.sent', c.createdAt]];
  if (c.askedAt) ev.push(['ctl.asked', c.askedAt]);
  if (c.answer && c.answeredAt) ev.push([staff ? 'ctl.answeredStaff' : 'ctl.answered', c.answeredAt]);
  if (c.editedAt) ev.push(['ctl.edited', c.editedAt]);
  if (c.decidedAt) ev.push(['ctl.dec.' + (c.status === 'done' ? 'approved' : c.status), c.decidedAt]);
  if (c.doneAt) ev.push(['ctl.done', c.doneAt]);
  // H20: سحبه صاحبه
  if (c.cancelledAt) ev.push([staff ? 'ctl.withdrawnStaff' : 'ctl.withdrawn', c.cancelledAt]);
  ev.sort((a, b) => a[1] - b[1]);
  // آخر موعد للاستلام: للطلب المقبول (أو الذي انتهت مهلته)، وقد يكون في المستقبل
  if (c.pickupBy && ['approved', 'expired'].includes(c.status)) ev.push(['ctl.pickupBy', c.pickupBy, c.pickupBy > Date.now()]);
  return `<ol class="ctl" aria-label="${t('ctl.title')}">${ev.filter(e => typeof e[1] === 'number' && e[1] > 0)
    .map(([k, ms, future]) => `<li${future ? ' class="future"' : ''}><b>${t(k)}</b> <span>${when(ms)}</span></li>`).join('')}</ol>`;
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
export function mcard({key, id = '', open, head, pillHtml, next, tone = '', body, fresh, muted}){
  return `<details class="mcard${tone === 'warn' ? ' attn' : ''}${fresh ? ' new' : ''}${muted ? ' muted' : ''}" data-card="${esc(key)}"${id ? ` id="${esc(id)}"` : ''} ${openOf(key, open) ? 'open' : ''}>
    <summary class="mcard-sum"><span class="mcard-top"><span class="mcard-h">${head}</span>${pillHtml}</span>
      <span class="next ${tone}">${icon(tone === 'warn' ? 'alert' : 'fwd')}<span>${next}</span></span></summary>
    <div class="mcard-body">${body}</div>
  </details>`;
}
export const person = uid => `<span class="person"><img data-avatar="${esc(uid)}" alt="" hidden><span data-uname="${esc(uid)}"></span></span>`;

// ids (H9): جزء من التصنيفات فقط (الأزرار السريعة في نموذج الإضافة، ثم البقية داخل «كل التصنيفات»)
export function catPicker(sel, ids = null){
  const list = ids ? ids.map(id => CATS.find(c => c.id === id)).filter(Boolean) : CATS;
  return `<div class="catpick" role="radiogroup" aria-label="${t('c.category')}">${list.map(c => `<label><input type="radio" name="cat" value="${c.id}" ${sel === c.id ? 'checked' : ''}>${icon(c.icon)}<span>${esc(catName(c.id))}</span></label>`).join('')}</div>`;
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
export function catFields(catId, src = {}, mode = 'item', part = ''){
  if (!catId) return '';
  const q = claimOf(catId), det = src?.details || {};
  const show = req => !part || (part === 'req') === !!req;
  const opt = on => on ? '' : ` <span class="hint">${t('c.optional')}</span>`;
  const colorLabel = hasKey(`df.${catId}.color`) ? t(`df.${catId}.color`) : t(mode === 'claim' ? 'cl.color' : 'c.color');
  const brandReq = mode === 'claim' && q.req.includes('brand');
  const out = [];
  if (q.fields.includes('color') && show(mode === 'claim' && q.req.includes('color'))) out.push(`<div class="field"><span class="label">${colorLabel}</span>${colorPicker(src?.color || '', mode === 'claim')}</div>`);
  if (q.fields.includes('brand') && mode !== 'report' && show(brandReq)) out.push(`<div class="field"><label for="cf-brand">${t('if.brand')}${mode === 'item' ? ` <span class="hint">${t('if.staffOnly')}</span>` : opt(brandReq)}</label>
    <input id="cf-brand" name="brand" class="input" maxlength="40" autocomplete="off" value="${esc(src?.brand || '')}" ${mode === 'item' ? `placeholder="${t('if.brandPh')}"` : ''}></div>`);
  for (const d of q.details){
    if (mode === 'claim' && d.as) continue;   // الاسم وآخر 4 أرقام في صندوق الهوية أصلاً
    const id = `cf-${d.k}`, v = det[d.k] || '', req = detailReq(d, mode);
    if (!show(req)) continue;
    const lab = `<label for="${id}">${dfLabel(catId, d.k)}${opt(req)}</label>`;
    const ph = hasKey(`df.${d.k}.ph`) ? ` placeholder="${esc(t(`df.${d.k}.ph`))}"` : '';
    const input = d.type === 'pick'
      ? `<select id="${id}" name="d_${d.k}" class="input"><option value="">${t('df.pickNone')}</option>${d.opts.map(o => `<option value="${o}" ${v === o ? 'selected' : ''}>${dfOpt(d.k, o)}</option>`).join('')}</select>`
      : d.type === 'text' ? `<input id="${id}" name="d_${d.k}" class="input" maxlength="80" autocomplete="off" value="${esc(v)}"${ph}>`
      : `<input id="${id}" name="d_${d.k}" class="input num-in" inputmode="numeric" dir="ltr" autocomplete="off" maxlength="${d.type === 'last4' ? 4 : 9}" value="${esc(v)}"${ph}>`;
    out.push(`<div class="field${req ? ' req' : ''}">${lab}${input}</div>`);
  }
  return out.join('');
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
