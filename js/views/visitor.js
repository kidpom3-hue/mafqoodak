// صفحات الزائر: اختيار المكان، التصفح، تفاصيل الغرض، طلب الاستلام، البلاغ، طلباتي، المكتب
import { icon, LOGO, CATS, cat, catName, colorName, otype, otypeName, oName, oPlace, oHours, oCity, subLabel, statusLabel, ITEM_STATUS, CLAIM_STATUS, REPORT_STATUS, FOUND_STATUS, claimOf, keepDaysOf, claimHasRequired } from '../constants.js';
import { $, $$, esc, today, dayNum, daysAgo, fmtDate, daysWord, relDay, relTime, pill, colorDot, tokens, textScore, spotText, showTitle, isoDay, LS, disposalLabel, when } from '../utils.js';
import { t, tp, noteText } from '../i18n.js';
import { S, curOffice, item, full, myReports, myClaims, myFound, myCode, maybeFor, unseenCount, alertKeys, ensureItem, itemLoading, officeName, ACTIVE, awaitingAnswer, isStale, claimNo, claimEditable, pickOf, rejectedOf } from '../state.js';
import { backBtn, thumbHtml, miniItem, catPicker, subsPicker, catFields, photoField, spotOptions, spotExtra, resetForm, loginPrompt, verifyPrompt, photoImg, blurBadge, isBlur, staffView, whenLine, claimTimeline, detailReq, mcard, CARD_OPEN, ENDED_OPEN } from './common.js';
export { CARD_OPEN, ENDED_OPEN };
import { claimCardStaff, rivals, dateOf, qaBox, timeline, catKeepNote } from './staff.js';
import { aiReady } from '../ai.js';
import { hydrate } from '../ui.js';
import { msgOf } from '../notify.js';

/* ---------- visitor: choose place ---------- */
export function vPick(){
  const act = S.offices.filter(o => o.active !== false);
  return `<div class="wrap" data-view="pick">
    <div class="intro">${LOGO}
      <h1>${t('pick.title')}</h1>
      <p>${t('pick.lead')}</p>
    </div>
    ${act.length ? `<div class="office-list">${act.map(o => `
      <button class="office-card ${o.id === S.officeId ? 'cur' : ''}" data-act="setOffice" data-id="${esc(o.id)}">
        <span class="oi">${icon(otype(o.type).icon)}</span>
        <span class="grow"><b>${esc(oName(o))}</b><span class="meta">${esc([otypeName(o.type), oCity(o)].filter(Boolean).join(' · '))}</span></span>
        ${icon('fwd')}
      </button>`).join('')}</div>`
    : `<div class="empty">${icon('pin')}<b>${t('pick.none')}</b>${S.isAdmin ? `<button class="btn" data-act="newOffice">${icon('plus')}${t('pick.addFirst')}</button>` : ''}</div>`}
    <div class="note">${icon('info')}<span>${t('pick.note')}</span></div>
  </div>`;
}

/* ---------- visitor: browse ---------- */
export function vBrowse(){
  const o = curOffice();
  return `<div class="wrap" data-view="browse">
    <section class="hero">
      <div class="hero-kicker">${icon(otype(o.type).icon)}${esc(otypeName(o.type))}${oCity(o) ? ' · ' + esc(oCity(o)) : ''}</div>
      <h1 class="hero-title">${t('br.title', {name: esc(oName(o))})}</h1>
      <p class="hero-sub" id="hero-count"></p>
    </section>
    <div id="match-banner"></div>
    <div class="browse-bar" id="browse-bar">
      <label class="searchbar">${icon('search')}<input id="q" type="search" placeholder="${t('br.searchPh')}" value="${esc(S.filter.q)}" autocomplete="off" aria-label="${t('home.searchAria')}"></label>
      <div class="chips-scroll" id="cat-chips">${[{id:'all', icon:'grid'}, ...CATS].map(c => `<button class="chip" data-act="fcat" data-id="${c.id}">${icon(c.icon)}<span>${esc(c.id === 'all' ? t('st.fAll') : catName(c.id))}</span></button>`).join('')}</div>
    </div>
    <div class="filters">
      <select class="select-sm" id="frange" aria-label="${t('if.date')}">
        <option value="all">${t('br.anyTime')}</option><option value="7">${t('br.last7')}</option><option value="30">${t('br.last30')}</option>
      </select>
    </div>
    <h2 class="sr-only">${t('br.results')}</h2>
    <div id="results"></div>
    <aside class="cta-lost">
      <div class="cta-txt"><span class="cta-ic">${icon('bell')}</span><div><b>${t('br.notFound')}</b><p>${t('br.notFoundSub')}</p></div></div>
      <button class="btn" data-act="nav" data-r="report">${icon('plus')}${t('foot.report')}</button>
    </aside>
  </div>`;
}
// التصفح العام: الأغراض النشطة فقط (المتاح والمحجوز)، والمُسلَّم يظهر كعدد في العنوان
export function visibleItems(){
  let arr = S.items.filter(i => ACTIVE.includes(i.status));
  if (S.filter.cat !== 'all') arr = arr.filter(i => i.cat === S.filter.cat);
  if (S.filter.range !== 'all'){ const lim = +S.filter.range; arr = arr.filter(i => daysAgo(i.foundDate) <= lim); }
  const q = tokens(S.filter.q);
  if (q.length) return arr.map(i => ({i, s: textScore(q, i, false)})).filter(x => x.s > 0).sort((a,b) => b.s - a.s || (b.i.createdAt||0) - (a.i.createdAt||0)).map(x => x.i);
  return arr.sort((a,b) => (dayNum(b.foundDate) - dayNum(a.foundDate)) || ((b.createdAt||0) - (a.createdAt||0)));
}
// بطاقات هيكلية تظهر أثناء تحميل المفقودات
export const skelCards = (n = 4) => Array.from({length: n}, () => `<div class="card skel" aria-hidden="true"><div class="thumb"></div><div class="card-body"><span class="skel-line"></span><span class="skel-line short"></span></div></div>`).join('');

