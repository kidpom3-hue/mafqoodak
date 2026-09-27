// عناصر واجهة مشتركة بين الصفحات
import { icon, cat, CATS, COLORS, catName, colorName, subName, subLabel, spotLabel } from '../constants.js';
import { t } from '../i18n.js';
import { esc, relDay, colorDot, isBuilding, roomWord, spotText, showTitle } from '../utils.js';
import { aiReady } from '../ai.js';
import { THEMES, theme } from '../theme.js';
import { S, isStaffHere } from '../state.js';

/* حالة نموذج الإدخال الحالي (الصورة المختارة) */
// copyFrom: مفتاح صورة بلاغ تُنسخ للغرض عند قبول البلاغ (مثل r_abc)
export const FORM = {photo: null, blob: null, removed: false, hadPhoto: false, copyFrom: null};
export function resetForm(hadPhoto = false, copyFrom = null){ Object.assign(FORM, {photo: null, blob: null, removed: false, hadPhoto, copyFrom}); }

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
// الموظف يمرّر full(i) فيظهر اللون والمبنى والقاعة، والزائر يرى المنطقة العامة فقط
export const miniItem = (i, extra = '') => `<button class="mini" data-act="openItem" data-id="${esc(i.id)}">${thumbHtml(i)}<span class="grow"><b>${esc(showTitle(i))}</b><span class="meta">${i.color ? colorDot(i.color) + esc(colorName(i.color)) + ' · ' : ''}${esc(spotText(i))} · ${relDay(i.foundDate)}</span></span>${extra}</button>`;
export const person = uid => `<span class="person"><img data-avatar="${esc(uid)}" alt="" hidden><span data-uname="${esc(uid)}"></span></span>`;

export function catPicker(sel){
  return `<div class="catpick" role="radiogroup" aria-label="${t('c.category')}">${CATS.map(c => `<label><input type="radio" name="cat" value="${c.id}" ${sel === c.id ? 'checked' : ''}>${icon(c.icon)}<span>${esc(catName(c.id))}</span></label>`).join('')}</div>`;
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
// كيف تظهر صورة الغرض للعامة (يختارها الموظف)
export function photoModePicker(sel = 'blur'){
  const opts = ['clear', 'blur', 'none'];
  return `<div class="field" id="photo-mode"><span class="label">${t('c.photoMode')}</span>
    <div class="seg wide" role="radiogroup" aria-label="${t('c.photoModeAria')}">${opts.map(v => `<label class="seg-opt"><input type="radio" name="photoMode" value="${v}" ${sel === v ? 'checked' : ''}><span>${t('c.mode.' + v)}</span></label>`).join('')}</div>
    <span class="hint">${t('c.photoModeHint')}</span></div>`;
}
export function photoField(existingKey, label, extra = ''){
  return `<div class="field" id="photo-field"><span class="label">${label}</span>
    <div class="photo-drop">
      <div class="pv" id="pv">${existingKey ? `<img data-photo="${esc(existingKey)}" alt="" hidden>` : ''}${icon('camera')}</div>
      <div class="col">
        <div class="btn-row">
          <span class="btn sm ghost filebtn">${icon('camera')}${t('c.pickPhoto')}<input type="file" accept="image/*" id="photo-in" aria-label="${t('c.pickPhoto')}"></span>
          <button type="button" class="btn sm ghost" data-act="removePhoto" id="rm-photo" ${existingKey ? '' : 'hidden'}>${icon('x')}${t('c.remove')}</button>
        </div>
        ${aiReady() ? `<button type="button" class="btn sm soft" data-act="aiFill" id="ai-btn" disabled>${icon('spark')}${t('c.aiFill')}</button>` : ''}
        <span class="ai-status" id="ai-status"></span>
      </div>
    </div>
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
export const themePicker = () => `<div class="seg theme-seg" role="radiogroup" aria-label="${t('th.label')}">${THEMES.map(v => `<button type="button" class="${theme() === v ? 'on' : ''}" data-act="theme" data-v="${v}" role="radio" aria-checked="${theme() === v}">${icon(v === 'light' ? 'sun' : v === 'dark' ? 'moon' : 'contrast')}<span>${t('th.' + v)}</span></button>`).join('')}</div>`;
export const loginPrompt = (msg) => `<div class="empty">${icon('lock')}<b>${msg}</b><button class="btn" data-act="login">${icon('users')}${t('c.signIn')}</button></div>`;
