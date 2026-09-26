// صفحات موظف المكتب: لوحة المكتب، المستودع، طلبات الاستلام، البلاغات، إضافة/تعديل غرض
import { icon, CATS, cat, catName, colorName, subLabel, oName, ITEM_STATUS, CLAIM_STATUS } from '../constants.js';
import { $, $$, esc, today, dayNum, daysAgo, daysWord, fmtDate, relDay, relTime, pill, colorDot, tokens, textScore, norm, spotText, showTitle } from '../utils.js';
import { t, tp, noteText } from '../i18n.js';
import { S, curOffice, item, full, candidatesFor } from '../state.js';
import { backBtn, thumbHtml, miniItem, person, catPicker, subsPicker, colorPicker, photoField, photoModePicker, spotOptions, spotExtra, resetForm } from './common.js';
import { hydrate } from '../ui.js';
import { migrateItems, allowMigrationRetry } from '../migrate.js';

/* ---------- staff dashboard ---------- */
export function vStaff(){
  const o = curOffice();
  if (S.route.params.tab) { S.staffTab = S.route.params.tab; }
  allowMigrationRetry();
  return `<div class="wrap" data-view="staff">
    <section class="hero"><div class="hero-kicker">${icon('shield')}${t('st.kicker')}</div><h1 class="hero-title">${esc(oName(o))}</h1></section>
    <div class="stats" id="s-stats"></div>
    <div class="seg wide" id="s-tabs">
      <button data-act="sTab" data-v="items">${icon('box')}${t('nav.store')}</button>
      <button data-act="sTab" data-v="claims">${icon('inbox')}${t('st.tabClaims')}</button>
      <button data-act="sTab" data-v="reports">${icon('bell')}${t('nav.reports')}</button>
    </div>
    <div id="s-tools"></div>
    <div id="s-body"></div>
  </div>`;
}
let toolsTab = null;
const keepOf = () => curOffice()?.retentionDays || 90;
// أيام متبقية على نهاية مدة الحفظ (سالبة = تجاوزها)
export const keepLeft = i => keepOf() - daysAgo(i.foundDate);
// طلبات منافسة: طلبات قيد المراجعة على غرض محجوز لطلب آخر
export const rivals = i => i?.status === 'reserved' ? S.claims.filter(c => c.itemId === i.id && c.status === 'pending' && c.id !== i.reservedFor) : [];
// انتهت مهلة الاستلام للطلب المقبول؟
export const pickupOver = c => c.status === 'approved' && c.pickupBy && Date.now() > c.pickupBy;
const dateOf = ms => { const d = new Date(ms); return fmtDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); };
export { dateOf };