export function card(i){
  const c = cat(i.cat);
  // بطاقة قابلة للضغط: div بدور زر (عنصر article لا يقبل دور button)
  return `<div class="card" role="button" tabindex="0" data-act="openItem" data-id="${esc(i.id)}">
    <div class="thumb${isBlur(i) ? ' blurred' : ''}">${icon(c.icon)}${photoImg(i)}${blurBadge(i)}${i.sample ? `<span class="badge-sample">${t('c.sample')}</span>` : ''}</div>
    <div class="card-body">
      <span class="ref">${esc(i.ref)}</span>
      <h3>${esc(showTitle(i))}</h3>
      <div class="meta">${icon('clock')}<span>${relDay(i.foundDate)}</span></div>
      ${i.status !== 'available' ? pill(ITEM_STATUS, i.status) : ''}
    </div>
  </div>`;
}
export function updateBrowse(){
  const avail = S.items.filter(i => i.status === 'available').length;
  const ret = S.counts.returned || 0;
  const hc = $('#hero-count');
  if (hc) hc.innerHTML = !S.itemsLoaded ? t('c.loadingDots') : `${avail ? t('home.availNow', {items: `<b>${esc(tp('n.item', avail))}</b>`}) : t('br.noneNow')}${ret ? ' · ' + t('br.returned', {items: `<b>${esc(tp('n.itemAcc', ret))}</b>`}) : ''}`;
  const n = unseenCount(); const mb = $('#match-banner');
  if (mb) mb.innerHTML = n ? `<button class="banner" data-act="nav" data-r="mine">${icon('bell')}<span class="grow">${t('br.alerts', {alerts: tp('n.alert', n)})}</span>${icon('fwd')}</button>` : '';
  $$('#cat-chips .chip').forEach(b => { const on = b.dataset.id === S.filter.cat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const fr = $('#frange'); if (fr) fr.value = S.filter.range;
  const res = $('#results'); if (!res) return;
  if (!S.itemsLoaded){ res.innerHTML = `<div class="grid" aria-busy="true" aria-label="${t('c.loading')}">${skelCards()}</div>`; return; }
  const arr = visibleItems();
  res.innerHTML = arr.length ? `<div class="grid">${arr.map(card).join('')}</div>`
    : `<div class="empty">${icon('search')}<b>${t(S.items.length ? 'br.noResults' : 'home.empty')}</b><span>${t(S.items.length ? 'br.noResultsSub' : 'home.emptySub')}</span></div>`;
  hydrate();
}

/* ---------- item detail ---------- */
export function vItem(){
  const id = S.route.params.id; const i = item(id);
  // الغرض غير محمّل (مُسلَّم أو من رابط مشاركة): نجلبه مرة واحدة
  if (!i){ ensureItem(id); if (itemLoading(id)) return `<div class="loading"><span class="spin"></span></div>`; }
  if (!i) return `<div class="wrap">${backBtn()}<div class="empty">${icon('box')}<b>${t('it.gone')}</b></div></div>`;
  const c = cat(i.cat); const o = S.offices.find(x => x.id === i.officeId) || curOffice();
  // الموظف يرى التفاصيل السرية (full)، والزائر يرى الإعلان العام فقط
  const staffMode = staffView(); const f = staffMode ? full(i) : i;
  const keepDays = keepDaysOf(i.cat, o) - daysAgo(i.foundDate);   // مدة التصنيف إن كانت أقصر من مدة المكتب
  const mine = S.myClaims.find(cl => cl.itemId === i.id);   // طلب سابق (بأي حالة)
  const claimBtn = S.uid ? `<button class="btn block" data-act="goClaim" data-id="${esc(i.id)}">${icon('shield')}${t('it.claim')}</button>
      <p class="hint">${t('it.claimHint')}</p>`
    : `<button class="btn block" data-act="login">${icon('shield')}${t('it.loginToClaim')}</button>`;
  let actions = '';
  if (staffMode){
    const cls = S.claims.filter(cl => cl.itemId === i.id).sort((a,b) => b.createdAt - a.createdAt);
    actions = `<div class="btn-row">
        <button class="btn" data-act="editItem" data-id="${esc(i.id)}">${icon('edit')}${t('c.edit')}</button>
        <button class="btn ghost" data-act="itemStatus" data-id="${esc(i.id)}">${icon('swap')}${t('it.changeStatus')}</button>
        <button class="btn ghost" data-act="labels" data-ids="${esc(i.id)}">${icon('qr')}${t('lb.one')}</button>
        <button class="btn danger" data-act="delItem" data-id="${esc(i.id)}">${icon('trash')}${t('c.delete')}</button>
      </div>
      ${rivals(i).length ? `<div class="note warn">${icon('info')}<span>${t('it.rival')}</span></div>` : ''}
      ${cls.length ? `<div class="section-title">${t('it.claims')}</div><div class="list">${cls.map(c => claimCardStaff(c, {open: true})).join('')}</div>` : ''}`;
  } else if (i.status === 'disposed'){
    actions = `<div class="note">${icon('clock')}<span>${t('it.disposed')}</span></div>`;
  } else if (mine && ['expired', 'cancelled'].includes(mine.status)){
    // طلبه انتهت مهلته أو أُلغي: رقم الطلب ثابت فلا يُرسل طلباً جديداً؛ يراجع المكتب فيعيد الموظف تفعيل طلبه
    actions = `<div class="note warn">${icon('clock')}<span>${t(mine.status === 'expired' ? 'it.mineExpired' : 'it.mineCancelled')}</span></div>
      ${o ? `<dl class="facts">${oHours(o) ? `<dt>${t('found.hours')}</dt><dd>${esc(oHours(o))}</dd>` : ''}${o.phone ? `<dt>${t('found.contact')}</dt><dd><span dir="ltr">${esc(o.phone)}</span></dd>` : ''}</dl>` : ''}`;
  } else if (mine?.status === 'rejected'){
    actions = `<div class="note warn">${icon('info')}<span>${t('it.rejected')}</span></div>`;
  } else if (mine){
    actions = `<div class="note ok">${icon('check')}<span>${t('it.hasClaim', {status: `<b>${esc(statusLabel(CLAIM_STATUS[mine.status]))}</b>`})}</span></div>
      <button class="btn soft" data-act="nav" data-r="mine">${t('it.follow')}</button>`;
  } else if (i.status === 'available'){
    actions = claimBtn;
  } else if (i.status === 'reserved'){
    // المحجوز يقبل طلباً منافساً: صاحبه الحقيقي يستطيع الاعتراض قبل التسليم
    actions = `<div class="note warn">${icon('clock')}<span>${t('it.reserved')}</span></div>${claimBtn}`;
  } else if (i.status === 'returned'){
    actions = `<div class="note info">${icon('check')}<span>${t('it.returned')}</span></div>`;
  } else if (i.status === 'archived'){
    actions = `<div class="note">${icon('info')}<span>${t('it.archived')}</span></div>`;
  }
  return `<div class="wrap" data-view="item">${backBtn()}
    <div class="detail">
      <div class="detail-media">
        <div class="detail-photo${isBlur(i) ? ' blurred' : ''}">${icon(c.icon)}${photoImg(i, showTitle(i))}
          ${c.sensitive ? `<div class="veil">${icon('lock')}<span>${t('it.veil')}</span></div>` : ''}
          ${i.sample ? `<span class="badge-sample">${t('it.sample')}</span>` : ''}
        </div>
        ${isBlur(i) ? `<p class="hint">${icon('lock')}${t('it.blurHint')}</p>` : ''}
      </div>
      <div class="panel">
        <div class="panel-head"><span class="ref">${esc(i.ref)}</span>${pill(ITEM_STATUS, i.status)}</div>
        <h1 style="font-size:24px;font-weight:800">${esc(staffMode ? showTitle(f) : showTitle(i))}</h1>
        ${staffMode && f.title !== i.title ? `<span class="meta">${t('it.publicAs', {title: esc(showTitle(i))})}</span>` : ''}
        ${staffMode && f.desc ? `<p>${esc(f.desc)}</p>` : ''}
        <dl class="facts">
          <dt>${t('c.category')}</dt><dd>${icon(c.icon)}${esc(catName(i.cat))}${i.sub ? ' — ' + esc(subLabel(i.sub)) : ''}</dd>
          ${staffMode && f.color ? `<dt>${t('c.color')}</dt><dd>${colorDot(f.color)}${esc(colorName(f.color))}</dd>` : ''}
          ${staffMode && f.brand ? `<dt>${t('st.cmpBrand')}</dt><dd>${esc(f.brand)}</dd>` : ''}
          ${staffMode ? `<dt>${t('if.spot')}</dt><dd>${esc(spotText(f) || t('it.unknown'))}</dd>` : ''}
          <dt>${t('if.date')}</dt><dd>${fmtDate(i.foundDate)} <span class="muted">(${relDay(i.foundDate)})</span></dd>
          ${staffMode && f.storage ? `<dt>${t('if.storage')}</dt><dd>${esc(f.storage)}</dd>` : ''}
          ${i.status === 'disposed' && i.disposal ? `<dt>${t('a.method')}</dt><dd>${disposalLabel(i.disposal)}${i.disposedAt ? ` <span class="muted">(${fmtDate(isoDay(i.disposedAt))})</span>` : ''}</dd>` : ''}
          ${staffMode && f.disposalNote ? `<dt>${t('it.disposalNote')}</dt><dd>${esc(f.disposalNote)}</dd>` : ''}
          ${staffMode && f.handoverNote ? `<dt>${t('it.handoverNote')}</dt><dd>${esc(noteText(f.handoverNote))}</dd>` : ''}
          ${i.status === 'available' || i.status === 'reserved' ? `<dt>${t('setup.keep')}</dt><dd>${keepDays > 0 ? t('it.keepLeft', {days: daysWord(keepDays, true)}) : `<span class="flag">${t('it.keepOver')}</span>`}${staffMode && catKeepNote(i) ? ` <span class="muted">(${catKeepNote(i)})</span>` : ''}</dd>` : ''}
          ${staffMode && f.finderNote ? `<dt>${t('if.finder')}</dt><dd>${esc(f.finderNote)}</dd>` : ''}
        </dl>
        ${actions}
        <button class="btn ghost" data-act="share" data-id="${esc(i.id)}">${icon('share')}${t('it.share')}</button>
      </div>
    </div>
    ${staffMode ? timeline(i) : ''}
    ${o ? `<div class="panel"><div class="section-title">${icon('building')}${t('it.whereCollect')}</div>
      <dl class="facts"><dt>${t('found.office')}</dt><dd>${esc(oPlace(o) || oName(o))}</dd>${oHours(o) ? `<dt>${t('found.hours')}</dt><dd>${esc(oHours(o))}</dd>` : ''}</dl></div>` : ''}
  </div>`;
}

/* ---------- visitor: claim ---------- */
// نموذج الاستلام: يسأل عن التفاصيل المخفية دون أي تلميح من الإعلان، ويقارنها الموظف بالحقيقة
export function vClaimForm(){
  const i = item(S.route.params.id); const o = S.offices.find(x => x.id === i?.officeId) || curOffice();
  if (!i || !ACTIVE.includes(i.status)) return `<div class="wrap">${backBtn()}<div class="empty">${icon('box')}<b>${t('cl.unavailable')}</b></div></div>`;
  if (!S.verified) return `<div class="wrap">${backBtn()}${verifyPrompt(t('cl.verifyWhat'))}</div>`;
  // G3: «تعديل الطلب» (params.edit = رقم الطلب): ما دام قيد المراجعة ولم يسأل الموظف بعد
  const ed = S.route.params.edit ? S.myClaims.find(cl => cl.id === S.route.params.edit && cl.itemId === i.id) : null;
  if (S.route.params.edit && !claimEditable(ed)) return `<div class="wrap">${backBtn()}<div class="note warn">${icon('info')}<span>${t('cl.noEdit')}</span></div>
    <button class="btn soft" data-act="nav" data-r="mine">${t('it.follow')}</button></div>`;
  const prev = ed ? null : S.myClaims.find(cl => cl.itemId === i.id);
  if (prev) return `<div class="wrap" data-view="claim">${backBtn()}<div class="note warn">${icon('info')}<span>${t('cl.already')}</span></div>
    <button class="btn soft" data-act="nav" data-r="mine">${t('it.follow')}</button></div>`;
  // «هذا غرضي — اطلب استلامه» من بلاغ عليه ترشيح: الطلب يُعبّأ من البلاغ تلقائياً ويُربط به (reportId)
  const pre = ed ? null : S.route.params.report ? myReports().find(r => r.id === S.route.params.report && r.status === 'open') : null;
  // بلاغ مفتوح من التصنيف نفسه: نعرض تعبئة الطلب منه
  const rep = pre || ed ? null : myReports().find(r => r.status === 'open' && r.cat === i.cat && r.officeId === i.officeId);
  // أسئلة التصنيف (constants.js): نفس أسئلة الموظف، والإثبات الحر اختياري إن كان في التصنيف سؤال إجباري
  const ids = i.cat === 'ids', proofOpt = claimHasRequired(i.cat), q = claimOf(i.cat);
  const src = ed ? {color: ed.color, brand: ed.brand, details: ed.details || {}} : pre && pre.cat === i.cat ? {color: pre.color, details: pre.details || {}} : {};
  // قيم الخانات عند التعديل: من الطلب نفسه
  const v = ed ? {name: ed.claimantName, last4: ed.idLast4, proof: ed.proof, spot: ed.lostSpot, bldg: ed.bldg, room: ed.room, date: ed.lostDate}
    : {proof: pre?.desc, spot: pre?.spot, bldg: pre?.bldg, room: pre?.room, date: pre?.lostDate};
  // H1: الظاهر افتراضياً: الهوية، والأسئلة المطلوبة للتصنيف، والإقرار. والباقي في «تفاصيل إضافية» المطوية،
  // وتُفتح عند التعديل أو التعبئة من بلاغ أو إن كان فيها قيم. الوصف الحر ظاهر إن كان إجبارياً لهذا التصنيف
  const proofField = `<div class="field"><label for="proof">${t(proofOpt ? 'cl.proofMore' : 'cl.proof')}${proofOpt ? ` <span class="hint">${t('c.optional')}</span>` : ''}</label>
        <textarea id="proof" name="proof" class="input" ${proofOpt ? '' : 'required'}>${esc(v.proof || '')}</textarea>
        <span class="hint">${t(q.hint)}</span></div>`;
  const optVals = [src.brand, v.spot, v.date, v.bldg, v.room, proofOpt ? v.proof : '', q.fields.includes('color') && !q.req.includes('color') ? src.color : '',
    ...q.details.filter(d => !d.as && !detailReq(d, 'claim')).map(d => src.details?.[d.k])];
  const moreOpen = !!ed || !!pre || optVals.some(Boolean);
  return `<div class="wrap" data-view="claim">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('shield')}${t('cl.kicker')}</div><h1 class="hero-title">${t(ed ? 'cl.editTitle' : 'cl.title')}</h1></section>
    ${miniItem(i)}
    ${ed ? `<div class="note info">${icon('edit')}<span>${t('cl.editNote', {no: `<b dir="ltr">${esc(claimNo(ed))}</b>`})}</span></div>` : ''}
    <form data-form="claim" data-id="${esc(i.id)}" ${ed ? `data-edit="${esc(ed.id)}"` : ''} class="panel" novalidate>
      ${rep ? `<div class="note info">${icon('bell')}<span>${t('cl.hasReport', {title: esc(rep.title)})}</span><button type="button" class="btn sm soft" data-act="useReport" data-id="${esc(rep.id)}">${t('cl.useReport')}</button></div>` : ''}
      ${pre ? `<div class="note info">${icon('bell')}<span>${t('cl.fromReport', {title: esc(pre.title)})}</span></div>` : ''}
      <input type="hidden" name="reportId" value="${esc(pre?.id || '')}">
      <div class="field id-box" role="group" aria-labelledby="c-idt"><span class="label" id="c-idt">${icon('idcard')}${t('cl.idTitle')}</span>
        <div class="field"><label for="c-name">${t(ids ? 'cl.nameIds' : 'cl.name')}</label><input id="c-name" name="claimantName" class="input" maxlength="120" autocomplete="name" required value="${esc(v.name || '')}"></div>
        <div class="field"><label for="c-last4">${t(ids ? 'cl.last4Ids' : 'cl.last4')}</label><input id="c-last4" name="idLast4" class="input" inputmode="numeric" maxlength="4" dir="ltr" autocomplete="off" required value="${esc(v.last4 || '')}"></div>
        <span class="hint">${icon('lock')}${t('cl.idPrivate')}</span></div>
      <div id="cat-fields" data-mode="claim">${catFields(i.cat, src, 'claim', 'req')}</div>
      ${proofOpt ? '' : proofField}
      <details class="more-box" id="cl-more" ${moreOpen ? 'open' : ''}>
        <summary>${icon('plus')}<span>${t('cl.more')}</span>${icon('chev')}</summary>
        <div class="more-body">
          <div id="cat-fields-opt">${catFields(i.cat, src, 'claim', 'opt')}</div>
          ${proofOpt ? proofField : ''}
          <div class="field"><label for="c-spot">${t('cl.where')}</label><select id="c-spot" name="spot" class="input">${spotOptions(o, v.spot || '')}</select></div>
          ${spotExtra({spot: v.spot, bldg: v.bldg, room: v.room})}
          <div class="field"><label for="c-date">${t('cl.when')} <span class="hint">${t('c.optional')}</span></label><input id="c-date" name="lostDate" type="date" class="input" max="${today()}" value="${esc(v.date || '')}">
            <span class="hint date-hint" ${v.date ? 'hidden' : ''}>${t('cl.dateHint')}</span></div>
        </div>
      </details>
      <label class="check"><input type="checkbox" name="pledge" id="pledge"><span>${t('cl.pledge')}</span></label>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${t(ed ? 'c.saveEdit' : 'cl.send')}</button>
      <div class="note">${icon('lock')}<span>${t('cl.privacy')}</span></div>
    </form>
  </div>`;
}

/* ---------- visitor: report lost ---------- */
export function vReportForm(){
  if (!S.uid) return `<div class="wrap">${loginPrompt(t('rp.login'))}</div>`;
  if (!S.verified) return `<div class="wrap">${verifyPrompt(t('rp.verifyWhat'))}</div>`;
  // G3: «تعديل» البلاغ (params.id): النموذج نفسه معبّأً بكل حقوله، والحفظ تحديث للبلاغ نفسه
  const r = S.route.params.id ? S.myReports.find(x => x.id === S.route.params.id && x.status === 'open') : null;
  if (S.route.params.id && !r) return `<div class="wrap">${backBtn()}<div class="empty">${icon('bell')}<b>${t('rp.gone')}</b></div></div>`;
  const photoKey = r?.photo && !cat(r.cat).sensitive ? 'r_' + r.id : null;
  resetForm(!!photoKey);
  const o = (r && S.offices.find(x => x.id === r.officeId)) || curOffice();
  const hasSubs = !!r?.cat && cat(r.cat).subs.length > 0;
  return `<div class="wrap" data-view="report">${r ? backBtn() : ''}
    <section class="hero"><div class="hero-kicker">${icon('bell')}${t('rp.kicker', {office: esc(oName(o))})}</div><h1 class="hero-title">${t(r ? 'rp.editTitle' : 'rp.title')}</h1>
      <p class="hero-sub">${t(r ? 'rp.editSub' : 'rp.sub')}</p></section>
    <form data-form="report" class="panel" novalidate ${r ? `data-id="${esc(r.id)}"` : ''}>
      ${photoField(photoKey, t('rp.photo'))}
      <div class="field"><span class="label">${t('c.category')}</span>${catPicker(r?.cat || '')}</div>
      <div class="field" id="subs-field" ${hasSubs ? '' : 'hidden'}><span class="label">${t('c.type')}</span><div id="subs">${hasSubs ? subsPicker(r.cat, r.sub) : ''}</div></div>
      <div id="cat-fields" data-mode="report">${r ? catFields(r.cat, r, 'report') : ''}</div>
      <div class="field"><label for="r-title">${t('rp.name')}</label><input id="r-title" name="title" class="input" required placeholder="${t('rp.namePh')}" maxlength="80" value="${esc(r?.title || '')}"></div>
      <div class="field"><label for="r-desc">${t('rp.desc')}</label><textarea id="r-desc" name="desc" class="input" placeholder="${t('rp.descPh')}" maxlength="600">${esc(r?.desc || '')}</textarea></div>
      <div class="two">
        <div class="field"><label for="r-spot">${t('cl.where')}</label><select id="r-spot" name="spot" class="input">${spotOptions(o, r?.spot || '')}</select></div>
        <div class="field"><label for="r-date">${t('rp.when')}</label><input id="r-date" name="lostDate" type="date" class="input" value="${esc(r?.lostDate || today())}" max="${today()}"></div>
      </div>
      ${spotExtra(r)}
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon(r ? 'check' : 'search')}${t(r ? 'c.saveEdit' : 'rp.send')}</button>
    </form>
    ${r ? `<p class="del-link"><button class="link danger" data-act="delReport" data-id="${esc(r.id)}">${icon('trash')}${t('rp.delete')}</button></p>` : ''}
  </div>`;
}

/* ---------- visitor: my requests («طلباتي»، PR 3) ----------
   الأعلى: «يحتاج انتباهك» (رمز جاهز، سؤال من الموظف، غرض مقترح، تقييم معلّق، بلاغ قديم) بأزرار تفتح البطاقة.
   ثم تبويبات (طلبات الاستلام / بلاغاتي / ما سلّمته) إن كان عند المستخدم أكثر من نوع، وإلا قائمة واحدة.
   كل قائمة: الجاري أولاً (بآخر حدث)، ثم «منتهية (n)» مطوية. البطاقة مختصرة (<details>): العنوان والرقم والحالة
   و«الخطوة التالية»، والضغط يفتح التفاصيل. البطاقة التي تحتاج انتباهاً تُفتح تلقائياً. العرض فقط: البيانات كما هي */
// ما يحتاج انتباه صاحب الطلب أو البلاغ (فارغ = لا شيء)
export function claimNeed(c){
  const i = item(c.itemId), gone = !i && !itemLoading(c.itemId);
  if (c.status === 'approved' && !gone && myCode(c.id) && !(c.pickupBy && Date.now() > c.pickupBy)) return 'code';
  if (awaitingAnswer(c)) return 'answer';
  if (c.status === 'done' && !c.rating) return 'rate';
  return '';
}
export function reportNeed(r){
  if (r.status !== 'open') return '';
  const active = linkedClaim(r);
  if (isStale(r) && !active) return 'stale';
  if (!active && (pickOf(r) || maybeFor(r, 1).length)) return 'sugg';
  return '';
}
const CLAIM_DONE = ['done', 'rejected', 'expired', 'cancelled'];
const claimTitle = c => { const i = item(c.itemId); return i ? showTitle(i) : claimNo(c); };
function attentionBox(cls, reps){
  const rows = [
    ...cls.map(c => [claimNeed(c), c]).filter(([n]) => n).map(([n, c]) => ({msg: t('att.' + n, {title: esc(claimTitle(c))}), tab: 'claims', key: 'c:' + c.id, ended: CLAIM_DONE.includes(c.status), ic: n === 'code' ? 'shield' : n === 'answer' ? 'question' : 'check'})),
    ...reps.map(r => [reportNeed(r), r]).filter(([n]) => n).map(([n, r]) => ({msg: t('att.' + n, {title: esc(r.title)}), tab: 'reports', key: 'r:' + r.id, ended: false, ic: n === 'stale' ? 'clock' : 'bell'})),
  ];
  if (!rows.length) return '';
  return `<section class="attn-box" aria-labelledby="att-t"><h2 class="section-title" id="att-t">${icon('bell')}${t('att.title')} <span class="count">${rows.length}</span></h2>
    <ul class="attn-list">${rows.map(x => `<li>${icon(x.ic)}<span class="grow">${x.msg}</span>
      <button class="btn sm soft" data-act="openCard" data-tab="${x.tab}" data-card="${esc(x.key)}" ${x.ended ? 'data-ended="1"' : ''}>${t('att.open')}</button></li>`).join('')}</ul></section>`;
}
// اسم التبويب المحفوظ (localStorage داخل try/catch عبر LS)
export const MINE_TABS = ['claims', 'reports', 'found'];
export function vMine(){
  if (!S.uid) return `<div class="wrap">${loginPrompt(t('mine.login'))}</div>`;
  const reps = myReports(), cls = myClaims(), fnd = myFound();
  const focus = S.route.params.focus;
  const lists = {claims: cls, reports: reps, found: fnd};
  const types = MINE_TABS.filter(k => lists[k].length);
  // البلاغ أو الإشعار الذي أُنشئ للتو (focus) يُفتح في تبويبه
  if (focus){ const k = reps.some(r => r.id === focus) ? 'reports' : fnd.some(f => f.id === focus) ? 'found' : ''; if (k){ LS.set('mineTab', k); CARD_OPEN.set((k === 'reports' ? 'r:' : 'f:') + focus, true); } }
  const saved = LS.get('mineTab', '');
  const cur = types.includes(saved) ? saved : types[0] || 'claims';
  const dot = {claims: cls.some(claimNeed), reports: reps.some(reportNeed), found: false};
  const tabs = types.length > 1 ? `<div class="tabs" role="tablist" aria-label="${t('mine.tabsAria')}">${types.map(k => `<button role="tab" id="mt-${k}" aria-controls="mp-${k}" aria-selected="${k === cur}" tabindex="${k === cur ? 0 : -1}" data-act="mineTab" data-v="${k}">
      <span>${t('mine.t.' + k)}</span><span class="count">${lists[k].length}</span>${dot[k] ? `<span class="dot" aria-hidden="true"></span><span class="sr-only">${t('mine.attnDot')}</span>` : ''}</button>`).join('')}</div>` : '';
  const panel = types.length ? mineList(cur, lists[cur], focus) : `<div class="empty">${icon('inbox')}<b>${t('mine.emptyAll')}</b><button class="btn soft" data-act="nav" data-r="browse">${icon('search')}${t('home.ctaBrowse')}</button></div>`;
  return `<div class="wrap" data-view="mine">
    <section class="hero"><div class="hero-kicker">${icon('inbox')}${t('mine.kicker')}</div><h1 class="hero-title">${t('nav.mine')}</h1></section>
    ${attentionBox(cls, reps)}
    ${tabs}
    <div ${types.length > 1 ? `role="tabpanel" id="mp-${cur}" aria-labelledby="mt-${cur}" tabindex="0"` : ''} class="mine-panel">${panel}</div>
  </div>`;
}
// قائمة نوع واحد: الجاري أولاً ثم «منتهية (n)» مطوية، وجملة وزر واحد إن لم يكن فيها شيء جارٍ
function mineList(k, arr, focus){
  const isEnded = k === 'claims' ? c => CLAIM_DONE.includes(c.status) : k === 'reports' ? r => r.status !== 'open' : f => f.status !== 'pending';
  const card = k === 'claims' ? claimCardMine : k === 'reports' ? r => reportCardMine(r, r.id === focus) : f => foundCardMine(f, f.id === focus);
  const act = arr.filter(x => !isEnded(x)), done = arr.filter(isEnded);
  const empty = {claims: ['mine.emptyClaims', 'browse', 'search', 'home.ctaBrowse'], reports: ['mine.emptyReports', 'report', 'plus', 'home.ctaLost'], found: ['mine.emptyFound', 'found', 'tag', 'home.ctaFound']}[k];
  return `${act.length ? `<div class="list">${act.map(card).join('')}</div>`
      : `<div class="empty sm">${t(empty[0])}<button class="btn soft" data-act="nav" data-r="${empty[1]}">${icon(empty[2])}${t(empty[3])}</button></div>`}
    ${done.length ? `<details class="ended" data-ended="${k}" ${ENDED_OPEN.get(k) ? 'open' : ''}><summary>${t('mine.ended', {n: done.length})}${icon('chev')}</summary>
      <div class="list">${done.map(card).join('')}</div></details>` : ''}`;
}
/* إشعار التسليم كما يراه الواجد: بانتظار تسليمه ← استلمه المكتب (برقم قيده) ← عاد لصاحبه */
export function foundCardMine(f, focus){
  const it = f.itemId ? item(f.itemId) : null; if (f.itemId && !it) ensureItem(f.itemId);
  const o = S.offices.find(x => x.id === f.officeId);
  const yours = f.status === 'received' && it?.status === 'disposed' && it.disposal === 'finder';   // أُعيد لمن وجده
  const st = yours ? 'yours' : f.status === 'received' && it?.status === 'returned' ? 'returned' : f.status;
  const body = st === 'pending' ? `<div class="note info">${icon('building')}<span>${t('hi.pendingNote', {place: esc(oPlace(o) || oName(o))})}</span></div>
      ${f.code ? `<span class="meta">${t('hi.codeLine')} <span dir="ltr">${esc(f.code)}</span></span>` : ''}
      <div class="btn-row"><button class="btn sm ghost" data-act="cancelFound" data-id="${esc(f.id)}">${icon('x')}${t('hi.cancel')}</button></div>`
    : st === 'returned' ? `<div class="note ok">${icon('check')}<span>${t('hi.returned')}</span></div>
      <div class="btn-row"><button class="btn sm soft" data-act="nav" data-r="thanks" data-id="${esc(f.id)}">${icon('print')}${t('ty.btn')}</button></div>`
    : st === 'yours' ? `<div class="note ok">${icon('check')}<span>${t('hi.yours')}${it ? ` (<b dir="ltr">${esc(it.ref)}</b>)` : ''}</span></div>
      ${o ? `<dl class="facts"><dt>${t('found.office')}</dt><dd>${esc(oPlace(o) || oName(o))}</dd>${oHours(o) ? `<dt>${t('found.hours')}</dt><dd>${esc(oHours(o))}</dd>` : ''}</dl>` : ''}`
    : st === 'received' ? `<div class="note ok">${icon('check')}<span>${it ? t('hi.receivedRef', {ref: `<b>${esc(it.ref)}</b>`}) : t('hi.received')}</span></div>`
    : `<div class="btn-row"><button class="btn sm ghost" data-act="delFound" data-id="${esc(f.id)}">${icon('trash')}${t('c.delete')}</button></div>`;
  const next = st === 'pending' ? t('ns.hand', {place: esc(oPlace(o) || oName(o))}) : t('ns.f.' + st);
  return mcard({key: 'f:' + f.id, open: focus, pillHtml: pill(FOUND_STATUS, st), next,
    head: `${it ? `<span class="ref">${esc(it.ref)}</span>` : f.code ? `<span class="meta" dir="ltr">${esc(f.code)}</span>` : ''}<h3>${esc(f.sub ? subLabel(f.sub) : catName(f.cat))}</h3>`,
    body: `<span class="meta">${icon(cat(f.cat).icon)}${esc([spotText(f), fmtDate(f.foundDate)].filter(Boolean).join(' · '))}</span>
      <span class="meta">${icon('building')}${esc(officeName(f.officeId))}</span>${whenLine('c.sentAt', f.createdAt)}
      ${body}`});
}
export function claimSteps(st){
  const s1 = true, s2 = st === 'approved' || st === 'done', s3 = st === 'done';
  return `<div class="steps"><span class="${s1 ? 'done' : ''}"><i></i>${t('mine.stSent')}</span><span class="sep"></span><span class="${s2 ? 'done' : ''}"><i></i>${t('mine.stApproved')}</span><span class="sep"></span><span class="${s3 ? 'done' : ''}"><i></i>${t('mine.stDone')}</span></div>`;
}
export function claimCardMine(c){
  const i = item(c.itemId); if (!i) ensureItem(c.itemId);
  const gone = !i && !itemLoading(c.itemId);   // الغرض حُذف من المستودع
  const o = S.offices.find(x => x.id === c.officeId); const code = myCode(c.id);
  const late = c.status === 'approved' && c.pickupBy && Date.now() > c.pickupBy;
  let body = '', top = '';
  if (gone && ['pending', 'approved'].includes(c.status)) body = `<div class="note warn">${icon('info')}<span>${t('mine.gone')}</span></div>`;
  // سؤال تحقق من المكتب: بانتظار إجابتك، أو أجبت عنه
  else if (c.status === 'pending' && awaitingAnswer(c)) body = `<div class="note info qa-ask">${icon('question')}<span><b>${t('qa.fromOffice')}</b> ${esc(c.question)}</span></div>
    <button class="btn sm" data-act="answerQ" data-id="${esc(c.id)}" style="align-self:flex-start">${icon('edit')}${t('qa.answerBtn')}</button>`;
  else if (c.status === 'pending') body = `<p class="muted">${t('mine.pending')}</p>${qaBox(c)}
    ${claimEditable(c) && i ? `<button class="btn sm ghost" data-act="editClaim" data-id="${esc(c.id)}" style="align-self:flex-start">${icon('edit')}${t('cl.edit')}</button>` : ''}`;
  else if (c.status === 'approved'){
    // رمز الاستلام في مكان بارز أعلى البطاقة: خط كبير، وزر نسخ، وآخر موعد للاستلام
    if (code) top = `<div class="code-tag code-hero"><small>${t('mine.code')}</small><span class="digits" dir="ltr">${esc(code)}</span>
      <button class="btn sm ghost" data-act="copy" data-v="${esc(code)}">${icon('copy')}${t('c.copy')}</button>
      ${c.pickupBy ? `<small class="${late ? 'late' : ''}">${t(late ? 'st.pickupEnded' : 'mine.codeUntil', {date: `<b>${esc(dateOf(c.pickupBy))}</b>`, when: when(c.pickupBy)})}</small>` : ''}
      <small>${t('mine.codeHint')}</small></div>`;
    body = code ? `<dl class="facts"><dt>${t('st.cmpPlace')}</dt><dd>${esc(oPlace(o) || oName(o))}</dd>${oHours(o) ? `<dt>${t('found.hours')}</dt><dd>${esc(oHours(o))}</dd>` : ''}</dl>`
      : `<div class="note warn">${icon('info')}<span>${t('mine.noCode')}</span></div>
         ${c.pickupBy ? `<div class="note ${late ? 'warn' : 'info'}">${icon('clock')}<span>${t(late ? 'st.pickupEnded' : 'mine.collectBy', {date: `<b>${esc(dateOf(c.pickupBy))}</b>`})}</span></div>` : ''}`;
  }
  else if (c.status === 'done') body = `<div class="note info">${icon('check')}<span>${t('mine.done', {when: relTime(c.doneAt)})}</span></div>${rateBox(c)}`;
  else if (c.status === 'rejected') body = `<div class="note warn">${icon('info')}<span>${c.note ? t('mine.rejectedWhy', {note: esc(noteText(c.note))}) : t('mine.rejected')}</span></div>`;
  else if (c.status === 'expired') body = `<div class="note warn">${icon('clock')}<span>${t('mine.expired')}</span></div>`;
  else if (c.status === 'cancelled') body = `<div class="note">${icon('info')}<span>${c.note ? t('mine.cancelledWhy', {note: esc(noteText(c.note))}) : t('mine.cancelled')}</span></div>`;
  // الخطوة التالية (سطر واحد في الملخّص)
  const need = claimNeed(c);
  const next = gone && ['pending', 'approved'].includes(c.status) ? t('ns.gone')
    : c.status === 'pending' ? t(awaitingAnswer(c) ? 'ns.answer' : 'ns.review')
    : c.status === 'approved' ? (late ? t('ns.late') : c.pickupBy ? t('ns.come', {date: esc(dateOf(c.pickupBy))}) : t('ns.comeNoDate'))
    : c.status === 'done' ? t(c.rating ? 'ns.done' : 'ns.rate') : t('ns.' + c.status);
  return mcard({key: 'c:' + c.id, id: 'claim-' + c.id, open: !!need, tone: need || late ? 'warn' : '', pillHtml: pill(CLAIM_STATUS, c.status), next,
    head: `<span class="refs">${i ? `<span class="ref">${esc(i.ref)}</span>` : ''}<b dir="ltr" class="req-no">${esc(claimNo(c))}</b></span><h3>${esc(i ? showTitle(i) : t(gone ? 'mine.goneTitle' : 'c.loadingDots'))}</h3>`,
    body: `${top}
      <span class="meta">${icon('building')}${esc(officeName(c.officeId))}</span>
      ${['pending', 'approved', 'done'].includes(c.status) && !gone ? claimSteps(c.status) : ''}
      ${claimTimeline(c)}
      ${body}`});
}
/* قياس رضا المستفيد: الطلب المكتمل يُسأل مرة واحدة «كيف كانت تجربتك؟» (5 نجوم وتعليق اختياري) */
// مسودة التقييم: «طلباتي» تُعاد رسمها عند تغيّر البيانات، فنحفظ النجوم والتعليق حتى لا يضيعا
export const RATE_DRAFT = {};
const stars = n => `<span class="stars" role="img" aria-label="${t('rt.aria', {n})}">${[1, 2, 3, 4, 5].map(k => `<span class="${k <= n ? 'on' : ''}" aria-hidden="true">★</span>`).join('')}</span>`;
function rateBox(c){
  if (c.rating) return `<div class="note ok">${stars(c.rating)}<span>${t('rt.thanks')}</span></div>`;
  const dr = RATE_DRAFT[c.id] || {};
  return `<form class="rate" data-form="rate" data-id="${esc(c.id)}" novalidate>
    <b id="rt-q-${esc(c.id)}">${t('rt.q')}</b>
    <div class="star-row" role="group" aria-labelledby="rt-q-${esc(c.id)}">${[1, 2, 3, 4, 5].map(k => `<button type="button" class="star${k <= (dr.rating || 0) ? ' on' : ''}" data-act="rateStar" data-v="${k}" aria-pressed="${k === dr.rating}" aria-label="${t('rt.star', {n: k})}">★</button>`).join('')}</div>
    <input type="hidden" name="rating" value="${dr.rating || ''}">
    <label class="sr-only" for="rt-n-${esc(c.id)}">${t('rt.note')}</label>
    <textarea id="rt-n-${esc(c.id)}" name="ratingNote" class="input" maxlength="300" rows="2" placeholder="${t('rt.note')}">${esc(dr.note || '')}</textarea>
    <div class="form-err" hidden></div>
    <button class="btn sm" type="submit">${icon('check')}${t('rt.send')}</button>
  </form>`;
}
export function reportCardMine(r, focus){
  // ترشيح الموظف يظهر فقط ما دام الغرض متاحاً أو محجوزاً (لا بعد تسليمه لغيرك)، ولم يقل صاحب البلاغ «ليس غرضي»
  const pick = r.status === 'open' ? pickOf(r) : null;
  // «قد يكون لك»: مطابقة صارمة بالبيانات العامة، بلا نسب مئوية، وبلا ما رفضه صاحب البلاغ (G5)
  const cands = r.status === 'open' ? maybeFor(r, 4) : [];
  const no = rejectedOf(r);
  const ai = r.ai?.matches || [];
  // طلب استلام نشط مرتبط بالبلاغ: لا زر إغلاق، بل متابعة الطلب (إن رُفض يعود البلاغ كما كان)
  const active = linkedClaim(r);
  const closeBtn = active ? '' : `<button class="btn sm ghost" data-act="closeReport" data-id="${esc(r.id)}">${icon('check')}${t('rc.foundIt')}</button>`;
  const claimNote = active ? `<div class="note info">${icon('inbox')}<span>${t('rc.hasClaim', {status: `<b>${esc(statusLabel(CLAIM_STATUS[active.status]))}</b>`})}</span>
      <button class="btn sm soft" data-act="showClaim" data-id="${esc(active.id)}">${t('rc.openClaim')}</button></div>` : '';
  // G5: كل غرض مقترح (ترشيح أو «قد يكون لك»): وقت تسجيله في المكتب، وزرّا «هذا غرضي» و«ليس غرضي»
  const sugg = (it, extra = '') => `<div class="sugg">${miniItem(it)}${extra}${whenLine('rc.itemAt', it.createdAt)}
      ${active ? '' : `<div class="btn-row"><button class="btn sm" data-act="goClaim" data-id="${esc(it.id)}" data-report="${esc(r.id)}">${icon('check')}${t('rc.isMine')}</button>
        <button class="btn sm ghost" data-act="notMine" data-id="${esc(r.id)}" data-item="${esc(it.id)}">${icon('x')}${t('rc.notMine')}</button></div>`}</div>`;
  const pickBox = pick ? `<div class="pick-box"><span class="t">${icon('shield')}${t('rc.staffPick')}</span>${sugg(pick, whenLine('rc.pickedAt', r.pickedAt))}</div>` : '';
  const need = reportNeed(r);
  const next = r.status !== 'open' ? t(r.closedReason === 'office' ? 'ns.closedOffice' : r.closedReason === 'self' ? 'ns.closedSelf' : 'ns.closed')
    : need === 'stale' ? t('ns.stale') : active ? t('ns.claim') : need === 'sugg' ? t('ns.sugg') : t('ns.search');
  return mcard({key: 'r:' + r.id, open: focus || !!need, tone: need ? 'warn' : '', pillHtml: pill(REPORT_STATUS, r.status), next,
    head: `<span class="meta">${icon(cat(r.cat).icon)}${esc(catName(r.cat))}</span><h3>${esc(r.title)}</h3>`,
    body: `<div><span class="meta">${icon(cat(r.cat).icon)}${esc(catName(r.cat))}${r.color ? ' · ' + colorDot(r.color) + esc(colorName(r.color)) : ''} · ${t('st.lostOn', {date: relDay(r.lostDate)})}</span><span class="meta">${icon('building')}${esc(officeName(r.officeId))}</span>
      ${whenLine('c.sentAt', r.createdAt)}${whenLine('c.editedAt', r.editedAt)}</div>
    ${r.status === 'open' && isStale(r) && !active ? `<div class="note warn stale">${icon('clock')}<span><b>${t('rc.stillQ')}</b> ${t('rc.stillHint')}</span></div>
      <div class="btn-row"><button class="btn sm" data-act="renewReport" data-id="${esc(r.id)}">${icon('check')}${t('rc.stillYes')}</button>
        <button class="btn sm ghost" data-act="closeReport" data-id="${esc(r.id)}">${icon('check')}${t('rc.stillFound')}</button></div>`
    : r.status === 'open' ? `
      ${claimNote}
      ${pickBox}
      ${cands.length ? `<span class="label">${t('rc.maybe')}</span><div class="list">${cands.map(i => sugg(i)).join('')}</div>
        <p class="hint">${t('rc.maybeHint')}</p>`
        : !pick && !active ? `<div class="note">${icon('clock')}<span>${t('rc.none')}</span></div>` : ''}
      ${ai.length ? `<span class="label">${icon('spark')} ${t('rc.ai')}</span><div class="list">${ai.map(m => { const it = item(m.id); return it && ACTIVE.includes(it.status) && !no.has(it.id) ? `<div>${miniItem(it)}<div class="reason">${esc(m.reason || '')}</div></div>` : ''; }).join('')}</div>`
        : r.ai ? `<div class="note">${icon('spark')}<span>${t('rc.aiNone', {when: relTime(r.ai.at)})}</span></div>` : ''}
      <div class="btn-row">
        ${aiReady() ? `<button class="btn sm soft" data-act="aiMatch" data-id="${esc(r.id)}">${icon('spark')}${t('rc.aiMatch')}</button>` : ''}
        ${closeBtn}
        <button class="btn sm ghost" data-act="editReport" data-id="${esc(r.id)}">${icon('edit')}${t('rc.edit')}</button>
      </div>
      <span class="ai-status" id="ai-${esc(r.id)}"></span>`
    : `${r.closedReason ? `<div class="note ${r.closedReason === 'office' ? 'ok' : ''}">${icon('check')}<span>${t(r.closedReason === 'office' ? 'rc.closedOffice' : 'rc.closedSelf')}</span></div>` : ''}
      <div class="btn-row"><button class="btn sm ghost" data-act="delReport" data-id="${esc(r.id)}">${icon('trash')}${t('rc.delete')}</button></div>`}`});
}
// طلب الاستلام النشط (قيد المراجعة أو مقبول) المرتبط بالبلاغ: عبر reportId أو على الغرض المرشَّح
export const linkedClaim = r => myClaims().find(c => (c.reportId === r.id || (r.staffPick && c.itemId === r.staffPick)) && ['pending', 'approved'].includes(c.status)) || null;

/* ---------- visitor: office info ---------- */
/* أسئلة شائعة — نصوصها في القاموسين (faq.q1… وfaq.a1…)، عدّلها كما تريد */
const FAQ = () => [1, 2, 3, 4, 5, 6, 7].map(n => [t('faq.q' + n), t('faq.a' + n)]);

export function vOffice(){
  const o = curOffice();
  return `<div class="wrap" data-view="office">
    <section class="hero"><div class="hero-kicker">${icon(otype(o.type).icon)}${esc(otypeName(o.type))}${oCity(o) ? ' · ' + esc(oCity(o)) : ''}</div><h1 class="hero-title">${esc(oName(o))}</h1></section>
    <div class="panel">
      <div class="section-title">${icon('building')}${t('ofc.title')}</div>
      <dl class="facts">
        <dt>${t('adm.colOffice')}</dt><dd>${esc(oPlace(o) || '—')}</dd>
        ${oHours(o) ? `<dt>${t('found.hours')}</dt><dd>${esc(oHours(o))}</dd>` : ''}
        ${o.phone ? `<dt>${t('found.contact')}</dt><dd><span dir="ltr">${esc(o.phone)}</span><button class="link" data-act="copy" data-v="${esc(o.phone)}">${icon('copy')}${t('c.copy')}</button></dd>` : ''}
        <dt>${t('ofc.keep')}</dt><dd>${daysWord(o.retentionDays || 90)}</dd>
      </dl>
    </div>
    <button class="btn ghost" data-act="pickOffice">${icon('pin')}${t('ui.changePlace')}</button>
    <div class="panel">
      <h2 class="section-title">${icon('grid')}${t('svc.indexTitle')}</h2>
      <div class="svc-links" role="list">${['claim', 'report', 'handin'].map(id => `<button role="listitem" class="opt" data-act="nav" data-r="service" data-id="${id}">${icon(id === 'claim' ? 'shield' : id === 'report' ? 'bell' : 'tag')}<span class="grow">${t('svc.' + id + '.name')}</span>${icon('fwd')}</button>`).join('')}</div>
      <button class="btn ghost" data-act="nav" data-r="numbers" style="align-self:flex-start">${icon('chart')}${t('num.title')}</button>
    </div>
    <section class="home-sec">
      <div class="sec-head"><h2>${t('ofc.faq')}</h2></div>
      <div class="faq">${FAQ().map(([q, a]) => `<details><summary>${esc(q)}${icon('chev')}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    </section>
    <button class="link" data-act="nav" data-r="privacy" style="align-self:center">${icon('lock')}${t('foot.privacy')}</button>
  </div>`;
}
