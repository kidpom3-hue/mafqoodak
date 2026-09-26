// عناصر واجهة مشتركة بين الصفحات
import { icon, cat, CATS, COLORS, colorName } from '../constants.js';
import { esc, relDay, colorDot, isBuilding, roomWord, spotText } from '../utils.js';
import { aiReady } from '../ai.js';
import { S, isStaffHere } from '../state.js';

/* حالة نموذج الإدخال الحالي (الصورة المختارة) */
// copyFrom: مفتاح صورة بلاغ تُنسخ للغرض عند قبول البلاغ (مثل r_abc)
export const FORM = {photo: null, blob: null, removed: false, hadPhoto: false, copyFrom: null};
export function resetForm(hadPhoto = false, copyFrom = null){ Object.assign(FORM, {photo: null, blob: null, removed: false, hadPhoto, copyFrom}); }

export const backBtn = (label = 'رجوع') => `<button class="back" data-act="back">${icon('back')}${label}</button>`;

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
export const blurBadge = i => isBlur(i) ? `<span class="blur-badge">${icon('lock')}مموّهة لحماية صاحبها</span>` : '';

export function thumbHtml(i, cls = 'row-thumb'){
  const c = cat(i.cat);
  return `<div class="${cls}${isBlur(i) ? ' blurred' : ''}">${icon(c.icon)}${photoImg(i)}</div>`;
}
// الموظف يمرّر full(i) فيظهر اللون والمبنى والقاعة، والزائر يرى المنطقة العامة فقط
export const miniItem = (i, extra = '') => `<button class="mini" data-act="openItem" data-id="${esc(i.id)}">${thumbHtml(i)}<span class="grow"><b>${esc(i.title)}</b><span class="meta">${i.color ? colorDot(i.color) + esc(colorName(i.color)) + ' · ' : ''}${esc(spotText(i))} · ${relDay(i.foundDate)}</span></span>${extra}</button>`;
export const person = uid => `<span class="person"><img data-avatar="${esc(uid)}" alt="" hidden><span data-uname="${esc(uid)}"></span></span>`;

export function catPicker(sel){
  return `<div class="catpick" role="radiogroup" aria-label="التصنيف">${CATS.map(c => `<label><input type="radio" name="cat" value="${c.id}" ${sel === c.id ? 'checked' : ''}>${icon(c.icon)}<span>${esc(c.name)}</span></label>`).join('')}</div>`;
}
export function subsPicker(catId, sel){
  const subs = catId ? cat(catId).subs : [];
  if (!subs.length) return '';
  return `<div class="subs" role="radiogroup" aria-label="النوع">${subs.map(s => `<label><input type="radio" name="sub" value="${esc(s)}" ${sel === s ? 'checked' : ''}>${esc(s)}</label>`).join('')}</div>`;
}
// unknown: يضيف خيار «لا أتذكر» (في نموذج الاستلام)
export function colorPicker(sel, unknown = false){
  return `<div class="swatches" role="radiogroup" aria-label="اللون">${unknown ? `<label><input type="radio" name="color" value="" ${!sel ? 'checked' : ''}><span class="sw sw-unknown">؟</span>لا أتذكر</label>` : ''}${COLORS.map(c => `<label><input type="radio" name="color" value="${c.id}" ${sel === c.id ? 'checked' : ''}><span class="sw" style="background:${c.hex}"></span>${esc(c.name)}</label>`).join('')}</div>`;
}
// كيف تظهر صورة الغرض للعامة (يختارها الموظف)
export function photoModePicker(sel = 'blur'){
  const opts = [['clear', 'واضحة'], ['blur', 'مموّهة'], ['none', 'مخفية']];
  return `<div class="field" id="photo-mode"><span class="label">كيف تظهر الصورة للزوار؟</span>
    <div class="seg wide" role="radiogroup" aria-label="ظهور الصورة">${opts.map(([v, l]) => `<label class="seg-opt"><input type="radio" name="photoMode" value="${v}" ${sel === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <span class="hint">واضحة: لا تكشف ما يثبت الملكية. مموّهة: يظهر فيها لون أو ماركة أو علامة مميزة. مخفية: فيها معلومات شخصية مثل اسم أو رقم أو صورة شخص.</span></div>`;
}
export function photoField(existingKey, label, extra = ''){
  return `<div class="field" id="photo-field"><span class="label">${label}</span>
    <div class="photo-drop">
      <div class="pv" id="pv">${existingKey ? `<img data-photo="${esc(existingKey)}" alt="" hidden>` : ''}${icon('camera')}</div>
      <div class="col">
        <div class="btn-row">
          <span class="btn sm ghost filebtn">${icon('camera')}اختر صورة<input type="file" accept="image/*" id="photo-in" aria-label="اختر صورة"></span>
          <button type="button" class="btn sm ghost" data-act="removePhoto" id="rm-photo" ${existingKey ? '' : 'hidden'}>${icon('x')}إزالة</button>
        </div>
        ${aiReady() ? `<button type="button" class="btn sm soft" data-act="aiFill" id="ai-btn" disabled>${icon('spark')}تعبئة تلقائية من الصورة</button>` : ''}
        <span class="ai-status" id="ai-status"></span>
      </div>
    </div>
    ${extra}
  </div>
  <div class="note warn" id="sens-note" hidden>${icon('lock')}<span>لا ترفع صور البطاقات والوثائق الشخصية. اكتب في الوصف معلومة جزئية فقط، مثل أول حرف من الاسم أو آخر رقمين.</span></div>`;
}
export function spotOptions(o, sel){
  const spots = o?.spots || [];
  const extra = sel && !spots.includes(sel) ? [sel] : [];
  return `<option value="">لا أعرف / غير محدد</option>${[...spots, ...extra].map(s => `<option ${s === sel ? 'selected' : ''}>${esc(s)}</option>`).join('')}`;
}
// خانتا رقم المبنى ورقم القاعة/المعمل: تظهران فقط إذا كان المكان المختار داخل مبنى
export function spotExtra(x){
  const s = x?.spot || '';
  return `<div class="two" id="spot-extra" ${isBuilding(s) ? '' : 'hidden'}>
    <div class="field"><label for="f-bldg">رقم المبنى</label><input id="f-bldg" name="bldg" class="input" inputmode="numeric" maxlength="6" value="${esc(x?.bldg || '')}" placeholder="مثال: 3"></div>
    <div class="field"><label for="f-room" id="room-label">رقم ${roomWord(s)}</label><input id="f-room" name="room" class="input" maxlength="10" value="${esc(x?.room || '')}" placeholder="مثال: 105"></div>
  </div>`;
}
export const loginPrompt = (msg) => `<div class="empty">${icon('lock')}<b>${msg}</b><button class="btn" data-act="login">${icon('users')}تسجيل الدخول</button></div>`;
