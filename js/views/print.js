// صفحات الطباعة: ملصقات QR للأغراض (للمستودع) وملصق المكتب (يُعلَّق في المبنى)
// الرمز يُولَّد داخل التطبيق (js/qr.js) فيعمل دون اتصال، والطباعة من زر «اطبع» في المتصفح.
import { icon, LOGO, cat, catName, subLabel, oName, oShort, oPlace, oHours, brandOf } from '../constants.js';
import { t, tAr, locale, isEn, noteText } from '../i18n.js';
import { esc, fmtDate, isoDay, $, TZ, fullWhen, showTitle } from '../utils.js';
import { S, item, full, curOffice, ensureItem, claimNo, touch } from '../state.js';
import { backBtn, officeUrl, brandLogo, person, delegateOf } from './common.js';
import { dbx } from '../firebase.js';
import { qrSvg } from '../qr.js';

// رابط التطبيق الحالي (يعمل على GitHub Pages وعلى جهازك)
const base = () => location.origin + location.pathname;
export const itemUrl = i => `${base()}#item/${i.officeId}/${i.id}`;
export { officeUrl };   // H8: في common.js

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
      <div class="po-brand">${LOGO}<b>${t('app.name')}</b>${brandOf(o) ? `<span class="po-sep" aria-hidden="true"></span>${brandLogo(o, 'light', 'po-logo')}` : ''}</div>
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

/* شهادة شكر الأمانة (route: thanks، param id = إشعار التسليم): للواجد الذي عاد ما سلّمه إلى صاحبه.
   الاسم يُكتب قبل الطباعة (معبّأ من اسم الحساب) ولا يُحفظ. النوع العام فقط، بلا أي تفاصيل سرية.
   H15: شعار الكلية أعلى الشهادة إن كان المكتب مكتبها (بإذن من إدارتها)، ولا شعارات غيره.
   A4 أفقي بلغة الواجهة (@page thanks في css/styles.css) */
// تاريخ كامل بالسنة (الشهادة وثيقة تُحفظ)
const fullDate = ms => { try { return new Intl.DateTimeFormat(locale(), {day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ}).format(new Date(ms)); } catch { return isoDay(ms); } };
export function vThanks(){
  const f = S.myFound.find(x => x.id === S.route.params.id);
  const it = f?.itemId ? item(f.itemId) : null; if (f?.itemId && !it) ensureItem(f.itemId);
  if (!f || it?.status !== 'returned') return `<div class="wrap">${backBtn()}<div class="empty">${icon('tag')}<b>${t(it || !f ? 'ty.notYet' : 'c.loadingDots')}</b></div></div>`;
  const o = S.offices.find(x => x.id === f.officeId);
  // النوع العام فقط (بحرف صغير داخل الجملة الإنجليزية: «the phone»)
  const type0 = it.sub ? subLabel(it.sub) : catName(it.cat), type = isEn() ? type0.toLowerCase() : type0;
  return `<div class="wrap print-page thanks-page" data-view="thanks">
    <div class="no-print">${backBtn()}
      <section class="hero"><div class="hero-kicker">${icon('print')}${t('ty.kicker')}</div><h1 class="hero-title">${t('ty.title')}</h1><p class="hero-sub">${t('ty.hint')}</p></section>
      <div class="field"><label for="ty-name">${t('ty.name')}</label><input id="ty-name" class="input" maxlength="80" autocomplete="name" value="${esc(S.me?.name || '')}"></div>
      <div class="btn-row"><button class="btn" data-act="print">${icon('print')}${t('lb.print')}</button></div>
    </div>
    <article class="cert" data-office="${esc(oName(o))}" data-type="${esc(type)}" data-date="${esc(fullDate(it.returnedAt || it.updatedAt))}">
      ${brandOf(o) ? `<div class="cert-brand">${brandLogo(o, 'light', 'cert-logo')}</div>` : ''}
      <p class="cert-kicker">${t('app.name')}</p>
      <h2 class="cert-title">${t('ty.certTitle')}</h2>
      <p class="cert-body" id="ty-body"></p>
      <p class="cert-ref">${t('ty.ref')}: <b dir="ltr">${esc(it.ref)}</b></p>
      <small class="cert-note">${t('ty.note')}</small>
    </article>
  </div>`;
}
// نص الشهادة: يُعاد عند كل تعديل للاسم (بـ textContent، فلا حاجة لـ esc)
export function fillThanks(){
  const c = $('.cert'), inp = $('#ty-name'), out = $('#ty-body'); if (!c || !inp || !out) return;
  const draw = () => { out.textContent = t('ty.body', {office: c.dataset.office, name: inp.value.trim() || '…', type: c.dataset.type, date: c.dataset.date}); };
  inp.addEventListener('input', draw); draw();
}

