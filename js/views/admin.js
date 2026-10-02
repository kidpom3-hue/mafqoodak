// صفحات الإدارة: نظرة عامة، المواقع، الصلاحيات، نموذج الموقع
import { icon, OFFICE_TYPES, otype, otypeName, oName, oCity } from '../constants.js';
import { esc } from '../utils.js';
import { t, tp } from '../i18n.js';
import { S, loadAdminCounts } from '../state.js';
import { backBtn, person, whenLine, tabNum } from './common.js';
import { migrateEmails } from '../migrate.js';   // H18: نقل البريد القديم إلى private/profile

/* ---------- admin ---------- */
export function vAdmin(){
  migrateEmails();   // H18: مرة لكل جهاز (لا يعيد الرسم)
  if (S.route.params.tab) S.adminTab = S.route.params.tab;
  const tab = S.adminTab;
  const body = tab === 'offices' ? adminOffices() : tab === 'people' ? adminPeople() : adminOverview();
  return `<div class="wrap" data-view="admin">
    <section class="hero"><div class="hero-kicker">${icon('grid')}${t('adm.kicker')}</div><h1 class="hero-title">${t(tab === 'offices' ? 'adm.tOffices' : tab === 'people' ? 'adm.tPeople' : 'adm.tOverview')}</h1></section>
    ${body}
  </div>`;
}
// الأرقام تُجلب بـ getCountFromServer عند فتح الصفحة (لا اشتراك في كل أغراض كل المكاتب)
export function adminOverview(){
  loadAdminCounts();
  const C = S.counts.admin, samples = S.counts.samples || 0;
  const sum = k => C ? Object.values(C).reduce((a, x) => a + (x[k] || 0), 0) : '…';
  const pendInv = S.invites.length;
  // مكاتب نشطة بلا أسماء إنجليزية: الزائر الإنجليزي يرى النص العربي
  const noEn = S.offices.filter(o => o.active !== false && (!o.nameEn || !o.placeEn || !o.hoursEn || ((o.spots || []).length && !(o.spotsEn || []).some(Boolean))));
  return `
    ${noEn.map(o => `<div class="note warn en-warn">${icon('globe')}<span>${t('adm.enMissing', {office: esc(oName(o))})}</span>
      <button class="btn sm" data-act="editOffice" data-id="${esc(o.id)}" data-en="1">${icon('edit')}${t('adm.enFix')}</button></div>`).join('')}
    ${samples ? `<div class="note warn">${icon('sample')}<span>${t('adm.samples', {n: samples})}</span></div>
      <button class="btn sm danger" data-act="delSamples" style="align-self:flex-start">${icon('trash')}${t('adm.delSamples')}</button>` : ''}
    <div class="stats">
      <div class="stat"><b>${S.offices.filter(o => o.active !== false).length}</b><span>${t('adm.sActive')}</span></div>
      <div class="stat"><b>${C ? sum('available') + sum('reserved') : '…'}</b><span>${t('adm.sStored')}</span></div>
      <div class="stat"><b>${sum('returned')}</b><span>${t('home.statReturned')}</span></div>
      <div class="stat"><b>${S.staffList.length}</b><span>${t('adm.sStaff')}</span></div>
      <div class="stat"><b>${pendInv}</b><span>${t('inv.pending')}</span></div>
    </div>
    <div class="panel"><div class="section-title">${t('adm.byOffice')}</div>
      <div class="table-wrap"><table class="t"><thead><tr><th scope="col">${t('adm.colOffice')}</th><th scope="col">${t('adm.colAvail')}</th><th scope="col">${t('adm.colRes')}</th><th scope="col">${t('adm.colRet')}</th><th scope="col">${t('adm.colRate')}</th></tr></thead><tbody>
      ${S.offices.map(o => { const x = C?.[o.id]; const a = x?.available ?? '…', r = x?.reserved ?? '…', d = x?.returned ?? '…'; const tot = x ? x.available + x.reserved + x.returned + x.disposed : 0;
        return `<tr><td><button class="link" data-act="stats" data-id="${esc(o.id)}">${esc(oName(o))}</button>${o.active === false ? ` <span class="pill mute">${t('adm.off')}</span>` : ''}</td><td class="n">${a}</td><td class="n">${r}</td><td class="n">${d}</td><td class="n">${tot ? Math.round(100 * x.returned / tot) + '%' : '—'}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="btn-row"><button class="btn sm ghost" data-act="adminRefresh">${icon('swap')}${t('adm.refresh')}</button>
        <button class="btn sm ghost" data-act="audit">${icon('clock')}${t('au.btn')}</button></div>
    </div>`;
}
export function adminOffices(){
  loadAdminCounts();
  return `<div class="btn-row"><button class="btn" data-act="newOffice">${icon('plus')}${t('adm.addOffice')}</button></div>
    <div class="office-list">${S.offices.map(o => {
      const x = S.counts.admin?.[o.id]; const n = x ? x.available + x.reserved : null;
      const staffN = S.staffList.filter(s => (s.offices || []).includes(o.id)).length;
      return `<div class="office-card">
        <span class="oi">${icon(otype(o.type).icon)}</span>
        <span class="grow"><b>${esc(oName(o))}</b><span class="meta">${esc([otypeName(o.type), oCity(o), t('adm.refCode', {code: o.code || ''})].filter(Boolean).join(' · '))}</span><span class="meta">${n === null ? '' : esc(tp('n.stored', n)) + ' · '}${esc(tp('n.staff', staffN))}</span></span>
        <span class="btn-row" style="flex-direction:column;align-items:flex-end">
          <button class="switch ${o.active !== false ? 'on' : ''}" data-act="toggleOffice" data-id="${esc(o.id)}" role="switch" aria-checked="${o.active !== false}" aria-label="${t('adm.activeAria')}"></button>
          <button class="link" data-act="editOffice" data-id="${esc(o.id)}">${icon('edit')}${t('c.edit')}</button>
          <button class="link" data-act="stats" data-id="${esc(o.id)}">${icon('chart')}${t('sx.btn')}</button>
          <button class="link" data-act="poster" data-id="${esc(o.id)}">${icon('print')}${t('po.btn')}</button>
          <button class="link" data-act="audit" data-id="${esc(o.id)}">${icon('clock')}${t('au.btn')}</button>
          <button class="link" data-act="backup" data-id="${esc(o.id)}">${icon('download')}${t('bk.btn')}</button>
        </span>
      </div>`; }).join('') || `<div class="empty">${icon('pin')}<b>${t('adm.noOffices')}</b></div>`}</div>`;
}
export function adminPeople(){
  const oname = id => oName(S.offices.find(o => o.id === id)) || id;
  const owner = S.config?.ownerUid, isAdm = uid => S.adminList.some(a => a.id === uid);
  // بريد صاحب الحساب (يقرؤه المالك من users)، مع تحذير إن كان خارج نطاق الموظفين (SETTINGS.staffEmailDomain)
  const email = uid => `<span class="meta" dir="ltr" data-uemail="${esc(uid)}"></span>`;
  const adminBtn = uid => uid === owner ? `<span class="pill info">${t('adm.owner')}</span>`
    : isAdm(uid) ? `<button class="btn sm ghost" data-act="unAdmin" data-id="${esc(uid)}">${icon('x')}${t('adm.unAdmin')}</button>`
    : `<button class="btn sm ghost" data-act="makeAdmin" data-id="${esc(uid)}">${icon('shield')}${t('adm.makeAdmin')}</button>`;
  // مديرون ليست لهم صلاحية موظف في مكتب محدد
  const admOnly = S.adminList.filter(a => !S.staffList.some(s => s.id === a.id));
  // دعوة موظف (بدل طلبات الصلاحية): البريد والمكاتب، وتُقبل تلقائياً حين يدخل صاحب البريد ببريد موثّق
  const act = S.offices.filter(o => o.active !== false);
  const invites = S.invites.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return `
    <div class="section-title">${icon('plus')}${t('inv.title')}</div>
    <form data-form="invite" class="panel" novalidate>
      <div class="field"><label for="inv-email">${t('inv.email')}</label><input id="inv-email" name="email" type="email" class="input" dir="ltr" autocomplete="off" required placeholder="name@example.com"></div>
      <div class="field" role="group" aria-labelledby="inv-off"><span class="label" id="inv-off">${t('inv.offices')}</span>
        ${act.map(o => `<label class="check"><input type="checkbox" name="offices" value="${esc(o.id)}" ${o.id === S.officeId || act.length === 1 ? 'checked' : ''}><span>${esc(oName(o))}</span></label>`).join('')}</div>
      <p class="hint">${t('inv.hint')}</p>
      <div class="form-err" hidden></div>
      <button class="btn" type="submit" style="align-self:flex-start">${icon('check')}${t('inv.send')}</button>
    </form>
    <div class="section-title">${t('inv.pending')} ${tabNum(0, invites.length)}</div>
    ${invites.length ? `<div class="list">${invites.map(v => `<div class="box">
      <div class="box-head"><div><b dir="ltr">${esc(v.id)}</b>${whenLine('c.sentAt', v.createdAt)}</div><span class="pill warn">${t('inv.waiting')}</span></div>
      <div class="tags">${(v.offices || []).map(id => `<span class="tagchip">${esc(oname(id))}</span>`).join('')}</div>
      <div class="btn-row"><button class="btn sm danger" data-act="cancelInvite" data-id="${esc(v.id)}">${icon('x')}${t('inv.cancel')}</button></div>
    </div>`).join('')}</div>` : `<p class="muted">${t('inv.none')}</p>`}
    <div class="section-title">${t('adm.current')}</div>
    <div class="note">${icon('shield')}<span>${t('adm.ownerNote')}</span></div>
    ${S.staffList.length ? `<div class="list">${S.staffList.map(s => `<div class="box">
      <div class="box-head"><div>${person(s.id)}${email(s.id)}<span class="meta">${esc(s.note || '')}</span></div>${isAdm(s.id) ? `<span class="pill ok">${t('adm.isAdmin')}</span>` : ''}</div>
      <div class="tags">${(s.offices || []).map(id => `<span class="tagchip">${esc(oname(id))}</span>`).join('')}</div>
      <div class="btn-row">${adminBtn(s.id)}<button class="btn sm danger" data-act="revoke" data-id="${esc(s.id)}">${icon('x')}${t('adm.revoke')}</button></div>
    </div>`).join('')}</div>` : `<p class="muted">${t('adm.noStaff')}</p>`}
    <div class="section-title">${t('adm.admins')}</div>
    <p class="muted">${t('adm.adminsHint')}</p>
    <div class="list">${admOnly.map(a => `<div class="box"><div class="box-head"><div>${person(a.id)}${email(a.id)}</div>${adminBtn(a.id)}</div></div>`).join('')}</div>`;
}
export function vOfficeForm(){
  const o = S.route.params.id ? S.offices.find(x => x.id === S.route.params.id) : null;
  return `<div class="wrap" data-view="officeForm">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('pin')}${t(o ? 'of.edit' : 'of.new')}</div><h1 class="hero-title">${o ? esc(oName(o)) : t('of.add')}</h1></section>
    <form data-form="office" data-id="${esc(o?.id || '')}" class="panel" novalidate>
      <div class="field"><label for="o-name">${t('of.name')}</label><input id="o-name" name="name" class="input" required maxlength="80" value="${esc(o?.name || '')}" placeholder="${t('of.namePh')}"></div>
      <div class="two">
        <div class="field"><label for="o-short">${t('of.short')}</label><input id="o-short" name="short" class="input" maxlength="30" value="${esc(o?.short || '')}" placeholder="${t('of.shortPh')}"></div>
        <div class="field"><label for="o-type">${t('of.type')}</label><select id="o-type" name="type" class="input">${OFFICE_TYPES.map(x => `<option value="${x.id}" ${o?.type === x.id ? 'selected' : ''}>${esc(otypeName(x.id))}</option>`).join('')}</select></div>
        <div class="field"><label for="o-city">${t('setup.city')}</label><input id="o-city" name="city" class="input" maxlength="40" value="${esc(o?.city || '')}"></div>
        <div class="field"><label for="o-code">${t('of.code')}</label><input id="o-code" name="code" class="input" maxlength="4" dir="ltr" value="${esc(o?.code || '')}" placeholder="TCA"></div>
      </div>
      <div class="field"><label for="o-place">${t('of.place')}</label><input id="o-place" name="place" class="input" maxlength="120" value="${esc(o?.place || '')}"></div>
      <div class="two">
        <div class="field"><label for="o-hours">${t('found.hours')}</label><input id="o-hours" name="hours" class="input" maxlength="80" value="${esc(o?.hours || '')}"></div>
        <div class="field"><label for="o-phone">${t('of.phone')}</label><input id="o-phone" name="phone" class="input" maxlength="30" dir="ltr" value="${esc(o?.phone || '')}"></div>
        <div class="field"><label for="o-ret">${t('of.ret')}</label><input id="o-ret" name="retentionDays" type="number" min="7" max="365" class="input" value="${esc(o?.retentionDays || 90)}"></div>
        <div class="field"><label for="o-pick">${t('of.pick')}</label><input id="o-pick" name="pickupDays" type="number" min="1" max="60" class="input" value="${esc(o?.pickupDays || 7)}"><span class="hint">${t('of.pickHint')}</span></div>
        <div class="field"><label for="o-review">${t('of.review')}</label><input id="o-review" name="reviewDays" type="number" min="1" max="30" class="input" value="${esc(o?.reviewDays || 2)}"><span class="hint">${t('of.reviewHint')}</span></div>
      </div>
      <div class="field"><label for="o-dom">${t('of.domains')} <span class="hint">${t('c.optional')}</span></label><input id="o-dom" name="claimDomains" class="input" dir="ltr" maxlength="200" placeholder="tvtc.edu.sa" value="${esc((o?.claimDomains || []).join(', '))}"><span class="hint">${t('of.domainsHint')}</span></div>
      <div class="field"><label for="o-spots">${t('of.spots')}</label><textarea id="o-spots" name="spots" class="input" placeholder="${t('of.spotsPh')}">${esc((o?.spots || []).join('\n'))}</textarea><span class="hint">${t('of.spotsHint')}</span></div>
      <details class="en-fields" ${o?.nameEn || S.route.params.en ? 'open' : ''}>
        <summary>${icon('globe')}${t('of.enTitle')}</summary>
        <p class="hint">${t('of.enHint')}</p>
        <div class="two" dir="ltr" lang="en">
          <div class="field"><label for="o-nameEn">${t('of.name')}</label><input id="o-nameEn" name="nameEn" class="input" maxlength="80" value="${esc(o?.nameEn || '')}" placeholder="Technical College Al-Ahsa"></div>
          <div class="field"><label for="o-shortEn">${t('of.short')}</label><input id="o-shortEn" name="shortEn" class="input" maxlength="30" value="${esc(o?.shortEn || '')}"></div>
          <div class="field"><label for="o-cityEn">${t('setup.city')}</label><input id="o-cityEn" name="cityEn" class="input" maxlength="40" value="${esc(o?.cityEn || '')}"></div>
          <div class="field"><label for="o-hoursEn">${t('found.hours')}</label><input id="o-hoursEn" name="hoursEn" class="input" maxlength="80" value="${esc(o?.hoursEn || '')}"></div>
        </div>
        <div class="field" dir="ltr" lang="en"><label for="o-placeEn">${t('of.place')}</label><input id="o-placeEn" name="placeEn" class="input" maxlength="120" value="${esc(o?.placeEn || '')}"></div>
        <div class="field" dir="ltr" lang="en"><label for="o-spotsEn">${t('of.spots')}</label><textarea id="o-spotsEn" name="spotsEn" class="input" placeholder="${t('of.spotsPh')}">${esc((o?.spotsEn || []).join('\n'))}</textarea><span class="hint">${t('of.spotsEnHint')}</span></div>
      </details>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${t('c.save')}</button>
    </form>
  </div>`;
}

