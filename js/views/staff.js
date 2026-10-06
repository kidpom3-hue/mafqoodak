// صفحات موظف المكتب: لوحة المكتب، المستودع، طلبات الاستلام، البلاغات، إضافة/تعديل غرض
import { icon, CATS, cat, catName, colorName, subLabel, subName, oName, ITEM_STATUS, CLAIM_STATUS, FOUND_STATUS, REPORT_STATUS, claimOf, keepDaysOf, detailValue, GROUP_EXPIRE_DAYS, isHiddenCat } from '../constants.js';
import { $, $$, esc, today, dayNum, daysAgo, daysWord, fmtDate, relDay, relTime, pill, colorDot, tokens, textScore, norm, spotText, showTitle, fmtDateTime, isoDay, when, latinDigits } from '../utils.js';
import { t, tp, noteText, hasKey } from '../i18n.js';
import { S, curOffice, item, full, ACTIVE, itemLoading, staffCands, strongFor, secretHit, linkOf, claimItemId, groupCands, groupStrong, groupQuestion, groupKeyLabel, answered, ensureLogs, conflictOf, isStale, claimNo, rejectedOf, byLast, ensureItem, staffKeys, staffNew, priorReport, claimerHist, isOwner } from '../state.js';
import { backBtn, relT, relDayT, emptyBox, orphanText, thumbHtml, miniItem, person, catPicker, subsPicker, photoField, photoModePicker, spotOptions, spotExtra, resetForm, addPrefs, AGAIN, catFields, dfLabel, dfOpt, whenLine, claimTimeline, mcard, tabNum, ENDED_OPEN, CARD_OPEN, qaBox, dateOf } from './common.js';
export { qaBox, dateOf };   // H8: نُقلتا إلى common.js (يحتاجهما الزائر دون تحميل لوحة الموظف)
import { hydrate } from '../ui.js';
import { migrateItems, allowMigrationRetry, migrateSpots, allowSpotRetry, migratePublic } from '../migrate.js';
import { MS_NOTE, expireGroupClaim, OPEN, evidenceLocked } from '../workflow.js';
import { emailUser } from '../notify.js';   // H9: ملاحظة مدة الإضافة لا تُعرض في السجل

/* ---------- staff dashboard ---------- */
export function vStaff(){
  const o = curOffice();
  if (S.route.params.tab) { S.staffTab = S.route.params.tab; }
  allowMigrationRetry(); allowSpotRetry();
  return `<div class="wrap" data-view="staff">
    <section class="hero"><div class="hero-kicker">${icon('shield')}${t('st.kicker')}</div><h1 class="hero-title">${esc(oName(o))}</h1></section>
    <div class="stats" id="s-stats" tabindex="0" role="region" aria-label="${t('st.statsAria')}"></div>
    <div class="seg wide" id="s-tabs">
      <button data-act="sTab" data-v="items">${icon('box')}${t('nav.store')}</button>
      <button data-act="sTab" data-v="claims">${icon('inbox')}${t('st.tabClaims')}</button>
      <button data-act="sTab" data-v="reports">${icon('bell')}${t('nav.reports')}</button>
    </div>
    <div id="s-tools"></div>
    <div id="s-body"></div>
  </div>`;
}
let toolsTab = null, bodyTab = null;
// أيام متبقية على نهاية مدة الحفظ (سالبة = تجاوزها). مدة التصنيف تتقدم على مدة المكتب إن كانت أقصر
export const keepLeft = i => keepDaysOf(i.cat, curOffice()) - daysAgo(i.foundDate);
// مدة حفظ خاصة بالتصنيف (أقصر من مدة المكتب)؟ نص قصير يوضحها
export const catKeepNote = i => { const d = keepDaysOf(i.cat, curOffice()); return d < (Number(curOffice()?.retentionDays) || 90) ? t('st.catKeep', {days: daysWord(d)}) : ''; };
// طلبات منافسة: طلبات قيد المراجعة على غرض محجوز لطلب آخر
export const rivals = i => i?.status === 'reserved' ? S.claims.filter(c => c.itemId === i.id && c.status === 'pending' && c.id !== i.reservedFor) : [];
// انتهت مهلة الاستلام للطلب المقبول؟
export const pickupOver = c => c.status === 'approved' && c.pickupBy && Date.now() > c.pickupBy;