/* H33: إيصال تسليم غرض (route: receipt، param id = طلب الاستلام المكتمل؛ s=1 من لوحة الموظف):
   ما سُلّم ولمن ومتى وكيف تُحقق منه، وإقرار المستلم، وسطرا توقيع (المستلم والموظف)، كما في محاضر التسليم بمكاتب المفقودات.
   للموظف: عنوان الغرض المفصّل واسم الموظف الذي سلّمه. لصاحب الطلب: العنوان العام فقط. A4 عمودي */
const RCP = {};
function claimFor(id){
  const c = S.myClaims.find(x => x.id === id) || S.claims.find(x => x.id === id) || (S.claimHist || []).find(x => x.id === id) || RCP[id];
  if (c !== undefined) return c === 'loading' ? null : c;
  RCP[id] = 'loading';
  dbx.get('claims/' + id).then(d => { RCP[id] = d ? {id, ...d} : 0; touch(); }).catch(() => { RCP[id] = 0; touch(); });
  return null;
}
export function vReceipt(){
  const id = String(S.route.params.id || ''), c = id ? claimFor(id) : 0;
  const wait = c === null, it = c?.itemId ? item(c.itemId) : null;
  if (c?.itemId && !it) ensureItem(c.itemId);
  if (wait || (c && c.itemId && !it)) return `<div class="wrap">${backBtn()}<div class="loading" aria-busy="true"><span class="spin"></span></div></div>`;
  if (!c || c.status !== 'done' || !it) return `<div class="wrap">${backBtn()}<div class="empty">${icon('print')}<b>${t('rcp.notDone')}</b></div></div>`;
  const o = S.offices.find(x => x.id === c.officeId);
  const staff = !!S.route.params.s && (S.isAdmin || (S.staffDoc?.offices || []).includes(c.officeId));
  const f = staff ? full(it) : it;
  // استلمه المفوَّض؟ ملاحظة التسليم المخزّنة تبدأ ببداية نص «استلمه المفوَّض» (sys.receivedByDelegate)
  const dPre = tAr('sys.receivedByDelegate', {name: '\u0000', last4: ''}).split('\u0000')[0];
  const byDelegate = !!delegateOf(c) && String(c.handoverNote || '').startsWith(dPre);
  const how = [t('rcp.howCode'), t(byDelegate ? 'rcp.howDelegate' : 'rcp.howId')];
  const facts = [
    [t('rcp.ref'), `<b dir="ltr">${esc(it.ref || '')}</b>`],
    [t('rcp.reqNo'), `<b dir="ltr">${esc(claimNo(c))}</b>`],
    [t('rcp.item'), `${esc(staff && f.title ? f.title : showTitle(it))} <span class="muted">(${esc(catName(it.cat))}${it.sub ? ' — ' + esc(subLabel(it.sub)) : ''})</span>`],
    [t('rcp.at'), esc(fullWhen(c.doneAt))],
    [t('rcp.receiver'), c.handoverNote ? esc(noteText(c.handoverNote)) : `<span class="muted">—</span>`],
    [t('rcp.how'), esc(how.join(t('c.listSep')))],
    [t('rcp.office'), esc([oName(o), oPlace(o)].filter(Boolean).join(' — '))],
    ...(staff && c.doneBy ? [[t('rcp.staff'), person(c.doneBy)]] : []),
  ];
  return `<div class="wrap print-page receipt-page" data-view="receipt">
    <div class="no-print">${backBtn()}
      <section class="hero"><div class="hero-kicker">${icon('print')}${t('rcp.kicker')}</div><h1 class="hero-title">${t('rcp.title')}</h1><p class="hero-sub">${t('rcp.hint')}</p></section>
      <div class="btn-row"><button class="btn" data-act="print">${icon('print')}${t('lb.print')}</button></div>
    </div>
    <article class="rcpt">
      <div class="rcpt-brand">${LOGO}<b>${t('app.name')}</b>${brandOf(o) ? `<span class="po-sep" aria-hidden="true"></span>${brandLogo(o, 'light', 'rcpt-logo')}` : ''}</div>
      <h2 class="rcpt-title">${t('rcp.docTitle')}</h2>
      <dl class="rcpt-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <p class="rcpt-pledge">${t('rcp.pledge')}</p>
      <div class="rcpt-sign"><div><span>${t('rcp.signReceiver')}</span><i aria-hidden="true"></i></div><div><span>${t('rcp.signStaff')}</span><i aria-hidden="true"></i></div></div>
      <small class="rcpt-note">${t('rcp.note')}</small>
    </article>
  </div>`;
}
