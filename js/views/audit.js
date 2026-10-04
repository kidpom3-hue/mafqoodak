// صفحة «سجل العمليات» للإدارة (route: audit): قيود logs لمكتب مختار، مع فلتر
// (التسليم المباشر، الحذف، التصرّف، الصلاحيات). تُجلب عند الطلب فقط بـ officeId == و action in [...]
import { icon, oName } from '../constants.js';
import { esc, fmtDateTime } from '../utils.js';
import { t, noteText } from '../i18n.js';
import { S, AUDIT, loadAudit } from '../state.js';
import { backBtn, person } from './common.js';
import { logLabel } from './staff.js';

const FILTERS = ['all', ...Object.keys(AUDIT)];

export function vAudit(){
  if (!S.isAdmin) return `<div class="wrap">${backBtn()}<div class="empty">${icon('lock')}<b>${t('sx.denied')}</b></div></div>`;
  const p = S.route.params;
  const office = S.offices.some(o => o.id === p.office) ? p.office : S.offices[0]?.id || '';
  const filter = FILTERS.includes(p.filter) ? p.filter : 'all';
  const L = S.audit[office + '|' + filter];
  if (!L) loadAudit(office, filter);
  const head = `${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('clock')}${t('au.kicker')}</div><h1 class="hero-title">${t('au.title')}</h1><p class="hero-sub">${t('au.sub')}</p></section>
    <div class="filters">
      <label class="field grow"><span class="label">${t('adm.colOffice')}</span><select id="au-office" class="input">${S.offices.map(o => `<option value="${esc(o.id)}" ${o.id === office ? 'selected' : ''}>${esc(oName(o))}</option>`).join('')}</select></label>
      <label class="field grow"><span class="label">${t('au.filter')}</span><select id="au-filter" class="input">${FILTERS.map(f => `<option value="${f}" ${f === filter ? 'selected' : ''}>${t('au.f.' + f)}</option>`).join('')}</select></label>
    </div>
    <div class="btn-row"><button class="btn sm ghost" data-act="auditRefresh">${icon('swap')}${t('sx.refresh')}</button></div>`;
  if (!Array.isArray(L)) return `<div class="wrap" data-view="audit">${head}<div class="loading" aria-busy="true"><span class="spin"></span></div></div>`;
  if (!L.length) return `<div class="wrap" data-view="audit">${head}<div class="empty">${icon('clock')}<b>${t('au.none')}</b></div></div>`;
  return `<div class="wrap" data-view="audit">${head}
    <p class="hint">${t('au.count', {n: L.length})}</p>
    <ol class="timeline audit">${L.map(e => {
      const perm = e.action.startsWith('perm:');
      return `<li class="tl-${esc(e.action.split(':')[0])}"><span class="tl-dot" aria-hidden="true"></span><div class="tl-body">
        <b>${logLabel(e.action)}</b>
        <span class="meta">${fmtDateTime(e.at)} · ${t('tl.by')} ${person(e.by)}</span>
        ${perm && e.note ? `<span class="meta">${t('au.who')} ${person(e.note)}</span>` : ''}
        ${e.itemId ? `<button class="link" data-act="openItem" data-id="${esc(e.itemId)}">${icon('box')}${t('au.openItem')}</button>` : ''}
        ${!perm && e.note ? `<span class="tl-note">${esc(noteText(e.note))}</span>` : ''}
      </div></li>`; }).join('')}</ol>
  </div>`;
}
