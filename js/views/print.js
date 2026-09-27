// صفحات الطباعة: ملصقات QR للأغراض (للمستودع) وملصق المكتب (يُعلَّق في المبنى)
// الرمز يُولَّد داخل التطبيق (js/qr.js) فيعمل دون اتصال، والطباعة من زر «اطبع» في المتصفح.
import { icon, LOGO, cat, catName, subLabel, oName, oShort, oPlace, oHours } from '../constants.js';
import { t } from '../i18n.js';
import { esc, fmtDate } from '../utils.js';
import { S, item, full, curOffice } from '../state.js';
import { backBtn } from './common.js';
import { qrSvg } from '../qr.js';

// رابط التطبيق الحالي (يعمل على GitHub Pages وعلى جهازك)
const base = () => location.origin + location.pathname;
export const itemUrl = i => `${base()}#item/${i.officeId}/${i.id}`;
export const officeUrl = o => `${base()}#o/${o.id}`;

const toolbar = (title, hint) => `<div class="no-print">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('print')}${t('lb.kicker')}</div><h1 class="hero-title">${title}</h1><p class="hero-sub">${hint}</p></section>
    <div class="btn-row"><button class="btn" data-act="print">${icon('print')}${t('lb.print')}</button></div>
  </div>`;

/* ملصق لكل غرض: رمز QR يفتح صفحته، ورقم القيد، والنوع، وتاريخ العثور، وموضع الحفظ (للموظفين) */
export function vLabels(){
  const ids = S.route.params.ids || [];
  const list = ids.map(item).filter(Boolean).map(full);
  const o = curOffice();
  const one = i => `<article class="label">
      ${qrSvg(itemUrl(i), {label: t('lb.qrAria', {ref: i.ref})})}
      <div class="lb-text">
        <b class="lb-ref" dir="ltr">${esc(i.ref)}</b>
        <span>${icon(cat(i.cat).icon)}${esc(catName(i.cat))}${i.sub ? ' — ' + esc(subLabel(i.sub)) : ''}</span>
        <span>${t('lb.found', {date: fmtDate(i.foundDate)})}</span>
        ${i.storage ? `<span>${t('if.storage')}: ${esc(i.storage)}</span>` : ''}
        <small>${esc(oShort(o) || '')} · ${t('app.name')}</small>
      </div>
    </article>`;
  return `<div class="wrap print-page" data-view="labels">
    ${toolbar(t('lb.title', {n: list.length}), t('lb.hint'))}
    ${list.length ? `<div class="labels">${list.map(one).join('')}</div>` : `<div class="empty">${icon('qr')}<b>${t('lb.none')}</b></div>`}
  </div>`;
}

/* ملصق المكتب: «فقدت شيئاً؟» مع رمز QR يفتح مفقودات هذا المكتب مباشرة */
export function vPoster(){
  const o = S.offices.find(x => x.id === S.route.params.office) || curOffice();
  if (!o) return `<div class="wrap">${backBtn()}</div>`;
  const url = officeUrl(o);
  return `<div class="wrap print-page" data-view="poster">
    ${toolbar(t('po.pageTitle'), t('po.hint'))}
    <article class="poster">
      <div class="po-brand">${LOGO}<b>${t('app.name')}</b></div>
      <h1>${t('po.title')}</h1>
      <p class="po-sub">${t('po.sub', {office: esc(oName(o))})}</p>
      ${qrSvg(url, {label: t('po.qrAria')})}
      <p class="po-scan">${icon('camera')}${t('po.scan')}</p>
      <ol class="po-steps"><li>${t('po.s1')}</li><li>${t('po.s2')}</li><li>${t('po.s3')}</li></ol>
      ${oPlace(o) || oHours(o) ? `<p class="po-office">${icon('pin')}<span>${esc([oPlace(o), oHours(o)].filter(Boolean).join(' · '))}</span></p>` : ''}
      <small class="po-url" dir="ltr">${esc(url.replace(/^https?:\/\//, ''))}</small>
    </article>
  </div>`;
}