export function updateStaff(){
  const it = S.items;
  const pend = S.claims.filter(c => c.status === 'pending').length;
  const openR = S.reports.filter(r => r.status === 'open').length;
  const over = it.filter(i => i.status === 'available' && keepLeft(i) < 0).length;
  const late = S.claims.filter(pickupOver).length;
  $('#s-stats').innerHTML = `
    <div class="stat"><b>${it.filter(i => i.status === 'available').length}</b><span>${t('home.statAvail')}</span></div>
    <div class="stat"><b>${it.filter(i => i.status === 'reserved').length}</b><span>${t('st.sReserved')}</span></div>
    <div class="stat ${pend ? 'hot' : ''}"><b>${pend}</b><span>${t('st.sNew')}</span></div>
    <div class="stat"><b>${openR}</b><span>${t('st.sOpenR')}</span></div>
    <div class="stat"><b>${S.counts.returned ?? '…'}</b><span>${t('home.statReturned')}</span></div>
    ${over ? `<div class="stat hot"><b>${over}</b><span>${t('st.overKeep')}</span></div>` : ''}
    ${late ? `<div class="stat hot"><b>${late}</b><span>${t('st.sLate')}</span></div>` : ''}`;
  $$('#s-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === S.staffTab));
  if (toolsTab !== S.staffTab || !$('#s-tools').innerHTML){
    toolsTab = S.staffTab;
    $('#s-tools').innerHTML = S.staffTab === 'items' ? `<div class="filters">
        <label class="searchbar" style="flex:1;min-width:200px">${icon('search')}<input id="sq" type="search" placeholder="${t('st.searchPh')}" value="${esc(S.staffQ)}" aria-label="${t('st.searchAria')}"></label>
        <select class="select-sm" id="sstatus" aria-label="${t('st.status')}">
          <option value="active">${t('st.fActive')}</option><option value="returned">${t('st.fReturned')}</option><option value="archived">${t('st.fArchived')}</option><option value="disposed">${t('st.fDisposed')}</option><option value="all">${t('st.fAll')}</option>
        </select>
        <button class="btn sm" data-act="nav" data-r="add">${icon('plus')}${t('nav.add')}</button>
      </div>` : '';
    const ss = $('#sstatus'); if (ss) ss.value = S.staffStatus;
  }
  $('#s-body').innerHTML = S.staffTab === 'claims' ? staffClaims() : S.staffTab === 'reports' ? staffReports() : staffItems();
  hydrate();
  migrateItems();   // نقل تفاصيل الأغراض القديمة إلى الملف السري (مرة واحدة)
}
// تنبيه مدة الحفظ: قائمة ما تجاوزها مع إجراء جماعي «تصرّف»، وما سينتهي خلال 7 أيام
function retentionBox(){
  const avail = S.items.filter(i => i.status === 'available');
  const over = avail.filter(i => keepLeft(i) < 0), soon = avail.filter(i => keepLeft(i) >= 0 && keepLeft(i) <= 7);
  if (!over.length && !soon.length) return '';
  return `<div class="note warn retention">${icon('clock')}<span>
      ${over.length ? t('st.overList', {items: tp('n.item', over.length)}) : ''}
      ${soon.length ? `${over.length ? '<br>' : ''}${t('st.soonList', {items: tp('n.itemGen', soon.length)})}` : ''}</span>
    ${over.length ? `<button class="btn sm" data-act="dispose">${icon('check')}${t('st.dispose')}</button>` : ''}</div>`;
}
export function staffItems(){
  const st = S.staffStatus;
  let arr;
  if (st === 'active') arr = S.items.slice();
  else {
    // غير النشط يُجلب عند اختيار الفلتر فقط
    const need = st === 'all' ? ['returned', 'archived', 'disposed'] : [st];
    if (need.some(k => !S.extraItems[k])) return `<div class="list" aria-busy="true">${[1, 2, 3].map(() => '<div class="row skel"><div class="row-thumb"></div><div class="row-main"><span class="skel-line"></span><span class="skel-line short"></span></div></div>').join('')}</div>`;
    arr = [...(st === 'all' ? S.items : []), ...need.flatMap(k => S.extraItems[k])];
  }
  arr = arr.map(full);   // الموظف يبحث ويرى التفاصيل السرية أيضاً
  const q = tokens(S.staffQ);
  if (q.length) arr = arr.filter(i => textScore(q, i) > 0 || norm(i.ref).includes(norm(S.staffQ)));
  arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  const head = st === 'active' ? retentionBox() : '';
  if (!arr.length) return head + `<div class="empty">${icon('box')}<b>${t('st.noItems')}</b>${st === 'active' ? `<button class="btn soft" data-act="nav" data-r="add">${icon('plus')}${t('st.firstItem')}</button>` : ''}</div>`;
  return head + `<div class="list">${arr.map(i => { const left = keepLeft(i), rv = rivals(i).length; return `
    <article class="row" role="button" tabindex="0" data-act="openItem" data-id="${esc(i.id)}">
      ${thumbHtml(i)}
      <div class="row-main">
        <div class="row-top"><span class="ref">${esc(i.ref)}</span>${pill(ITEM_STATUS, i.status)}${rv ? `<span class="pill bad">${t('st.rival')}</span>` : ''}${i.sample ? `<span class="pill mute">${t('c.sample')}</span>` : ''}</div>
        <div class="row-title">${esc(showTitle(i))}</div>
        <div class="meta">${esc(spotText(i))} · ${relDay(i.foundDate)}${i.storage ? ' · ' + esc(i.storage) : ''}${i.status === 'available' && left < 0 ? ` · <span class="flag">${t('st.overKeep')}</span>` : i.status === 'available' && left <= 7 ? ` · <span class="flag">${left ? t('st.keepIn', {days: daysWord(left)}) : t('st.keepToday')}</span>` : ''}</div>
      </div>
    </article>`; }).join('')}</div>`;
}
/* مقارنة إجابات صاحب الطلب بالحقيقة (من itemSecrets) */
const OK = '<span class="v ok">✓</span>', OK2 = '<span class="v ok">✓✓</span>', NO = '<span class="v bad">✗</span>', NA = () => `<span class="v mute">${t('st.na')}</span>`;
// نتيجة المقارنة الآلية: اللون والمكان والتاريخ (تُستخدم في الجدول وفي تحذير القبول)
export function claimChecks(c, f){
  const color = !c.color ? NA() : !f?.color ? '' : c.color === f.color ? OK : NO;
  const place = !c.lostSpot ? NA() : !f?.spot ? '' : c.lostSpot !== f.spot ? NO : (c.bldg && c.bldg === f.bldg ? OK2 : OK);
  const gap = c.lostDate && f?.foundDate ? dayNum(f.foundDate) - dayNum(c.lostDate) : null;
  const date = !c.lostDate ? NA() : gap === null ? '' : gap >= 0 && gap <= 14 ? OK : NO;
  return {color, place, date, hits: [color, place, date].filter(v => v === OK || v === OK2).length};
}
function claimCompare(c, f){
  if (!f) return '';
  const said = x => x ? esc(x) : `<span class="muted">${t('st.notSaid')}</span>`, truth = x => x ? esc(x) : '<span class="muted">—</span>';
  // اللون: مطابقة تلقائية · المكان: ✓ المنطقة نفسها، ✓✓ والمبنى نفسه · التاريخ: فُقد قبل العثور أو في يومه، بفارق 14 يوماً على الأكثر
  const {color, place, date, hits} = claimChecks(c, f);
  const row = (k, a, b, v = '') => `<div class="cmp-row"><b>${k}</b><span>${a}</span><span>${b}</span>${v || '<span class="v"></span>'}</div>`;
  return `<div class="cmp">
    <div class="cmp-row cmp-head"><b></b><span>${t('st.cmpSaid')}</span><span>${t('st.cmpTruth')}</span><span class="v"></span></div>
    ${row(t('c.color'), said(colorName(c.color)), truth(colorName(f.color)), color)}
    ${row(t('st.cmpPlace'), said(spotText({spot: c.lostSpot, bldg: c.bldg, room: c.room})), truth(spotText(f)), place)}
    ${row(t('st.cmpDate'), said(c.lostDate && fmtDate(c.lostDate)), truth(f.foundDate && t('st.foundOn', {date: fmtDate(f.foundDate)})), date)}
    ${row(t('st.cmpBrand'), said(c.brand), truth(f.brand))}
    ${row(t('st.cmpProof'), said(c.proof), truth(f.desc))}
    <div class="cmp-sum">${t('st.cmpSum', {n: hits})}</div>
  </div>`;
}
export function claimCardStaff(c){
  const i = item(c.itemId);
  // تحذير: طلبات كثيرة من المستخدم نفسه في هذا المكتب خلال 30 يوماً
  const all = [...S.claims, ...(S.claimHist || []).filter(h => !S.claims.some(x => x.id === h.id))];
  const month = c.uid === 'deleted' ? 0 : all.filter(x => x.uid === c.uid && x.createdAt >= Date.now() - 30 * 864e5).length;
  const own = c.uid === S.uid;   // فصل المهام: لا يقرر الموظف في طلب أرسله هو
  const late = pickupOver(c);
  const rv = c.status === 'approved' && i ? rivals(i).length : 0;
  const actions = own && ['pending', 'approved'].includes(c.status) ? `<div class="note">${icon('info')}<span>${t('st.ownClaim')}</span></div>`
    : c.status === 'pending' ? `<div class="btn-row">
      <button class="btn sm" data-act="approve" data-id="${esc(c.id)}">${icon('check')}${t('st.approve')}</button>
      <button class="btn sm danger" data-act="reject" data-id="${esc(c.id)}">${icon('x')}${t('c.reject')}</button></div>`
    : c.status === 'approved' ? `<div class="btn-row">
      <button class="btn sm" data-act="verify" data-id="${esc(c.id)}">${icon('shield')}${t('st.verify')}</button>
      ${late ? `<button class="btn sm ghost" data-act="release" data-id="${esc(c.id)}">${icon('swap')}${t('st.release')}</button>` : ''}
      <button class="btn sm danger" data-act="reject" data-id="${esc(c.id)}">${icon('x')}${t('st.unapprove')}</button></div>` : '';
  return `<div class="box">
    <div class="box-head"><div class="claim-who">${person(c.uid)}<span class="meta">${relTime(c.createdAt)}</span>${month >= 3 ? `<span class="pill bad">${t('st.manyClaims', {claims: tp('n.claim', month)})}</span>` : ''}${rv ? `<span class="pill bad">${t('st.rival')}</span>` : ''}</div>${pill(CLAIM_STATUS, c.status)}</div>
    ${i && S.route.name !== 'item' ? miniItem(full(i)) : ''}
    ${c.status === 'approved' && c.pickupBy ? `<div class="meta ${late ? 'flag' : ''}">${t(late ? 'st.pickupEnded' : 'st.pickupUntil', {date: dateOf(c.pickupBy)})}</div>` : ''}
    ${rv ? `<div class="note warn">${icon('info')}<span>${t('st.rivalNote')}</span></div>` : ''}
    ${i ? claimCompare(c, full(i)) : `<div class="proof">${esc(c.proof)}</div>`}
    ${['rejected', 'expired', 'cancelled'].includes(c.status) && c.note ? `<div class="meta">${t(c.status === 'rejected' ? 'st.rejectReason' : 'st.note')}: ${esc(noteText(c.note))}</div>` : ''}
    ${actions}
  </div>`;
}
export function staffClaims(){
  const cs = S.claims.slice().sort((a,b) => b.createdAt - a.createdAt);
  const pend = cs.filter(c => c.status === 'pending'), appr = cs.filter(c => c.status === 'approved' && !pickupOver(c)), late = cs.filter(pickupOver);
  const hist = (S.claimHist || []).slice().sort((a,b) => (b.decidedAt || b.doneAt || b.createdAt) - (a.decidedAt || a.doneAt || a.createdAt)).slice(0, 50);
  return `
    <div class="section-title">${t('st.awaiting')} ${pend.length ? `<span class="count">${pend.length}</span>` : ''}</div>
    ${pend.length ? `<div class="list">${pend.map(claimCardStaff).join('')}</div>` : `<p class="muted">${t('st.noNew')}</p>`}
    ${late.length ? `<div class="section-title">${t('st.lateTitle')} <span class="count">${late.length}</span></div>
      <p class="muted">${t('st.lateHint')}</p>
      <div class="list">${late.map(claimCardStaff).join('')}</div>` : ''}
    <div class="section-title">${t('st.apprTitle')}</div>
    ${appr.length ? `<div class="list">${appr.map(claimCardStaff).join('')}</div>` : `<p class="muted">${t('c.none')}</p>`}
    <div class="section-title">${t('st.history')}</div>
    ${S.claimHist === null ? `<button class="btn sm ghost" data-act="claimHist">${icon('clock')}${t('st.showHist')}</button>`
      : hist.length ? `<div class="list">${hist.map(claimCardStaff).join('')}</div>` : `<p class="muted">${t('c.none')}</p>`}`;
}
export function staffReports(){
  const rs = S.reports.filter(r => r.status === 'open').sort((a,b) => b.createdAt - a.createdAt);
  if (!rs.length) return `<div class="empty">${icon('bell')}<b>${t('st.noReports')}</b><span>${t('st.noReportsSub')}</span></div>`;
  return `<div class="list">${rs.map(r => {
    const cands = candidatesFor(r, 3, full);   // الموظف يقارن بالتفاصيل السرية أيضاً
    return `<div class="box">
      <div class="box-head"><div><h3>${esc(r.title)}</h3><span class="meta">${icon(cat(r.cat).icon)}${esc(catName(r.cat))}${r.sub ? ' — ' + esc(subLabel(r.sub)) : ''}${r.color ? ' · ' + colorDot(r.color) + esc(colorName(r.color)) : ''}</span></div><span class="meta">${relTime(r.createdAt)}</span></div>
      ${r.photo ? `<div class="row-thumb" style="width:84px;height:84px">${icon('camera')}<img data-photo="r_${esc(r.id)}" alt="" hidden></div>` : ''}
      ${r.desc ? `<div class="proof">${esc(r.desc)}</div>` : ''}
      <div class="meta">${person(r.uid)} · ${r.spot ? t('st.lostAt', {place: esc(spotText(r)), date: fmtDate(r.lostDate)}) : t('st.lostOn', {date: fmtDate(r.lostDate)})}</div>
      ${acceptBtn(r)}
      ${cands.length ? `<span class="label">${t('st.cands')}</span><div class="list">${cands.map(({i, s}) => `<div class="btn-row" style="align-items:center;flex-wrap:nowrap">${miniItem(i, `<span class="score">${s}%</span>`)}
        ${r.staffPick === i.id ? `<span class="pill ok">${icon('check')}${t('st.picked')}</span>` : `<button class="btn sm soft" data-act="pickFor" data-r="${esc(r.id)}" data-i="${esc(i.id)}">${t('st.pick')}</button>`}</div>`).join('')}</div>`
        : `<p class="muted">${t('st.noCands')}</p>`}
    </div>`; }).join('')}</div>`;
}

// زر قبول البلاغ: يحوّله إلى غرض في المستودع، أو يُظهر الغرض إن سبق قبوله
function acceptBtn(r){
  const done = S.items.find(i => i.fromReport === r.id);
  if (done) return `<div class="btn-row" style="align-items:center"><span class="pill ok">${icon('check')}${t('st.added')}</span><button class="btn sm ghost" data-act="openItem" data-id="${esc(done.id)}">${esc(done.ref)}</button></div>`;
  return `<div class="btn-row"><button class="btn sm" data-act="acceptReport" data-id="${esc(r.id)}">${icon('check')}${t('st.acceptReport')}</button></div>`;
}

/* ---------- staff: add / edit item ---------- */
// الحقول السرية (الاسم التفصيلي، اللون، الماركة، الوصف، المبنى والقاعة، موضع الحفظ) تُقرأ من itemSecrets وتُحفظ فيها
export function vItemForm(){
  const o = curOffice(); const i = S.route.params.id ? full(item(S.route.params.id)) : null;
  // عند قبول بلاغ: نعبّئ النموذج من بيانات البلاغ (التصنيف، النوع، اللون، الصورة...)
  const r = !i && S.route.params.fromReport ? S.reports.find(x => x.id === S.route.params.fromReport) : null;
  const src = i || (r ? {cat: r.cat, sub: r.sub, color: r.color, title: r.title, desc: r.desc, spot: r.spot, bldg: r.bldg, room: r.room} : null);
  // الموظف يرى الأصل الواضح (p_)، والقيمة القديمة true صورتها في itemPhotos
  const photoKey = i?.photo ? (i.photo === true ? i.id : 'p_' + i.id) : r?.photo && !cat(r.cat).sensitive ? 'r_' + r.id : null;
  const mode = ['clear', 'blur', 'none'].includes(i?.photo) ? i.photo : i?.photo === true ? 'clear' : 'blur';
  resetForm(!!i?.photo, i ? null : photoKey);
  return `<div class="wrap" data-view="add">${i || r ? backBtn() : ''}
    <section class="hero"><div class="hero-kicker">${icon('tag')}${i ? t('if.kEdit', {ref: esc(i.ref)}) : t(r ? 'if.kReport' : 'if.kNew', {office: esc(oName(o))})}</div><h1 class="hero-title">${t(i ? 'if.tEdit' : r ? 'if.tReport' : 'if.tNew')}</h1></section>
    ${r ? `<div class="note info">${icon('bell')}<span>${t('if.fromReport')}</span></div>` : ''}
    <form data-form="item" class="panel" novalidate ${r ? `data-report="${esc(r.id)}"` : ''}>
      ${photoField(photoKey, t('if.photo'), photoModePicker(mode))}
      <div class="field"><span class="label">${t('c.category')}</span>${catPicker(src?.cat || '')}</div>
      <div class="field" id="subs-field" ${src?.cat && cat(src.cat).subs.length ? '' : 'hidden'}><span class="label">${t('c.type')}</span><div id="subs">${src?.cat ? subsPicker(src.cat, src.sub) : ''}</div></div>
      <div class="note">${icon('lock')}<span>${t('if.secretNote')}</span></div>
      <div class="field"><span class="label">${t('c.color')}</span>${colorPicker(src?.color || '')}</div>
      <div class="field"><label for="f-title">${t('if.title')}</label><input id="f-title" name="title" class="input" required maxlength="80" value="${esc(src?.title || '')}" placeholder="${t('if.titlePh')}"></div>
      <div class="field"><label for="f-brand">${t('if.brand')} <span class="hint">${t('if.staffOnly')}</span></label><input id="f-brand" name="brand" class="input" maxlength="40" value="${esc(src?.brand || '')}" placeholder="${t('if.brandPh')}"></div>
      <div class="field"><label for="f-desc">${t('if.desc')}</label><textarea id="f-desc" name="desc" class="input" maxlength="600" placeholder="${t('if.descPh')}">${esc(src?.desc || '')}</textarea></div>
      <div class="two">
        <div class="field"><label for="f-spot">${t('if.spot')}</label><select id="f-spot" name="spot" class="input">${spotOptions(o, src?.spot || '')}</select></div>
        <div class="field"><label for="f-date">${t('if.date')}</label><input id="f-date" name="foundDate" type="date" class="input" value="${esc(i?.foundDate || today())}" max="${today()}"></div>
      </div>
      ${spotExtra(src)}
      <div class="field"><label for="f-storage">${t('if.storage')} <span class="hint">${t('if.staffOnly')}</span></label><input id="f-storage" name="storage" class="input" maxlength="40" value="${esc(i?.storage || '')}" placeholder="${t('if.storagePh')}"></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${t(i ? 'if.saveEdit' : 'if.save')}</button>
    </form>
  </div>`;
}
