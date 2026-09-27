// صفحات المرحلة F (بأسلوب المنصات الحكومية، دون أي شعار حكومي):
// بطاقة الخدمة (route: service)، ومؤشرات المكتب للزوار (route: numbers)، وبيان إمكانية الوصول (route: a11y)
import { icon, oName, oPlace, oHours } from '../constants.js';
import { esc, fmtDate, isoDay, TZ } from '../utils.js';
import { t, tp, locale } from '../i18n.js';
import { S, curOffice } from '../state.js';
import { backBtn } from './common.js';
import { loadPublicStats } from '../stats.js';

/* ---------- بطاقة الخدمة ---------- */
export const SERVICES = ['claim', 'report', 'handin'];
// زر «ابدأ الخدمة»: الاستلام يبدأ من البحث عن الغرض، والبلاغ والتسليم من نموذجيهما
const START = {claim: 'browse', report: 'report', handin: 'handin'};
const list = key => t(key).split('|').filter(Boolean);
export const reviewDaysOf = o => Math.max(1, Math.min(30, Number(o?.reviewDays) || 2));
const pickupDaysOf = o => Math.max(1, Math.min(60, Number(o?.pickupDays) || 7));

function serviceIndex(){
  return `<div class="wrap" data-view="service">${S.hist.length ? backBtn() : ''}
    <section class="hero"><div class="hero-kicker">${icon('grid')}${t('svc.kicker')}</div><h1 class="hero-title">${t('svc.indexTitle')}</h1>
      <p class="hero-sub">${t('svc.indexSub')}</p></section>
    <div class="office-list">${SERVICES.map(id => `<button class="office-card" data-act="nav" data-r="service" data-id="${id}">
      <span class="oi">${icon(id === 'claim' ? 'shield' : id === 'report' ? 'bell' : 'tag')}</span>
      <span class="grow"><b>${t('svc.' + id + '.name')}</b><span class="meta">${t('svc.' + id + '.short')}</span></span>${icon('fwd')}</button>`).join('')}</div>
  </div>`;
}
export function vService(){
  const id = S.route.params.id;
  if (!SERVICES.includes(id)) return serviceIndex();
  const o = curOffice();
  const sec = (k, body) => `<section class="panel svc-sec"><h2 class="section-title">${t('svc.sec.' + k)}</h2>${body}</section>`;
  const vars = {reviewDays: tp('n.workDays', reviewDaysOf(o)), pickupDays: tp('n.daysNom', pickupDaysOf(o))};
  return `<div class="wrap narrow" data-view="service">${S.hist.length ? backBtn() : ''}
    <section class="hero"><div class="hero-kicker">${icon('grid')}${t('svc.kicker')}</div><h1 class="hero-title">${t('svc.' + id + '.name')}</h1>
      <p class="hero-sub">${esc(oName(o))}</p></section>
    ${sec('desc', `<p>${t('svc.' + id + '.desc')}</p>`)}
    ${sec('who', `<p>${t('svc.who')}</p>`)}
    ${sec('req', `<ul class="svc-list">${list('svc.' + id + '.req').map(x => `<li>${x}</li>`).join('')}</ul>`)}
    ${sec('steps', `<ol class="svc-steps">${list('svc.' + id + '.steps').map(x => `<li>${x}</li>`).join('')}</ol>`)}
    ${sec('time', `<p>${t('svc.' + id + '.time', vars)}</p>`)}
    ${sec('fee', `<p><b>${t('svc.free')}</b></p>`)}
    ${sec('channels', `<ul class="svc-list">
      <li>${t('svc.web')}</li>
      <li>${t('svc.officeCh', {office: esc(oName(o))})}${oPlace(o) ? ` — ${esc(oPlace(o))}` : ''}</li>
      ${oHours(o) ? `<li>${t('found.hours')}: ${esc(oHours(o))}</li>` : ''}
      ${o?.phone ? `<li>${t('found.contact')}: <span dir="ltr">${esc(o.phone)}</span></li>` : ''}
    </ul>`)}
    <button class="btn block" data-act="nav" data-r="${START[id]}">${icon('fwd')}${t('svc.start')}</button>
  </div>`;
}

/* ---------- مؤشرات المكتب (للزوار) ---------- */
export function vNumbers(){
  const o = curOffice(); const id = o?.id;
  loadPublicStats(id);
  const d = S.pubStats[id];
  const head = `${S.hist.length ? backBtn() : ''}
    <section class="hero"><div class="hero-kicker">${icon('chart')}${t('num.kicker')}</div><h1 class="hero-title">${t('num.title')}</h1>
      <p class="hero-sub">${esc(oName(o))}</p></section>`;
  if (d === 'loading' || d === undefined) return `<div class="wrap" data-view="numbers">${head}<div class="loading" aria-busy="true"><span class="spin"></span></div></div>`;
  if (!d) return `<div class="wrap" data-view="numbers">${head}<div class="empty">${icon('chart')}<b>${t('num.none')}</b></div></div>`;
  const tile = (label, value, hint = '') => `<div class="kpi"><span class="kpi-l">${label}</span><b class="kpi-v">${value}</b>${hint ? `<span class="kpi-h">${hint}</span>` : ''}</div>`;
  const [y, m] = String(d.month || '').split('-').map(Number);
  const month = y && m ? new Intl.DateTimeFormat(locale(), {month: 'long', year: 'numeric', timeZone: TZ}).format(new Date(Date.UTC(y, m - 1, 15))) : '';
  return `<div class="wrap" data-view="numbers">${head}
    <h2 class="section-title">${t('num.month', {month: esc(month)})}</h2>
    <div class="kpis">
      ${tile(t('num.received'), d.monthReceived ?? 0)}
      ${tile(t('num.returned'), d.monthReturned ?? 0)}
    </div>
    <h2 class="section-title">${t('num.since')}</h2>
    <div class="kpis">
      ${tile(t('num.rate'), (d.returnRate ?? 0) + '%', t('num.rateHint', {ret: d.totalReturned ?? 0, all: d.totalReceived ?? 0}))}
      ${tile(t('num.avgDays'), d.avgDays || '—', d.avgDays ? t('sx.daysUnit') : '')}
      ${tile(t('num.rating'), d.ratings ? t('num.ratingV', {avg: d.avgRating}) : '—', d.ratings ? tp('n.rating', d.ratings) : t('num.noRatings'))}
    </div>
    <p class="hint">${t('num.updated', {date: fmtDate(isoDay(d.updatedAt))})}</p>
    <p class="hint">${t('num.note')}</p>
  </div>`;
}

/* ---------- بيان إمكانية الوصول ---------- */
export function vA11y(){
  const o = curOffice();
  const contact = [o?.phone ? t('a11y.phone', {phone: `<span dir="ltr">${esc(o.phone)}</span>`}) : '', oPlace(o) ? t('a11y.visit', {place: esc(oPlace(o))}) : ''].filter(Boolean).join(' ');
  const sec = k => `<section class="panel legal"><h2>${t('a11y.' + k)}</h2>${t('a11y.' + k + '.b')}</section>`;
  return `<div class="wrap narrow" data-view="a11y">${S.hist.length ? backBtn() : ''}
    <section class="hero"><div class="hero-kicker">${icon('users')}${t('a11y.kicker')}</div><h1 class="hero-title">${t('a11y.title')}</h1></section>
    ${sec('commit')}${sec('supports')}${sec('limits')}
    <section class="panel legal"><h2>${t('a11y.report')}</h2><p>${t('a11y.report.b')} ${contact}</p></section>
  </div>`;
}
