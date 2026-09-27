// صفحة «سياسة الخصوصية وشروط الاستخدام»
// كُتبت لتناسب نظام حماية البيانات الشخصية في المملكة العربية السعودية.
// نصوصها في القاموسين (pv.*). النص العربي هو المعتمد، والإنجليزي ترجمة تذكر ذلك أعلى الصفحة.
// ملاحظة للمطوّر: يُفضَّل أن تراجعها الشؤون القانونية في الكلية قبل الإطلاق الرسمي.
import { icon, oName, oPlace } from '../constants.js';
import { esc, fmtDate } from '../utils.js';
import { S, curOffice } from '../state.js';
import { SETTINGS } from '../config.js';
import { backBtn } from './common.js';
import { t, isEn } from '../i18n.js';
import { emailReady } from '../notify.js';

// تاريخ آخر تحديث لسياسة الخصوصية وشروط الاستخدام: غيّره هنا فقط عند تعديل نصوصهما
export const LEGAL_UPDATED = '2026-09-28';
const SECTIONS = ['about', 'data', 'why', 'who', 'where', 'keep', 'rights', 'terms'];

export function vPrivacy(){
  const o = curOffice() || SETTINGS.firstOffice;
  const contact = [oPlace(o) && t('pv.officeAt', {place: oPlace(o)}), o.phone && t('pv.phone', {phone: o.phone})].filter(Boolean).join(' — ');
  // المتغيرات تمر عبر esc لأنها بيانات المكتب
  const vars = {office: esc(oName(o)), contact: contact ? ` (${esc(contact)})` : '', ai: SETTINGS.enableAI ? t('pv.ai') : '', email: emailReady() ? t('pv.email') : ''};
  const sec = k => `<section class="panel legal"><h2>${t('pv.' + k)}</h2>${t('pv.' + k + '.b', vars)}</section>`;
  return `<div class="wrap narrow" data-view="privacy">${S.hist.length ? backBtn() : ''}
    <section class="hero"><div class="hero-kicker">${icon('lock')}${t('pv.kicker')}</div>
      <h1 class="hero-title">${t('pv.title')}</h1>
      <p class="hero-sub">${t('pv.updated', {date: fmtDate(LEGAL_UPDATED)})}</p></section>
    ${isEn() ? `<div class="note info">${icon('info')}<span>${t('pv.authoritative')}</span></div>` : ''}
    ${SECTIONS.map(sec).join('\n')}
  </div>`;
}