export function updateStaff(){
  const it = S.items;
  const pend = S.claims.filter(c => c.status === 'pending').length;
  const openR = S.reports.filter(r => r.status === 'open').length;
  const over = it.filter(i => i.status === 'available' && keepLeft(i) < 0).length;
  const late = S.claims.filter(pickupOver).length;
  // H23: مربعات الأرقام ظاهرة في كل التبويبات (لا يقفز شريط التبويبات عند التبديل)
  $('#s-stats').innerHTML = `
    <div class="stat"><b>${it.filter(i => i.status === 'available').length}</b><span>${t('home.statAvail')}</span></div>
    <div class="stat"><b>${it.filter(i => i.status === 'reserved').length}</b><span>${t('st.sReserved')}</span></div>
    <div class="stat ${pend ? 'hot' : ''}"><b>${pend}</b><span>${t('st.sNew')}</span></div>
    <div class="stat"><b>${openR}</b><span>${t('st.sOpenR')}</span></div>
    <div class="stat"><b>${S.counts.returned ?? '…'}</b><span>${t('home.statReturned')}</span></div>
    ${over ? `<div class="stat hot"><b>${over}</b><span>${t('st.overKeep')}</span></div>` : ''}
    ${late ? `<div class="stat hot"><b>${late}</b><span>${t('st.sLate')}</span></div>` : ''}`;
  $$('#s-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === S.staffTab));
  // H2: في الجوال (تحت 768px) «أضف غرضاً» زر رئيسي بعرض كامل (add-full) والأدوات الثلاث في «المزيد» (more-btn)؛
  // وفي الكمبيوتر كما كانت: الزر في صف البحث (add-inline) والأدوات ظاهرة (tools-row). الإظهار والإخفاء في CSS
  if (toolsTab !== S.staffTab || !$('#s-tools').innerHTML){
    toolsTab = S.staffTab;
    $('#s-tools').innerHTML = S.staffTab === 'items' ? `<div class="filters">
        <label class="searchbar" style="flex:1;min-width:200px">${icon('search')}<input id="sq" type="search" placeholder="${t('st.searchPh')}" value="${esc(S.staffQ)}" aria-label="${t('st.searchAria')}"></label>
        <select class="select-sm" id="sstatus" aria-label="${t('st.status')}">
          <option value="active">${t('st.fActive')}</option><option value="returned">${t('st.fReturned')}</option><option value="archived">${t('st.fArchived')}</option><option value="disposed">${t('st.fDisposed')}</option><option value="all">${t('st.fAll')}</option>
        </select>
        <button class="btn sm add-inline" data-act="nav" data-r="add">${icon('plus')}${t('nav.add')}</button>
        <button class="btn sm ghost more-btn" data-act="staffMore">${icon('dots')}${t('st.more')}</button>
      </div>
      <button class="btn block add-full" data-act="nav" data-r="add">${icon('plus')}${t('nav.add')}</button>
      <div class="btn-row tools-row">
        <button class="btn sm ghost" data-act="labelsMenu">${icon('qr')}${t('lb.menu')}</button>
        <button class="btn sm ghost" data-act="poster">${icon('print')}${t('po.btn')}</button>
        <button class="btn sm ghost" data-act="stats">${icon('chart')}${t('sx.btn')}</button>
      </div>` : S.staffTab === 'claims' ? `<div class="filters">
        <label class="searchbar" style="flex:1;min-width:200px">${icon('search')}<input id="cq" type="search" dir="ltr" autocomplete="off" placeholder="REQ-7K3M" value="${esc(S.claimQ)}" aria-label="${t('st.claimSearch')}"></label>
      </div>` : `<div class="filters">
        <label class="searchbar" style="flex:1;min-width:200px">${icon('search')}<input id="rq" type="search" autocomplete="off" placeholder="${t('st.reportSearchPh')}" value="${esc(S.reportQ)}" aria-label="${t('st.reportSearch')}"></label>
      </div>`;   // H23: البلاغات أيضاً فيها بحث بالمكان والحجم نفسيهما
    const ss = $('#sstatus'); if (ss) ss.value = S.staffStatus;
  }
  $('#s-body').innerHTML = S.staffTab === 'claims' ? staffClaims() : S.staffTab === 'reports' ? staffReports() : staffItems();
  // H23: ظهور خفيف (150ms) عند تبديل التبويب فقط، لا مع كل تحديث حي (يحترم prefers-reduced-motion في CSS)
  if (bodyTab !== S.staffTab){ bodyTab = S.staffTab; const b = $('#s-body'); b.classList.remove('tab-in'); void b.offsetWidth; b.classList.add('tab-in'); }
  hydrate();
  migrateItems();   // نقل تفاصيل الأغراض القديمة إلى الملف السري (مرة واحدة)
  migrateSpots();   // نقل مكان العثور من الإعلان العام إلى الملف السري (المرحلة E5)
  migratePublic();  // H16: حقل public لكل غرض قديم (مرة واحدة لكل جهاز ومكتب)
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
  // H18: الأحدث أولاً بآخر حدث على الغرض (تسجيله أو آخر تعديل/تغيير حالة)
  arr.sort((a, b) => Math.max(b.updatedAt || 0, b.createdAt || 0) - Math.max(a.updatedAt || 0, a.createdAt || 0));
  const head = st === 'active' ? retentionBox() : '';
  if (!arr.length) return head + `<div class="empty">${icon('box')}<b>${t('st.noItems')}</b>${st === 'active' ? `<button class="btn soft" data-act="nav" data-r="add">${icon('plus')}${t('st.firstItem')}</button>` : ''}</div>`;
  return head + `<div class="list">${arr.map(i => { const left = keepLeft(i), rv = rivals(i).length; return `
    <div class="row" role="button" tabindex="0" data-act="openItem" data-id="${esc(i.id)}">
      ${thumbHtml(i)}
      <div class="row-main">
        <div class="row-top"><span class="ref">${esc(i.ref)}</span>${pill(ITEM_STATUS, i.status)}${rv ? `<span class="pill bad">${t('st.rival')}</span>` : ''}${i.sample ? `<span class="pill mute">${t('c.sample')}</span>` : ''}</div>
        <div class="row-title">${esc(showTitle(i))}</div>
        <div class="meta">${esc(spotText(i))} · ${relDayT(i.foundDate)}${i.storage ? ' · ' + esc(i.storage) : ''}${i.status === 'available' && left < 0 ? ` · <span class="flag">${t('st.overKeep')}</span>` : i.status === 'available' && left <= 7 ? ` · <span class="flag">${left ? t('st.keepIn', {days: daysWord(left)}) : t('st.keepToday')}</span>` : ''}</div>
      </div>
    </div>`; }).join('')}</div>`;
}
/* سجل الحيازة (للموظف): كل ما حدث للغرض من تسجيله إلى تسليمه، من قيود logs.
   الأغراض الأقدم من السجل تبدأ بتاريخ تسجيلها. */
/* H21: اسم العملية من القاموس (log.<action>) لكل عملية لها مفتاح، بدل قائمة ثابتة كانت تُظهر link وexpire وغيرها بالإنجليزية */
export const logLabel = a => hasKey('log.' + a) ? t('log.' + a) : esc(a);
// صاحب الطلب: من الطلب المحمّل، وإلا من رقمه ({itemId}_{uid}، أو g_{uid}_{cat}_{وقت} للطلب بالوصف)
const claimUid = id => [...S.claims, ...(S.claimHist || [])].find(c => c.id === id)?.uid || (id.startsWith('g_') ? id.split('_')[1] : id.slice(id.indexOf('_') + 1));
export function timeline(i){
  ensureLogs(i);
  const L = S.logs[i.id];
  const head = `<div class="section-title">${icon('clock')}${t('tl.title')}</div>`;
  if (!Array.isArray(L)) return `<div class="panel">${head}<div class="loading sm" aria-busy="true"><span class="spin"></span></div></div>`;
  const claims = [...S.claims, ...(S.claimHist || [])].filter((c, k, a) => c.itemId === i.id && a.findIndex(x => x.id === c.id) === k);
  const events = [...(L.some(e => e.action === 'create') ? [] : [{action: 'create', at: i.createdAt, by: i.createdBy, legacy: true}]), ...L,
    ...claims.map(c => ({action: 'claim', at: c.createdAt, claimId: c.id}))].sort((a, b) => (a.at || 0) - (b.at || 0));
  return `<div class="panel">${head}
    <ol class="timeline">${events.map(e => {
      const claimant = e.claimId ? claimUid(e.claimId) : '';
      return `<li class="tl-${esc(e.action.split(':')[0])}"><span class="tl-dot" aria-hidden="true"></span><div class="tl-body">
        <b>${logLabel(e.action)}</b>
        <span class="meta">${fmtDateTime(e.at)}${e.by ? ` · ${t('tl.by')} ${person(e.by)}` : ''}</span>
        ${claimant ? `<span class="meta">${t('tl.claimant')} ${person(claimant)}</span>` : ''}
        ${e.note && !MS_NOTE.test(e.note) ? `<span class="tl-note">${esc(noteText(e.note))}</span>` : ''}
      </div></li>`; }).join('')}</ol>
    ${events.length < 2 ? `<p class="hint">${t('tl.hint')}</p>` : ''}
  </div>`;
}
/* مقارنة إجابات صاحب الطلب بالحقيقة (من itemSecrets) */
// H22: لا «لم يحدد» في عمود النتيجة: ما لم يقله صاحب الطلب ظاهر في عموده («لم يذكر»)، والنتيجة فارغة
const OK = '<span class="v ok">✓</span>', OK2 = '<span class="v ok">✓✓</span>', NO = '<span class="v bad">✗</span>';
// H23: ≈ قريب (أصفر): مبلغ تقريبي ضمن الهامش لا مطابق تماماً، أو نص حرّ يشترك في كلمة فقط
const NEAR = '<span class="v near" title="≈">≈</span>';
const isRes = v => v === OK || v === OK2 || v === NO || v === NEAR;
/* مقارنة إجابة سؤال التصنيف بالحقيقة: ✓ أو ✗، أو '' بلا نتيجة
   الأرقام وآخر 4 والاختيار: تطابق تام · التقريبي: الفرق ضمن الأكبر من 20% أو 20 ريالاً
   النص الحر: ✓ إذا احتوى أحدهما الآخر أو اشتركا في كلمة من 3 أحرف فأكثر، ولا ✗ آلياً على نص حر أبداً */
// G1: الأعداد (10 فأكثر) في نص حرّ، بعد تحويل ٠-٩ و۰-۹ إلى 0-9 وحذف فاصل الآلاف: «٢٠٠ ريال» ← 200
export const numsOf = s => (latinDigits(s).replace(/(\d)[,\u066C](?=\d{3}\b)/g, '$1').match(/\d+/g) || []).map(Number).filter(n => n >= 10);
// نصان حرّان فيهما العدد نفسه (مثل المبلغ 200) = ✓ (ولا ✗ آلياً على النص الحرّ أبداً)
export const sameNumber = (a, b) => { const B = new Set(numsOf(b)); return numsOf(a).some(n => B.has(n)); };
export function detailCheck(d, said, truth){
  const a = detailValue(d, said), b = detailValue(d, truth);
  if (!a || !b) return '';
  if (d.type === 'num' || d.type === 'last4' || d.type === 'pick') return a === b ? OK : NO;
  if (d.type === 'approx'){ const x = Number(a), y = Number(b); return x === y ? OK : Math.abs(x - y) <= Math.max(0.2 * Math.max(x, y), 20) ? NEAR : NO; }
  const na = norm(a), nb = norm(b);
  if (na && nb && (na.includes(nb) || nb.includes(na))) return OK;
  if (sameNumber(a, b)) return OK;
  const tb = new Set(tokens(b).filter(w => w.length >= 3));
  return tokens(a).some(w => w.length >= 3 && tb.has(w)) ? NEAR : '';
}
/* H23: الفئات بصيغة مقروءة: «2 200» أو «200×2» ← «2 × 200 ريال». كل جزء (مفصول بفاصلة أو «و») فيه عددان: الفئة المعروفة والعدد */
const DENOMS = [1, 5, 10, 20, 50, 100, 200, 500];
export function fmtDenoms(s){
  return String(s || '').split(/[\u060C,\u061B;\n]+|\s+\u0648\s*/).map(p => p.trim()).filter(Boolean).map(p => {
    const n = (latinDigits(p).match(/\d+/g) || []).map(Number);
    if (n.length !== 2) return esc(p);
    const [x, y] = n, v = DENOMS.includes(y) && (!DENOMS.includes(x) || y > x) ? y : x, k = v === y ? x : y;
    return `<bdi>${t('df.denomsItem', {n: k, v})}</bdi>`;
  }).join(t('c.listSep'));
}
// ما قاله صاحب الطلب في سؤال: من claims.details، أو من حقل موجود في الطلب (as: الاسم وآخر 4 أرقام)
const saidOf = (c, d) => d.as ? c[d.as] || '' : c.details?.[d.k] || '';
// اللون ظاهر للعامة في الصورة الواضحة أو المموّهة (التمويه لا يخفي اللون)، فلا يُحسب دليلاً
const SEEN = () => `<span class="v mute">${t('st.inPhoto')}</span>`;
export const colorPublic = f => f?.photo === 'clear' || f?.photo === 'blur' || f?.photo === true;
// نتيجة المقارنة الآلية (تُستخدم في الجدول وفي تحذير القبول). المبدأ: ما يراه الزائر لا يُحسب دليلاً.
//   المكان: سري (المرحلة E5) فيُحسب · اللون: يُحسب فقط إن كانت الصورة العامة مخفية أو غير موجودة
//   التاريخ: ظاهر للعامة، فلا ✓ أبداً ولا يدخل في total، و✗ فقط إن كان مستحيلاً (فُقد بعد العثور أو قبله بأكثر من 14 يوماً)
// total = عدد الصفوف التي لها نتيجة (✓ أو ✗) دون التاريخ، وhits = المتطابق منها
export function claimChecks(c, f){
  const q = claimOf(f?.cat);
  const color = !q.fields.includes('color') ? '' : colorPublic(f) ? SEEN() : !c.color ? '' : !f?.color ? '' : c.color === f.color ? OK : NO;
  const place = !c.lostSpot ? '' : !f?.spot ? '' : c.lostSpot !== f.spot ? NO : (c.bldg && c.bldg === f.bldg ? OK2 : OK);
  const gap = c.lostDate && f?.foundDate ? dayNum(f.foundDate) - dayNum(c.lostDate) : null;
  const date = !c.lostDate ? '' : gap === null ? '' : gap < 0 || gap > 14 ? NO : '';
  const det = q.details.map(d => ({d, said: saidOf(c, d), truth: f?.details?.[d.k] || ''})).map(x => ({...x, v: detailCheck(x.d, x.said, x.truth)}));
  // وصف الإثبات الحرّ مقابل الوصف السري: ✓ فقط إن ذكر الاثنان العدد نفسه، وبلا ✗ أبداً
  const proof = c.proof && f?.desc && sameNumber(c.proof, f.desc) ? OK : '';
  const all = [color, place, proof, ...det.map(x => x.v)];
  // v7: بلاغ صاحب الطلب المسجَّل قبل العثور على الغرض: أقوى دليل. كل ✓ منه بوزن مضاعف في الملخص
  const rep = priorReport(c, f), rc = rep ? reportChecks(rep, f) : [];
  const repVals = rc.map(x => x.v);
  const hits = all.filter(v => v === OK || v === OK2 || v === NEAR).length + 2 * repVals.filter(v => v === OKR).length;
  const total = all.filter(isRes).length + 2 * repVals.filter(v => v === OKR || v === NO).length;
  return {color, place, date, proof, det, rep, rc, hits, total};
}
/* v7: مقارنة تفاصيل البلاغ السابق (ما كتبه صاحبه قبل أن يُسجَّل الغرض) بما سجّله المكتب سراً.
   بالمبادئ نفسها: التاريخ لا يأخذ ✓ أبداً (✗ فقط إن كان مستحيلاً)، واللون فقط إن لم تُظهره الصورة العامة، والوصف ✓ عند العدد نفسه */
const OKR = '<span class="v ok">✓</span>';
function reportChecks(r, f){
  const q = claimOf(f.cat), rows = [];
  if (r.desc) rows.push({k: 'st.cmpProof', said: esc(r.desc), truth: f.desc ? esc(f.desc) : '', v: f.desc && sameNumber(r.desc, f.desc) ? OKR : ''});
  if (q.fields.includes('color') && r.color) rows.push({k: 'c.color', said: esc(colorName(r.color)), truth: esc(colorName(f.color) || ''), v: colorPublic(f) ? SEEN() : !f.color ? '' : r.color === f.color ? OKR : NO});
  if (r.spot) rows.push({k: 'st.cmpPlace', said: esc(spotText(r)), truth: esc(spotText(f) || ''), v: !f.spot ? '' : r.spot === f.spot ? OKR : NO});
  if (r.lostDate){ const g = f.foundDate ? dayNum(f.foundDate) - dayNum(r.lostDate) : null;
    rows.push({k: 'st.cmpDate', said: esc(fmtDate(r.lostDate)), truth: f.foundDate ? esc(fmtDate(f.foundDate)) : '', v: g !== null && (g < 0 || g > 14) ? NO : ''}); }
  for (const d of q.details){ const said = r.details?.[d.k] || '', truth = f.details?.[d.k] || ''; if (!said) continue;
    const v = detailCheck(d, said, truth); rows.push({label: dfLabel(f.cat, d.k), said: esc(said), truth: esc(truth), v: v === OK || v === OK2 ? OKR : v}); }
  return rows;
}
// تنبيه تضارب المصالح: صاحب الطلب هو من سلّم الغرض للمكتب، أو الموظف الذي سجّله
export const conflictNote = kind => kind ? `<div class="note bad conflict" role="alert">${icon('alert')}<span><b>${t(kind === 'finder' ? 'st.conflictFinder' : 'st.conflictRecorder')}</b></span></div>` : '';
function claimCompare(c, f){
  if (!f) return '';
  const said = x => x ? esc(x) : `<span class="muted">${t('st.notSaid')}</span>`, truth = x => x ? esc(x) : '<span class="muted">—</span>';
  // اللون: مطابقة تلقائية إن لم تكن الصورة العامة تُظهره · المكان: ✓ المنطقة نفسها، ✓✓ والمبنى نفسه
  // التاريخ: ظاهر للعامة، فلا ✓ له، و✗ فقط إن كان مستحيلاً
  // أسئلة التصنيف: إجابة صاحب الطلب بجانب ما سجّله الموظف (الغرض القديم بلا إجابات: «—» بلا نتيجة)
  const {color, place, date, proof, det, rep, rc, hits, total} = claimChecks(c, f);
  // H23: تنبيه واضح إذا كان الفرق بين تاريخ الفقد وتاريخ تسجيل الغرض كبيراً (أكثر من أسبوع) أو فُقد بعد العثور
  const gapDays = c.lostDate && f.foundDate ? dayNum(f.foundDate) - dayNum(c.lostDate) : null;
  const q = claimOf(f.cat), kind = conflictOf(c, f);
  // H23: على الجوال يصبح كل صف بطاقة: اسم السؤال، ثم «وصف صاحب الطلب» و«بيانات الغرض المسجّل» تحت بعض (data-l)
  const row = (k, a, b, v = '') => `<div class="cmp-row"><b>${k}</b><span data-l="${t('st.cmpSaid')}">${a}</span><span data-l="${t('st.cmpTruth')}">${b}</span>${v || '<span class="v"></span>'}</div>`;
  const card = `<span class="muted">${t('st.onCard')}</span>`;
  const asKeys = q.details.filter(d => d.as).map(d => d.as);
  // عرض الإجابة: اسم الخيار من القاموس، والأرقام من اليسار لليمين
  const fmt = (d, v) => d.k === 'denoms' ? fmtDenoms(v) : d.type === 'pick' ? ((d.opts || []).includes(v) ? dfOpt(d.k, v) : esc(v)) : d.type === 'text' ? esc(v) : `<span dir="ltr">${esc(v)}</span>`;
  const none = `<span class="muted">${t('st.notSaid')}</span>`;
  // H22: سؤال لم يُجب عنه صاحب الطلب ولم يُسجَّل له شيء في المكتب لا يفيد المقارنة: يُجمع في سطر واحد بدل صف «لم يحدد | —»
  const empty = [];
  const opt = (has, label, ...rest) => has ? row(label, ...rest) : (empty.push(label), '');
  return `<div class="cmp${kind ? ' cmp-conflict' : ''}">
    ${kind ? `<div class="cmp-alert">${icon('alert')}<span>${t(kind === 'finder' ? 'st.conflictShortF' : 'st.conflictShortR')}</span></div>` : ''}
    <div class="cmp-row cmp-head"><b></b><span>${t('st.cmpSaid')}</span><span>${t('st.cmpTruth')}</span><span class="v"></span></div>
    ${asKeys.includes('claimantName') ? '' : row(t('st.cmpName'), said(c.claimantName), card)}
    ${asKeys.includes('idLast4') ? '' : row(t('st.cmpLast4'), c.idLast4 ? `<span dir="ltr">${esc(c.idLast4)}</span>` : said(''), card)}
    ${f.finderNote ? row(t('st.cmpFinder'), '<span class="muted">—</span>', esc(f.finderNote)) : ''}
    ${det.map(x => opt(x.said || x.truth || x.d.as || x.v, dfLabel(f.cat, x.d.k), x.said ? fmt(x.d, x.said) : none, x.truth ? fmt(x.d, x.truth) : x.d.as ? card : truth(''), x.v)).join('')}
    ${q.fields.includes('color') ? opt(c.color || f.color, t('c.color'), said(colorName(c.color)), truth(colorName(f.color)), color) : ''}
    ${row(t('st.cmpPlace'), said(spotText({spot: c.lostSpot, bldg: c.bldg, room: c.room})), truth(spotText(f)), place)}
    ${row(t('st.cmpDate'), said(c.lostDate && fmtDate(c.lostDate)), truth(f.foundDate && t('st.foundOn', {date: fmtDate(f.foundDate)})), date)}
    ${q.fields.includes('brand') ? opt(c.brand || f.brand, t('st.cmpBrand'), said(c.brand), truth(f.brand)) : ''}
    ${opt(c.proof || f.desc, t('st.cmpProof'), said(c.proof), truth(f.desc), proof)}
    ${c.question ? row(`${t('st.cmpQA')}: <span class="cmp-q">${esc(c.question)}</span>`, answered(c) ? esc(c.answer) : `<span class="muted">${t(c.status === 'pending' ? 'qa.waiting' : 'qa.none')}</span>`, '<span class="muted">—</span>') : ''}
    ${rep ? `<div class="cmp-row cmp-head cmp-rep"><b>${icon('bell')}${t('st.fromPrior')}</b><span>${t('st.cmpInReport')}</span><span>${t('st.cmpTruth')}</span><span class="v"></span></div>
      ${rc.map(x => row(x.label || t(x.k), x.said || '<span class="muted">—</span>', x.truth || '<span class="muted">—</span>', x.v ? x.v.replace('✓</span>', `✓ <small>${t('st.fromReport')}</small></span>`) : '')).join('')}` : ''}
    ${gapDays !== null && (gapDays < 0 || gapDays > 7) ? `<p class="cmp-warn">${icon('alert')}<span>${t(gapDays < 0 ? 'st.gapBefore' : 'st.gapWarn', {days: tp('n.days', Math.abs(gapDays))})}</span></p>` : ''}
    ${empty.length ? `<p class="cmp-empty">${t('st.cmpEmpty', {list: empty.join(t('c.listSep'))})}</p>` : ''}
    <div class="cmp-sum">${t('st.cmpSum', {n: hits, total})}${rep ? ` <span class="muted">${t('st.priorWeight')}</span>` : ''}</div>
  </div>`;
}
// سؤال التحقق وإجابته (للموظف ولصاحب الطلب)
// مدة بالساعات أو الأيام (للموظف: منذ متى ينتظر الطلب، وكم بقي على مهلة الحضور)
const durText = ms => ms < 36e5 ? t('n.lessHour') : ms < 864e5 ? tp('n.hours', Math.round(ms / 36e5)) : tp('n.days', Math.round(ms / 864e5));
/* H11: الطلب المجمّع (بالوصف) قبل ربطه بغرض: إجابات صاحبه، والمرشّحون بعد الفلاتر الإلزامية (3 على الأكثر)،
   و«مطابقة مؤكدة» مع زر «تأكيد» (لا ربط دون ضغطة الموظف)، أو سؤال تحقق جاهز يفرّق بين مرشّحين متقاربين */
function groupAnswers(c){
  // خيار الاختيار من القائمة فقط يُترجم؛ أي قيمة أخرى (بيانات تالفة) تُعرض نصاً مهرّباً
  const det = c.details && typeof c.details === 'object' ? c.details : {};
  const rows = claimOf(c.cat).details.filter(d => !d.as && det[d.k]).map(d => [dfLabel(c.cat, d.k), d.k === 'denoms' ? fmtDenoms(det[d.k]) : d.type === 'pick' && (d.opts || []).includes(det[d.k]) ? dfOpt(d.k, det[d.k]) : esc(det[d.k])]);
  if (c.lostSpot) rows.push([t('cl.where'), esc(spotText({spot: c.lostSpot, bldg: c.bldg, room: c.room}))]);
  if (c.lostDate) rows.push([t('cl.when'), fmtDate(c.lostDate)]);
  return `<dl class="facts grp-answers">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${c.proof ? `<div class="proof">${esc(c.proof)}</div>` : ''}`;
}
function groupBox(c, own){
  // H23: «مطابقة مؤكدة» فقط من 85% فأكثر؛ دونها بالشروط نفسها «مطابقة محتملة»
  const cands = groupCands(c), strong = groupStrong(c, cands), likely = strong ? null : groupStrong(c, cands, 0), qk = strong ? '' : groupQuestion(c, cands);
  const what = groupKeyLabel(c);
  if (!cands.length) return `<div class="note">${icon('clock')}<span>${t('gc.noCands')}</span></div>`;
  const q = qk ? t(qk) : '';
  return `<span class="label">${t(strong ? 'gc.strongTitle' : likely ? 'gc.likelyTitle' : 'gc.candsTitle')}</span>
    <div class="list">${cands.map(({i, s}) => `<div class="cand">
      <div class="btn-row" style="align-items:center;flex-wrap:nowrap">${miniItem(i, `<span class="score">${s}%</span>`)}
        ${own ? '' : `<button class="btn sm ${strong?.i.id === i.id ? '' : 'soft'}" data-act="linkClaim" data-id="${esc(c.id)}" data-i="${esc(i.id)}">${icon('check')}${t(strong?.i.id === i.id ? 'gc.confirm' : 'gc.link')}</button>`}</div>
      ${whenLine('rc.itemAt', i.createdAt)}
      ${strong?.i.id === i.id ? `<span class="meta hit-line">${icon('shield')}${t('gc.strong', {what})}</span>` : likely?.i.id === i.id ? `<span class="meta hit-line near">${icon('info')}${t('gc.likely', {what})}</span>` : ''}</div>`).join('')}</div>
    ${q && !own ? `<div class="note info gq">${icon('question')}<span>${t('gc.qHint')}<br><b>${esc(q)}</b></span>
      <button class="btn sm soft" data-act="askSugg" data-id="${esc(c.id)}" data-q="${esc(q)}">${t('gc.qSend')}</button></div>` : ''}`;
}
// H11: طلبات مجمّعة بلا مطابقة منذ 30 يوماً تُغلق «منتهية» عند فتح لوحة الموظف (مرة واحدة لكل طلب)، ويُبلَّغ صاحبها
const EXPIRING = new Set();
function expireOld(){
  for (const c of S.claims){
    if (!c.grouped || c.itemId || c.status !== 'pending' || linkOf(c) || (c.uid === S.uid && !isOwner()) || EXPIRING.has(c.id)) continue;
    if (Date.now() - (c.createdAt || 0) < GROUP_EXPIRE_DAYS * 864e5) continue;
    EXPIRING.add(c.id);
    expireGroupClaim(c).then(ok => { if (ok) emailUser(c.uid); }).catch(e => console.warn(e));
  }
}
/* H13a: طلب يتيم = مفتوح (قيد المراجعة أو مقبول) وغرضه محذوف أو غير نشط بعد جلبه من الخادم */
function isOrphan(c){
  if (!OPEN.includes(c.status)) return false;
  const iid = claimItemId(c); if (!iid) return false;
  const i = item(iid);
  if (!i){ ensureItem(iid); return !itemLoading(iid); }
  return !ACTIVE.includes(i.status);
}
// الطلبات اليتيمة التي يستطيع الموظف إغلاقها (لا طلبه هو): للتنبيه أعلى «الاستلام» وزر «إغلاقها كلها»
export const orphanClaims = () => S.claims.filter(c => (c.uid !== S.uid || isOwner()) && isOrphan(c));
export function claimCardStaff(c, opts){
  // H11: الطلب المجمّع: الغرض المربوط (claimLinks) قبل القبول، ورقمه في الطلب بعده
  const lk = c.grouped && !c.itemId ? linkOf(c) : null, unlinked = !!c.grouped && !c.itemId && !lk;
  // H17: بلاغ النقود: «قبول» دائماً، حتى بلا مرشّح أو ربط (المكتب يحتفظ بالمبلغ وقد لا يكون مسجّلاً)؛ الربط بمرشّح يبقى اختيارياً
  const cashDirect = unlinked && isHiddenCat(c.cat);
  // H13a: الغرض غير محمّل (S.items فيها النشطة فقط): نجلبه مرة واحدة ونعرض «جارٍ التحميل». بعد الجلب، إن كان
  // محذوفاً أو غير نشط والطلب مفتوح = طلب يتيم: عنوان «غرض غير متاح»، وحالته، وزر واحد «إغلاق الطلب»
  const iid = claimItemId(c), i = item(iid);
  if (!i && iid) ensureItem(iid);
  const loadingIt = !i && !!iid && itemLoading(iid);
  const orphan = isOrphan(c);
  // تحذير: طلبات كثيرة من المستخدم نفسه في هذا المكتب خلال 30 يوماً
  const all = [...S.claims, ...(S.claimHist || []).filter(h => !S.claims.some(x => x.id === h.id))];
  const month = c.uid === 'deleted' ? 0 : all.filter(x => x.uid === c.uid && x.createdAt >= Date.now() - 30 * 864e5).length;
  const own = c.uid === S.uid && !isOwner();   // فصل المهام: لا يقرر الموظف في طلب أرسله هو (H18: إلا المالك)
  const late = pickupOver(c);
  const rv = c.status === 'approved' && i ? rivals(i).length : 0;
  const kind = i && ['pending', 'approved'].includes(c.status) ? conflictOf(c, full(i)) : '';
  const tip = i && ['pending', 'approved'].includes(c.status) && cat(i.cat).staffCheck ? `<div class="note info">${icon('shield')}<span>${t(cat(i.cat).staffCheck)}</span></div>` : '';
  // الطلب المنتهي أو الملغى يُعاد تفعيله من سجل الطلبات (الغرض متاح ← مقبول ومحجوز له، وإلا ← قيد المراجعة)
  // v14 (H19): لا إعادة تفعيل لطلب ألغاه صاحبه (cancelledAt)؛ القواعد تمنعه أيضاً. H21: ولا لطلب بالوصف أُغلق دون ربط (لا غرض له)
  const again = !own && ['expired', 'cancelled'].includes(c.status) && c.uid !== 'deleted' && !c.cancelledAt && !!c.itemId ? `<div class="btn-row"><button class="btn sm soft" data-act="reactivate" data-id="${esc(c.id)}">${icon('swap')}${t('st.reactivate')}</button></div>` : '';
  const actions = own && ['pending', 'approved'].includes(c.status) ? `<div class="note">${icon('info')}<span>${t('st.ownClaim')}</span></div>`
    : loadingIt && ['pending', 'approved'].includes(c.status) ? ''
    : orphan ? `<div class="btn-row"><button class="btn sm" data-act="closeOrphan" data-id="${esc(c.id)}">${icon('x')}${t('st.orphanClose')}</button></div>`
    : c.status === 'pending' ? `<div class="btn-row">
      ${cashDirect ? `<button class="btn sm" data-act="approveCash" data-id="${esc(c.id)}">${icon('check')}${t('st.approve')}</button>`
        : unlinked ? '' : `<button class="btn sm" data-act="approve" data-id="${esc(c.id)}">${icon('check')}${t('st.approve')}</button>`}
      <button class="btn sm ghost" data-act="ask" data-id="${esc(c.id)}">${icon('question')}${t(c.question ? 'qa.askAgain' : 'qa.ask')}</button>
      <button class="btn sm danger" data-act="reject" data-id="${esc(c.id)}">${icon('x')}${t('c.reject')}</button></div>`
    : c.status === 'approved' ? `<div class="btn-row">
      ${c.codeHash && !S.isAdmin ? `<span class="note">${icon('info')}<span>${t('st.legacyAdmin')}</span></span>` : `<button class="btn sm" data-act="verify" data-id="${esc(c.id)}">${icon('shield')}${t('st.verify')}</button>`}
      ${late ? `<button class="btn sm ghost" data-act="release" data-id="${esc(c.id)}">${icon('swap')}${t('st.release')}</button>` : ''}
      <button class="btn sm danger" data-act="reject" data-id="${esc(c.id)}">${icon('x')}${t('st.unapprove')}</button></div>` : '';
  // الملخّص (PR 3): رقم الطلب والغرض والحالة، والخطوة التالية: مدة الانتظار، أو المهلة المتبقية للحضور (تحذير تحت يوم)
  const left = c.pickupBy ? c.pickupBy - Date.now() : null;
  const next = c.status === 'pending' ? t('st.waitFor', {dur: durText(Date.now() - (c.createdAt || Date.now()))})
    : c.status === 'approved' ? (left === null ? t('st.comeNoDate') : left < 0 ? t('st.comeLate', {dur: durText(-left)}) : t('st.comeIn', {dur: durText(left)}))
    : c.status === 'done' ? t('st.doneAt', {when: when(c.doneAt)}) : t('st.endedAt', {when: when(c.decidedAt || c.createdAt)});
  const warn = c.status === 'approved' && left !== null && left < 864e5;
  // v7: بلاغ سابق للعثور، وسجل صاحب الطلب في هذا المكتب (قراءة واحدة عند فتح البطاقة)، وصور الإثبات
  const prior = i && c.reportId ? priorReport(c, i) : null;
  const hist = claimerHist(c, opts?.open || CARD_OPEN.get('s:' + c.id));
  const histLine = hist ? `<div class="meta claimer-hist${hist.rejected >= 2 ? ' flag' : ''}">${icon('users')}${t('st.claimerHist', {n: tp('n.prevClaims', hist.n), m: tp('n.rejectedClaims', hist.rejected)})}</div>` : '';
  const nProofs = Number(c.proofs) || 0;
  const proofs = nProofs && ['pending', 'approved'].includes(c.status) ? `<div class="proof-cmp">
      ${i && ['clear', 'blur', 'none'].includes(i.photo) ? `<figure><div class="row-thumb">${icon('camera')}<img data-photo="p_${esc(i.id)}" alt="" hidden></div><figcaption>${t('st.itemPhoto')}</figcaption></figure>` : ''}
      ${Array.from({length: nProofs}, (_, k) => `<figure><div class="row-thumb">${icon('camera')}<img data-photo="cp_${esc(c.id)}_${k}" alt="" hidden></div><figcaption>${t('st.proofPhoto', {n: k + 1})}</figcaption></figure>`).join('')}
    </div>` : '';
  return mcard({key: 's:' + c.id, open: opts?.open, fresh: opts?.fresh, muted: !['pending', 'approved'].includes(c.status), tone: warn ? 'warn' : '',
    // H17: بلاغ النقود قبل القبول = «قيد المطابقة» عند الموظف كما عند صاحبه
    pillHtml: c.status === 'pending' && c.grouped && isHiddenCat(c.cat) ? `<span class="pill info">${t('gc.matching')}</span>` : pill(CLAIM_STATUS, c.status), next,
    head: `<span class="refs"><b dir="ltr" class="req-no">${esc(claimNo(c))}</b>${i ? `<span class="ref">${esc(i.ref)}</span>` : ''}</span><h3>${orphan ? t('st.orphanTitle') : i ? esc(showTitle(i)) : c.grouped && !iid ? t('grp.' + c.cat + '.title') : t('c.loadingDots')}</h3>${c.grouped ? `<span class="pill info">${t('gc.pill')}</span>` : ''}${person(c.uid)}${prior ? `<span class="pill ok prior">${icon('bell')}${t('st.priorReport')}</span>` : ''}`,
    body: `<div class="box-head"><div class="claim-who">${month >= 3 ? `<span class="pill bad">${t('st.manyClaims', {claims: tp('n.claim', month)})}</span>` : ''}${rv ? `<span class="pill bad">${t('st.rival')}</span>` : ''}${c.status === 'pending' && answered(c) ? `<span class="pill info">${t('qa.answered')}</span>` : ''}</div></div>
    ${i && S.route.name !== 'item' ? miniItem(full(i)) : ''}
    ${c.editedAt ? `<div class="note info edited">${icon('edit')}<span>${t('st.editedAfter', {when: when(c.editedAt)})}</span></div>` : ''}
    ${claimTimeline(c, true)}
    ${c.status === 'approved' && c.pickupBy ? `<div class="meta ${late ? 'flag' : ''}">${t(late ? 'st.pickupEnded' : 'st.pickupUntil', {date: dateOf(c.pickupBy)})}</div>` : ''}
    ${conflictNote(kind)}
    ${rv ? `<div class="note warn">${icon('info')}<span>${t('st.rivalNote')}</span></div>` : ''}
    ${tip}${histLine}
    ${orphan ? `<div class="note warn orphan-note">${icon('alert')}<span>${orphanText(i)}</span></div>` : ''}
    ${loadingIt ? `<div class="note">${icon('clock')}<span>${t('c.loadingDots')}</span></div>` : ''}
    ${lk && c.status === 'pending' ? `<div class="note ok">${icon('check')}<span>${t('gc.linkedTo', {ref: `<b dir="ltr">${esc(i?.ref || '')}</b>`})}</span></div>` : ''}
    ${i && !orphan ? claimCompare(c, full(i)) : c.grouped ? groupAnswers(c) : `<div class="proof">${esc(c.proof)}</div>`}
    ${unlinked && c.status === 'pending' ? groupBox(c, own) : ''}
    ${proofs}
    ${i ? '' : qaBox(c)}
    ${['rejected', 'expired', 'cancelled'].includes(c.status) && c.note ? `<div class="meta">${t(c.status === 'rejected' ? 'st.rejectReason' : 'st.note')}: ${esc(noteText(c.note))}</div>` : ''}
    ${c.status === 'approved' && c.note ? `<div class="meta">${t('st.approveReason')}: ${esc(c.note)}</div>` : ''}
    ${c.status === 'done' && c.handoverNote ? `<div class="meta">${icon('idcard')}${esc(noteText(c.handoverNote))}</div>` : ''}
    ${actions}${again}`});
}
// البحث برقم الطلب (REQ-7K3M أو 7K3M فقط): يطابق الطلبات المفتوحة والسجل المحمّل
const qNo = s => latinDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
export function staffClaims(){
  expireOld();
  const q = qNo(S.claimQ);
  if (q){
    const all = [...S.claims, ...(S.claimHist || []).filter(h => !S.claims.some(c => c.id === h.id))];
    const hits = all.filter(c => qNo(claimNo(c)).includes(q)).sort(byLast);
    return `<div class="section-title">${t('st.claimResults')} ${tabNum(0, hits.length)}</div>
      ${hits.length ? `<div class="list">${hits.map(claimCardStaff).join('')}</div>` : `<p class="muted">${t('st.noClaimNo')}</p>`}
      ${S.claimHist === null ? `<button class="btn sm ghost" data-act="claimHist">${icon('clock')}${t('st.showHist')}</button>` : ''}`;
  }
  // H4: تبويبات فرعية تظهر دائماً: قراري | الحضور | قادمة | منتهية. الرقم الرمادي = عدد العناصر، والأحمر = الجديد غير المقروء
  // H18: كل القوائم بآخر حدث، الأحدث في الأعلى (مدة الانتظار والمهلة تبقيان ظاهرتين على كل بطاقة)
  const pend = S.claims.filter(c => c.status === 'pending').sort(byLast);
  const appr = S.claims.filter(c => c.status === 'approved').sort(byLast);
  const fs = S.found.slice().sort(byLast);
  const hist = S.claimHist ? S.claimHist.slice().sort(byLast).slice(0, 50) : null;
  const fresh = new Set(staffKeys().map(x => x.card));
  const defs = [['decide', pend.length], ['come', appr.length], ['incoming', fs.length], ['ended', hist ? hist.length : null]];
  const cur = subTab('claims', defs);
  // H13a: تنبيه أعلى «قراري»: طلبات مفتوحة على أغراض محذوفة أو غير نشطة (لا إغلاق صامت: زر «إغلاقها كلها»)
  const orph = orphanClaims();
  const orphBar = orph.length ? `<div class="note warn orphans">${icon('alert')}<span>${t('st.orphans', {claims: tp('n.openClaims', orph.length)})}</span>
    <button class="btn sm" data-act="closeOrphans">${icon('x')}${t('st.orphansClose')}</button></div>` : '';
  // H19: قائمة فارغة: سطر يشرح ما يظهر فيها، وزر لتبويب فيه عمل، وإلا «أضف غرضاً»
  const go2 = (v, n) => n ? sEmptyTab('claims', v) : '';
  const body = cur === 'decide' ? orphBar + (pend.length ? `<div class="list">${pend.map((c, k) => claimCardStaff(c, {open: k === 0, fresh: fresh.has('s:' + c.id)})).join('')}</div>` : sEmpty('inbox', 'st.noNew', 'st.noNewSub', go2('come', appr.length)))
    : cur === 'come' ? (appr.length ? `<div class="list">${appr.map(c => claimCardStaff(c)).join('')}</div>` : sEmpty('clock', 'st.noCome', 'st.noComeSub', go2('decide', pend.length)))
    : cur === 'incoming' ? handins(fs, fresh)
    : hist === null ? `<button class="btn sm ghost" data-act="claimHist">${icon('clock')}${t('st.showHist')}</button>`
    : hist.length ? `<div class="list">${hist.map(c => claimCardStaff(c)).join('')}</div>` : `<p class="muted">${t('c.none')}</p>`;
  return subTabs('claims', defs, cur, body);
}
/* H4: التبويبات الفرعية للموظف (role="tablist" والأسهم كما في «طلباتي»). التبويب الافتراضي أول تبويب فيه عناصر،
   والمختار يبقى ما دامت الصفحة مفتوحة (S.staffSub). الأحمر = أحداث staffKeys() غير المقروءة (H5)، ويختفي بالنقر على التبويب */
function subTab(g, defs){
  const cur = S.staffSub[g];
  if (defs.some(([v]) => v === cur)) return cur;
  // H5: أول تبويب فيه جديد غير مقروء، وإلا أول تبويب فيه عناصر
  return (defs.find(([v]) => staffNew(g + ':' + v)) || defs.find(([, n]) => n) || defs[0])[0];
}
// H5: رقم واحد على كل تبويب: الأحمر بعدد الجديد غير المقروء إن وُجد، وإلا الرمادي بعدد العناصر (ويُخفى إن كان صفراً)
function subTabs(g, defs, cur, body){
  return `<div class="tabs sub" role="tablist" aria-label="${t('st.subAria.' + g)}">${defs.map(([v, n]) => { const r = staffNew(g + ':' + v);
      const num = tabNum(r, n);
      return `<button role="tab" id="st-${g}-${v}" aria-controls="sp-${g}" aria-selected="${v === cur}" tabindex="${v === cur ? 0 : -1}" data-act="staffSub" data-g="${g}" data-v="${v}">
        <span>${t('st.sub.' + v)}</span>${num}</button>`; }).join('')}</div>
    <div role="tabpanel" id="sp-${g}" aria-labelledby="st-${g}-${cur}" tabindex="0" class="sub-panel">${body}</div>`;
}
/* إشعار تسليم من واجد (للموظف): «استلمته» يفتح نموذج الغرض معبّأً، و«لم يصل» يغلقه */
export function foundCardStaff(f, open, fresh){
  const done = S.items.find(i => i.fromFound === f.id);   // سُجّل غرضه ولم يُحدَّث الإشعار (نادر)
  return mcard({key: 'sf:' + f.id, open, fresh, pillHtml: pill(FOUND_STATUS, f.status), next: t('st.handinNext', {when: when(f.createdAt)}),
    head: `${f.code ? `<span class="meta" dir="ltr">${esc(f.code)}</span>` : ''}<h3>${esc(f.sub ? subLabel(f.sub) : catName(f.cat))}</h3>${person(f.uid)}`,
    body: `<div class="meta">${icon(cat(f.cat).icon)}${esc(catName(f.cat))}${f.sub ? ' — ' + esc(subLabel(f.sub)) : ''}</div>
    <div class="meta">${t('hi.foundAt', {place: esc(spotText(f) || t('it.unknown')), date: fmtDate(f.foundDate)})}</div>
    ${f.note ? `<div class="proof">${esc(f.note)}</div>` : ''}
    <div class="btn-row"><button class="btn sm" data-act="receiveFound" data-id="${esc(f.id)}">${icon('check')}${t(done ? 'hi.confirmReceived' : 'hi.receive')}</button>
      ${done ? '' : `<button class="btn sm ghost" data-act="dropFound" data-id="${esc(f.id)}">${icon('x')}${t('hi.drop')}</button>`}</div>`});
}
// «تسليمات قادمة» (في تبويب الاستلام، PR 3): إشعارات التسليم المعلّقة من الواجدين، الأقدم أولاً
function handins(fs, fresh){
  // البحث بكود إشعار التسليم: يظهر فقط مع إشعارات كثيرة (الجهات الكبيرة)، وإلا يكفي اختيار الإشعار من القائمة
  const codeBox = fs.length <= CODE_SEARCH_MIN ? '' : `<form class="filters code-find" data-form="findCode" novalidate>
      <label class="searchbar" style="flex:1;min-width:180px">${icon('tag')}<input name="code" class="code-in" dir="ltr" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="${t('hi.codePh')}" aria-label="${t('hi.codeAria')}"></label>
      <button class="btn sm" type="submit">${icon('search')}${t('hi.codeOpen')}</button></form>`;
  return fs.length ? `${codeBox}<p class="muted">${t('st.handinHint')}</p><div class="list">${fs.map((f, k) => foundCardStaff(f, k === 0, fresh.has('sf:' + f.id))).join('')}</div>` : sEmpty('tag', 'st.noHandin', 'st.noHandinSub');
}
// H19: قائمة الموظف الفارغة: العنوان والشرح، وزر لتبويب آخر فيه عمل، وإلا «أضف غرضاً»
const sEmptyTab = (g, v) => `<button class="btn soft" data-act="staffSub" data-g="${g}" data-v="${v}">${icon('fwd')}${t('st.sub.' + v)}</button>`;
const sEmpty = (ic, k, sub, act) => emptyBox(ic, t(k), t(sub), act || `<button class="btn soft" data-act="nav" data-r="add">${icon('plus')}${t('nav.add')}</button>`, 'sm');
// خانة البحث بكود إشعار التسليم تظهر فقط إذا زادت الإشعارات المعلّقة على هذا العدد
export const CODE_SEARCH_MIN = 5;
export function staffReports(){
  // H4: تبويبات فرعية: لها مرشّح | مفتوحة | مغلقة (المغلقة تُجلب عند الطلب). إشعارات التسليم في «الاستلام» (قادمة)
  // البلاغات القديمة (أكثر من 60 يوماً دون تجديد) مخفية افتراضياً
  // H23: بحث في البلاغات (العنوان، والوصف، والنوع، والمكان)
  const rq = norm(S.reportQ || ''), hit = r => !rq || norm([r.title, r.desc, r.sub, r.spot, catName(r.cat)].join(' ')).includes(rq);
  const open = S.reports.filter(r => r.status === 'open' && hit(r)), old = open.filter(isStale);
  const rs = open.filter(r => S.showStale || !isStale(r)).sort(byLast);
  // H10: «مرشّح محتمل» = بلا ترشيح وأفضل مرشّح له يطابق تفصيلاً سرياً (المبلغ، آخر 4 أرقام، الماركة، المكان…)
  const picked = rs.filter(r => r.staffPick), likely = rs.filter(r => !r.staffPick && strongFor(r)), rest = rs.filter(r => !r.staffPick && !likely.includes(r));
  const oldBtn = old.length ? `<div class="btn-row"><button class="btn sm ghost" data-act="toggleStale" aria-pressed="${S.showStale}">${icon('clock')}${t(S.showStale ? 'st.hideOld' : 'st.showOld', {n: old.length})}</button></div>` : '';
  // أول بلاغ له مرشّحون ولم يُرشَّح له بعد يُفتح تلقائياً (يحتاج قراراً)
  const first = likely[0]?.id || rest.find(r => staffCands(r, 1).length)?.id;
  const closed = S.closedReps ? S.closedReps.filter(hit).sort(byLast).slice(0, 50) : null;
  const fresh = new Set(staffKeys().map(x => x.card));
  const defs = [['picked', picked.length], ['likely', likely.length], ['open', rest.length], ['closed', closed ? closed.length : null]];
  const cur = subTab('reports', defs);
  const body = cur === 'picked' ? (picked.length ? `<div class="list">${picked.map(r => reportCardStaff(r, false, fresh.has('sr:' + r.id))).join('')}</div>` : sEmpty('spark', 'st.noPicked', 'st.noPickedSub', rest.length ? sEmptyTab('reports', 'open') : ''))
    : cur === 'likely' ? (likely.length ? `<p class="muted">${t('st.likelyHint')}</p><div class="list">${likely.map(r => reportCardStaff(r, r.id === first, fresh.has('sr:' + r.id))).join('')}</div>` : sEmpty('spark', 'st.noLikely', 'st.noLikelySub', rest.length ? sEmptyTab('reports', 'open') : ''))
    : cur === 'open' ? `${oldBtn}${rest.length ? `<div class="list">${rest.map(r => reportCardStaff(r, r.id === first, fresh.has('sr:' + r.id))).join('')}</div>` : sEmpty('bell', 'st.noReports', 'st.noReportsSub')}`
    : closed === null ? `<button class="btn sm ghost" data-act="closedReps">${icon('clock')}${t('st.rShowClosed')}</button>`
    : closed.length ? `<div class="list">${closed.map(r => reportCardStaff(r)).join('')}</div>` : `<p class="muted">${t('c.none')}</p>`;
  return subTabs('reports', defs, cur, body);
}
// بطاقة بلاغ للموظف (مختصرة): الملخّص فيه الخطوة التالية، والتفاصيل كما كانت
function reportCardStaff(r, open, fresh){
  const isOpen = r.status === 'open';
  // الموظف يقارن بالتفاصيل السرية أيضاً، والأغراض التي قال عنها صاحب البلاغ «ليس غرضي» لا تُرشَّح له من جديد (G5)
  // H10: في التصنيفات بلا اقتراح آلي (نقود، بطاقات…) لا يظهر إلا من طابق تفصيلاً سرياً؛ والمطابق يحمل شارة «تفصيل سري مطابق»
  const cands = isOpen ? staffCands(r, 3) : [];
  const refs = [...rejectedOf(r)].map(id => { const it = item(id); if (!it) ensureItem(id); return it?.ref || ''; }).filter(Boolean);
  // H23: رقم قيد الغرض المرشّح؛ إن لم يُحمَّل بعد نجلبه، وحتى يصل صياغة بديلة بلا شرطة فارغة
  const pickRef = r.staffPick ? (item(r.staffPick)?.ref || (ensureItem(r.staffPick), '')) : '';
  const next = !isOpen ? t('st.rNextClosed', {when: when(r.closedAt || r.createdAt)})
    : r.staffPick ? (pickRef ? t('st.rNextPicked', {ref: `<b dir="ltr">${esc(pickRef)}</b>`}) : t('st.rNextPickedNoRef')) : cands.length ? t('st.rNextCands', {n: cands.length}) : t('st.rNextNone');
  return mcard({key: 'sr:' + r.id, open, fresh, muted: !isOpen, pillHtml: isStale(r) ? `<span class="pill mute">${t('st.oldReport')}</span>` : isOpen ? '' : pill(REPORT_STATUS, r.status), next,
    // H23: «أُرسل: 29 سبتمبر 2026 · 2:00 ص (قبل 7 أيام)» في البطاقة المطوية نفسها
    head: `<span class="meta">${icon(cat(r.cat).icon)}${esc(catName(r.cat))}${r.sub ? ' — ' + esc(subLabel(r.sub)) : ''}</span><h3>${esc(r.title)}</h3>${person(r.uid)}${whenLine('c.sentAt', r.createdAt)}`,
    body: `<div>${r.color ? `<span class="meta">${colorDot(r.color)}${esc(colorName(r.color))}</span>` : ''}${whenLine('c.editedAt', r.editedAt)}</div>
      ${r.photo ? `<div class="row-thumb" style="width:84px;height:84px">${icon('camera')}<img data-photo="r_${esc(r.id)}" alt="" hidden></div>` : ''}
      ${r.desc ? `<div class="proof">${esc(r.desc)}</div>` : ''}
      <div class="meta">${person(r.uid)} · ${r.spot ? t('st.lostAt', {place: esc(spotText(r)), date: fmtDate(r.lostDate)}) : t('st.lostOn', {date: fmtDate(r.lostDate)})}</div>
      ${refs.length ? `<div class="note warn">${icon('x')}<span>${t('st.rejectedBy', {refs: refs.map(x => `<b dir="ltr">${esc(x)}</b>`).join(t('c.listSep'))})}</span></div>` : ''}
      ${isOpen ? acceptBtn(r) : ''}
      ${!isOpen ? '' : cands.length ? `<span class="label">${t('st.cands')}</span><div class="list">${cands.map(({i, s}) => `<div class="btn-row" style="align-items:center;flex-wrap:nowrap">${miniItem(i, `<span class="score">${s}%</span>`)}
        ${r.staffPick === i.id ? `<span class="pill ok">${icon('check')}${t('st.picked')}</span>` : `<button class="btn sm soft" data-act="pickFor" data-r="${esc(r.id)}" data-i="${esc(i.id)}">${t('st.pick')}</button>`}</div>
        ${whenLine('rc.itemAt', i.createdAt)}
        ${secretHit(r, i) ? `<span class="meta hit-line">${icon('lock')}${t('st.secretHit')}</span>` : ''}`).join('')}</div>`
        : `<p class="muted">${t('st.noCands')}</p>`}`});
}

// زر قبول البلاغ: يحوّله إلى غرض في المستودع، أو يُظهر الغرض إن سبق قبوله
function acceptBtn(r){
  const done = S.items.find(i => i.fromReport === r.id);
  if (done) return `<div class="btn-row" style="align-items:center"><span class="pill ok">${icon('check')}${t('st.added')}</span><button class="btn sm ghost" data-act="openItem" data-id="${esc(done.id)}">${esc(done.ref)}</button></div>`;
  return `<div class="btn-row"><button class="btn sm" data-act="acceptReport" data-id="${esc(r.id)}">${icon('check')}${t('st.acceptReport')}</button></div>`;
}

/* ---------- staff: add / edit item ---------- */
// الحقول السرية (الاسم التفصيلي، اللون، الماركة، الوصف، المبنى والقاعة، موضع الحفظ) تُقرأ من itemSecrets وتُحفظ فيها
// H9: أكثر 6 تصنيفات في أغراض المكتب (تُكمَّل بترتيب القائمة)، ومعها التصنيف المختار إن لم يكن منها
function topCats(o, sel){
  const n = {}; for (const x of S.items) if (x.officeId === o?.id) n[x.cat] = (n[x.cat] || 0) + 1;
  const ids = Object.keys(n).filter(k => CATS.some(c => c.id === k)).sort((a, b) => n[b] - n[a]).slice(0, 6);
  for (const c of CATS){ if (ids.length >= 6) break; if (!ids.includes(c.id)) ids.push(c.id); }
  if (sel && !ids.includes(sel)) ids[ids.length - 1] = sel;
  return ids;
}
/* H9: صورة الغرض في الإضافة السريعة: لا يُفتح شيء حتى يضغط الموظف زراً.
   data-ph: 'pick' ثلاثة أزرار · 'view' المعاينة مع «تغيير» و«حذف» · 'none' اختار «بلا صورة»
   «التقط صورة» (كاميرا الجوال مباشرة) للأجهزة التي تعمل باللمس فقط، وفي الكمبيوتر «اختر صورة» */
function quickPhoto(){
  const touch = matchMedia('(pointer: coarse)').matches;
  const file = (id, cap) => `<input type="file" accept="image/*" ${cap ? 'capture="environment" ' : ''}id="${id}" class="photo-file">`;
  return `<div class="field qp" id="photo-field" data-ph="pick"><span class="label">${t('if.photo')}</span>
    <div class="qp-pick">
      ${touch ? `<label class="qp-btn">${icon('camera')}<span>${t('if.takePhoto')}</span>${file('photo-cam', true)}</label>` : ''}
      <label class="qp-btn">${icon('image')}<span>${t(touch ? 'if.fromGallery' : 'c.pickPhoto')}</span>${file('photo-in', false)}</label>
      <button type="button" class="qp-btn" data-act="noPhoto">${icon('x')}<span>${t('if.noPhoto')}</span></button>
    </div>
    <div class="qp-view">
      <div class="pv" id="pv">${icon('camera')}</div>
      <div class="col">
        <div class="btn-row">
          <label class="btn sm ghost filebtn">${icon('edit')}<span>${t('if.change')}</span>${file('photo-chg', false)}</label>
          <button type="button" class="btn sm ghost" data-act="removePhoto" id="rm-photo">${icon('trash')}${t('if.delPhoto')}</button>
        </div>
        <span class="ai-status" id="ai-status" role="status"></span>
      </div>
    </div>
    <div class="qp-none"><span class="muted">${t('if.noPhotoSet')}</span><button type="button" class="btn sm ghost" data-act="photoPick">${icon('camera')}${t('if.addPhoto')}</button></div>
  </div>`;
}
export function vItemForm(){
  const o = curOffice(); const i = S.route.params.id ? full(item(S.route.params.id)) : null;
  // عند قبول بلاغ: نعبّئ النموذج من بيانات البلاغ (التصنيف، النوع، اللون، الصورة...)
  const r = !i && S.route.params.fromReport ? S.reports.find(x => x.id === S.route.params.fromReport) : null;
  // عند استلام غرض من واجد سجّل إشعار تسليم: التصنيف والنوع ومكان العثور وتاريخه
  const f = !i && !r && S.route.params.fromFound ? S.found.find(x => x.id === S.route.params.fromFound) : null;
  // H9: غرض جديد عادي = الإضافة السريعة: الكاميرا أولاً، وآخر تصنيف ومكان، وما بقي من «أضف آخر» (المكان والتاريخ)
  const quick = !i && !r && !f;
  const P = quick ? addPrefs() : {}, A = quick ? AGAIN.v : null;
  const q = quick ? {cat: CATS.some(c => c.id === P.cat) ? P.cat : '', spot: A ? A.spot : (o?.spots || []).includes(P.spot) ? P.spot : '', bldg: A?.bldg || '', room: A?.room || ''} : null;
  const src = i || (r ? {cat: r.cat, sub: r.sub, color: r.color, title: r.title, desc: r.desc, spot: r.spot, bldg: r.bldg, room: r.room, details: r.details || {}}
    : f ? {cat: f.cat, sub: f.sub, title: subName(f.sub) || cat(f.cat).name, spot: f.spot, bldg: f.bldg, room: f.room} : q);
  // الموظف يرى الأصل الواضح (p_)، والقيمة القديمة true صورتها في itemPhotos
  const photoKey = i?.photo ? (i.photo === true ? i.id : 'p_' + i.id) : r?.photo && !cat(r.cat).sensitive ? 'r_' + r.id : null;
  const mode = ['clear', 'blur', 'none'].includes(i?.photo) ? i.photo : i?.photo === true ? 'clear' : 'blur';
  resetForm(!!i?.photo, i ? null : photoKey);
  const date = `<div class="field"><label for="f-date">${t('if.date')}</label><input id="f-date" name="foundDate" type="date" class="input" value="${esc(i?.foundDate || f?.foundDate || A?.date || today())}" max="${today()}"></div>`;
  const spot = `<div class="field"><label for="f-spot">${t('if.spot')}</label><select id="f-spot" name="spot" class="input">${spotOptions(o, src?.spot || '')}</select></div>`;
  const desc = `<div class="field"><label for="f-desc">${t('if.desc')}</label><textarea id="f-desc" name="desc" class="input" maxlength="600" placeholder="${t('if.descPh')}">${esc(src?.desc || '')}</textarea></div>`;
  const rest = `<div class="field"><label for="f-storage">${t('if.storage')} <span class="hint">${t('if.staffOnly')}</span></label><input id="f-storage" name="storage" class="input" maxlength="40" value="${esc(i?.storage || '')}" placeholder="${t('if.storagePh')}"></div>
      <div class="field"><label for="f-finder">${t('if.finder')} <span class="hint">${t('c.optional')} · ${t('if.staffOnly')}</span></label><input id="f-finder" name="finderNote" class="input" maxlength="80" autocomplete="off" value="${esc(i?.finderNote || '')}" placeholder="${t('if.finderPh')}">
        <span class="hint">${t('if.finderHint')}</span></div>`;
  const secretNote = `<div class="note">${icon('lock')}<span>${t('if.secretNote')}</span></div>`;
  const subs = `<div class="field" id="subs-field" ${src?.cat && cat(src.cat).subs.length ? '' : 'hidden'}><span class="label">${t('c.type')}</span><div id="subs">${src?.cat ? subsPicker(src.cat, src.sub) : ''}</div></div>`;
  const title = `<div class="field"><label for="f-title">${t('if.title')}</label><input id="f-title" name="title" class="input" required maxlength="80" value="${esc(src?.title || '')}" placeholder="${t('if.titlePh')}"></div>`;
  const hero = `<section class="hero"><div class="hero-kicker">${icon('tag')}${i ? t('if.kEdit', {ref: esc(i.ref)}) : t(r ? 'if.kReport' : f ? 'if.kFound' : 'if.kNew', {office: esc(oName(o))})}</div><h1 class="hero-title">${t(i ? 'if.tEdit' : r ? 'if.tReport' : f ? 'if.tFound' : 'if.tNew')}</h1></section>`;
  if (quick){
    // الظاهر: الصورة، والتصنيف (أكثرها استخداماً أولاً)، والعنوان، والمكان، والتفاصيل السرية المطلوبة للتصنيف. والباقي في «تفاصيل إضافية»
    const top = topCats(o, src.cat), others = CATS.map(c => c.id).filter(id => !top.includes(id));
    return `<div class="wrap" data-view="add">${hero}
    <form data-form="item" class="panel quick-form" novalidate data-quick="1">
      ${quickPhoto()}
      <div class="field" id="cat-field"><span class="label">${t('c.category')}</span>${catPicker(src.cat, top)}
        <details class="more-box all-cats" id="cat-all"><summary>${icon('grid')}<span>${t('if.allCats')}</span>${icon('chev')}</summary>
          <div class="more-body">${catPicker(src.cat, others)}</div></details></div>
      ${subs}
      ${title}
      ${spot}
      ${spotExtra(src)}
      <div id="cat-fields" data-mode="item">${catFields(src.cat, src, 'item', 'req')}</div>
      <details class="more-box" id="if-more">
        <summary>${icon('plus')}<span>${t('if.more')}</span>${icon('chev')}</summary>
        <div class="more-body">
          <div id="cat-fields-opt">${catFields(src.cat, src, 'item', 'opt')}</div>
          ${desc}
          ${date}
          ${photoModePicker(mode)}
          ${rest}
          ${secretNote}
        </div>
      </details>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${t('if.save')}</button>
    </form>
  </div>`;
  }
  return `<div class="wrap" data-view="add">${i || r || f ? backBtn() : ''}
    ${hero}
    ${r ? `<div class="note info">${icon('bell')}<span>${t('if.fromReport')}</span></div>` : ''}
    ${f ? `<div class="note info">${icon('tag')}<span>${t('if.fromFound')}${f.note ? `<br><b>${t('hi.finderNote')}</b> ${esc(f.note)}` : ''}</span></div>` : ''}
    ${i && evidenceLocked(i) ? `<div class="note warn">${icon('lock')}<span>${t('st.evidenceLocked')}</span></div>` : ''}
    <form data-form="item" class="panel" novalidate ${r ? `data-report="${esc(r.id)}"` : ''} ${f ? `data-found="${esc(f.id)}"` : ''} ${i && evidenceLocked(i) ? 'data-locked="1"' : ''}>
      ${photoField(photoKey, t('if.photo'), photoModePicker(mode), !!i && evidenceLocked(i) && ['clear', 'blur', 'none'].includes(i.photo))}
      <div class="field"><span class="label">${t('c.category')}</span>${catPicker(src?.cat || '')}</div>
      ${subs}
      ${secretNote}
      <div id="cat-fields" data-mode="item">${catFields(src?.cat, src, 'item')}</div>
      ${title}
      ${desc}
      <div class="two">
        ${spot}
        ${date}
      </div>
      ${spotExtra(src)}
      ${rest}
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${t(i ? 'if.saveEdit' : 'if.save')}</button>
    </form>
  </div>`;
}
