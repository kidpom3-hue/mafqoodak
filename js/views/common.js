// عناصر واجهة مشتركة بين الصفحات
import { icon, cat, CATS, COLORS, colorName } from '../constants.js';
import { esc, relDay, colorDot } from '../utils.js';
import { aiReady } from '../ai.js';

/* حالة نموذج الإدخال الحالي (الصورة المختارة) */
// copyFrom: مفتاح صورة بلاغ تُنسخ للغرض عند قبول البلاغ (مثل r_abc)
export const FORM = {photo: null, blob: null, removed: false, hadPhoto: false, copyFrom: null};
export function resetForm(hadPhoto = false, copyFrom = null){ Object.assign(FORM, {photo: null, blob: null, removed: false, hadPhoto, copyFrom}); }

export const backBtn = (label = 'رجوع') => `<button class="back" data-act="back">${icon('back')}${label}</button>`;

export function thumbHtml(i, cls = 'row-thumb'){
  const c = cat(i.cat);
  return `<div class="${cls}">${icon(c.icon)}${i.photo && !c.sensitive ? `<img data-photo="${esc(i.id)}" alt="" hidden>` : ''}</div>`;
}
export const miniItem = (i, extra = '') => `<button class="mini" data-act="openItem" data-id="${esc(i.id)}">${thumbHtml(i)}<span class="grow"><b>${esc(i.title)}</b><span class="meta">${colorDot(i.color)}${esc(colorName(i.color))} · ${esc(i.spot || '')} · ${relDay(i.foundDate)}</span></span>${extra}</button>`;
export const person = uid => `<span class="person"><img data-avatar="${esc(uid)}" alt="" hidden><span data-uname="${esc(uid)}"></span></span>`;

export function catPicker(sel){
  return `<div class="catpick" role="radiogroup" aria-label="التصنيف">${CATS.map(c => `<label><input type="radio" name="cat" value="${c.id}" ${sel === c.id ? 'checked' : ''}>${icon(c.icon)}<span>${esc(c.name)}</span></label>`).join('')}</div>`;
}
export function subsPicker(catId, sel){
  const subs = catId ? cat(catId).subs : [];
  if (!subs.length) return '';
  return `<div class="subs" role="radiogroup" aria-label="النوع">${subs.map(s => `<label><input type="radio" name="sub" value="${esc(s)}" ${sel === s ? 'checked' : ''}>${esc(s)}</label>`).join('')}</div>`;
}
export function colorPicker(sel){
  return `<div class="swatches" role="radiogroup" aria-label="اللون">${COLORS.map(c => `<label><input type="radio" name="color" value="${c.id}" ${sel === c.id ? 'checked' : ''}><span class="sw" style="background:${c.hex}"></span>${esc(c.name)}</label>`).join('')}</div>`;
}
export function photoField(existingKey, label){
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
  </div>
  <div class="note warn" id="sens-note" hidden>${icon('lock')}<span>لا ترفع صور البطاقات والوثائق الشخصية. اكتب في الوصف معلومة جزئية فقط، مثل أول حرف من الاسم أو آخر رقمين.</span></div>`;
}
export function spotOptions(o, sel){
  const spots = o?.spots || [];
  const extra = sel && !spots.includes(sel) ? [sel] : [];
  return `<option value="">لا أعرف / غير محدد</option>${[...spots, ...extra].map(s => `<option ${s === sel ? 'selected' : ''}>${esc(s)}</option>`).join('')}`;
}
export const loginPrompt = (msg) => `<div class="empty">${icon('lock')}<b>${msg}</b><button class="btn" data-act="login">${icon('users')}تسجيل الدخول</button></div>`;
