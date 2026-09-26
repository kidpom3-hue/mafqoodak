// صفحات موظف المكتب: لوحة المكتب، المستودع، طلبات الاستلام، البلاغات، إضافة/تعديل غرض
import { icon, CATS, cat, catName, colorName, ITEM_STATUS, CLAIM_STATUS } from '../constants.js';
import { $, $$, esc, today, dayNum, daysAgo, fmtDate, relDay, relTime, pill, colorDot, tokens, textScore, norm, spotText } from '../utils.js';
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
    <section class="hero"><div class="hero-kicker">${icon('shield')}لوحة مكتب المفقودات</div><h1 class="hero-title">${esc(o.name)}</h1></section>
    <div class="stats" id="s-stats"></div>
    <div class="seg wide" id="s-tabs">
      <button data-act="sTab" data-v="items">${icon('box')}المستودع</button>
      <button data-act="sTab" data-v="claims">${icon('inbox')}الاستلام</button>
      <button data-act="sTab" data-v="reports">${icon('bell')}البلاغات</button>
    </div>
    <div id="s-tools"></div>
    <div id="s-body"></div>
  </div>`;
}
let toolsTab = null;
export function updateStaff(){
  const it = S.items, o = curOffice(), keep = o?.retentionDays || 90;
  const pend = S.claims.filter(c => c.status === 'pending').length;
  const openR = S.reports.filter(r => r.status === 'open').length;
  const over = it.filter(i => (i.status === 'available') && daysAgo(i.foundDate) > keep).length;
  $('#s-stats').innerHTML = `
    <div class="stat"><b>${it.filter(i => i.status === 'available').length}</b><span>متاح للاستلام</span></div>
    <div class="stat"><b>${it.filter(i => i.status === 'reserved').length}</b><span>محجوز بانتظار صاحبه</span></div>
    <div class="stat ${pend ? 'hot' : ''}"><b>${pend}</b><span>طلبات استلام جديدة</span></div>
    <div class="stat"><b>${openR}</b><span>بلاغات مفتوحة</span></div>
    <div class="stat"><b>${it.filter(i => i.status === 'returned').length}</b><span>سُلّم لأصحابه</span></div>
    ${over ? `<div class="stat hot"><b>${over}</b><span>تجاوز مدة الحفظ</span></div>` : ''}`;
  $$('#s-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === S.staffTab));
  if (toolsTab !== S.staffTab || !$('#s-tools').innerHTML){
    toolsTab = S.staffTab;
    $('#s-tools').innerHTML = S.staffTab === 'items' ? `<div class="filters">
        <label class="searchbar" style="flex:1;min-width:200px">${icon('search')}<input id="sq" type="search" placeholder="ابحث برقم القيد أو الاسم…" value="${esc(S.staffQ)}" aria-label="بحث في المستودع"></label>
        <select class="select-sm" id="sstatus" aria-label="الحالة">
          <option value="active">المتاح والمحجوز</option><option value="returned">المُسلّم</option><option value="archived">المؤرشف</option><option value="all">الكل</option>
        </select>
        <button class="btn sm" data-act="nav" data-r="add">${icon('plus')}أضف غرضاً</button>
      </div>` : '';
    const ss = $('#sstatus'); if (ss) ss.value = S.staffStatus;
  }
  $('#s-body').innerHTML = S.staffTab === 'claims' ? staffClaims() : S.staffTab === 'reports' ? staffReports() : staffItems();
  hydrate();
  migrateItems();   // نقل تفاصيل الأغراض القديمة إلى الملف السري (مرة واحدة)
}
export function staffItems(){
  const keep = curOffice()?.retentionDays || 90;
  let arr = S.items.slice();
  if (S.staffStatus === 'active') arr = arr.filter(i => i.status === 'available' || i.status === 'reserved');
  else if (S.staffStatus !== 'all') arr = arr.filter(i => i.status === S.staffStatus);
  arr = arr.map(full);   // الموظف يبحث ويرى التفاصيل السرية أيضاً
  const q = tokens(S.staffQ);
  if (q.length) arr = arr.filter(i => textScore(q, i) > 0 || norm(i.ref).includes(norm(S.staffQ)));
  arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  if (!arr.length) return `<div class="empty">${icon('box')}<b>لا توجد عناصر</b><button class="btn soft" data-act="nav" data-r="add">${icon('plus')}سجّل أول غرض</button></div>`;
  return `<div class="list">${arr.map(i => `
    <article class="row" role="button" tabindex="0" data-act="openItem" data-id="${esc(i.id)}">
      ${thumbHtml(i)}
      <div class="row-main">
        <div class="row-top"><span class="ref">${esc(i.ref)}</span>${pill(ITEM_STATUS, i.status)}${i.sample ? '<span class="pill mute">مثال</span>' : ''}</div>
        <div class="row-title">${esc(i.title)}</div>
        <div class="meta">${esc(spotText(i))} · ${relDay(i.foundDate)}${i.storage ? ' · ' + esc(i.storage) : ''}${i.status === 'available' && daysAgo(i.foundDate) > keep ? ' · <span class="flag">تجاوز مدة الحفظ</span>' : ''}</div>
      </div>
    </article>`).join('')}</div>`;
}
/* مقارنة إجابات صاحب الطلب بالحقيقة (من itemSecrets) */
const OK = '<span class="v ok">✓</span>', OK2 = '<span class="v ok">✓✓</span>', NO = '<span class="v bad">✗</span>', NA = '<span class="v mute">لم يحدد</span>';
function claimCompare(c, f){
  if (!f) return '';
  const said = x => x ? esc(x) : '<span class="muted">لم يحدد</span>', truth = x => x ? esc(x) : '<span class="muted">—</span>';
  // اللون: مطابقة تلقائية
  const color = !c.color ? NA : !f.color ? '' : c.color === f.color ? OK : NO;
  // المكان: ✓ المنطقة نفسها، ✓✓ والمبنى نفسه أيضاً
  const place = !c.lostSpot ? NA : !f.spot ? '' : c.lostSpot !== f.spot ? NO : (c.bldg && c.bldg === f.bldg ? OK2 : OK);
  // التاريخ: فُقد قبل العثور أو في يومه، وبفارق 14 يوماً على الأكثر
  const gap = c.lostDate && f.foundDate ? dayNum(f.foundDate) - dayNum(c.lostDate) : null;
  const date = !c.lostDate ? NA : gap === null ? '' : gap >= 0 && gap <= 14 ? OK : NO;
  const hits = [color, place, date].filter(v => v === OK || v === OK2).length;
  const row = (k, a, b, v = '') => `<div class="cmp-row"><b>${k}</b><span>${a}</span><span>${b}</span>${v || '<span class="v"></span>'}</div>`;
  return `<div class="cmp">
    <div class="cmp-row cmp-head"><b></b><span>قال صاحب الطلب</span><span>الحقيقة</span><span class="v"></span></div>
    ${row('اللون', said(colorName(c.color)), truth(colorName(f.color)), color)}
    ${row('المكان', said(spotText({spot: c.lostSpot, bldg: c.bldg, room: c.room})), truth(spotText(f)), place)}
    ${row('التاريخ', said(c.lostDate && fmtDate(c.lostDate)), truth(f.foundDate && 'وُجد ' + fmtDate(f.foundDate)), date)}
    ${row('الماركة', said(c.brand), truth(f.brand))}
    ${row('المحتوى أو العلامة', said(c.proof), truth(f.desc))}
    <div class="cmp-sum">تطابق ${hits} من 3</div>
  </div>`;
}
export function claimCardStaff(c){
  const i = item(c.itemId);
  // تحذير: طلبات كثيرة من المستخدم نفسه في هذا المكتب خلال 30 يوماً
  const month = c.uid === 'deleted' ? 0 : S.claims.filter(x => x.uid === c.uid && x.createdAt >= Date.now() - 30 * 864e5).length;
  const actions = c.status === 'pending' ? `<div class="btn-row">
      <button class="btn sm" data-act="approve" data-id="${esc(c.id)}">${icon('check')}قبول</button>
      <button class="btn sm danger" data-act="reject" data-id="${esc(c.id)}">${icon('x')}رفض</button></div>`
    : c.status === 'approved' ? `<button class="btn sm" data-act="verify" data-id="${esc(c.id)}">${icon('shield')}تحقق من الرمز وسلّم</button>` : '';
  return `<div class="box">
    <div class="box-head"><div class="claim-who">${person(c.uid)}<span class="meta">${relTime(c.createdAt)}</span>${month >= 3 ? `<span class="pill bad">أرسل ${month} طلبات هذا الشهر</span>` : ''}</div>${pill(CLAIM_STATUS, c.status)}</div>
    ${i && S.route.name !== 'item' ? miniItem(full(i)) : ''}
    ${i ? claimCompare(c, full(i)) : `<div class="proof">${esc(c.proof)}</div>`}
    ${c.status === 'rejected' && c.note ? `<div class="meta">سبب الرفض: ${esc(c.note)}</div>` : ''}
    ${actions}
  </div>`;
}
export function staffClaims(){
  const cs = S.claims.slice().sort((a,b) => b.createdAt - a.createdAt);
  const pend = cs.filter(c => c.status === 'pending'), appr = cs.filter(c => c.status === 'approved'), hist = cs.filter(c => c.status === 'done' || c.status === 'rejected').slice(0, 20);
  if (!cs.length) return `<div class="empty">${icon('inbox')}<b>لا توجد طلبات استلام بعد</b></div>`;
  return `
    <div class="section-title">بانتظار المراجعة ${pend.length ? `<span class="count">${pend.length}</span>` : ''}</div>
    ${pend.length ? `<div class="list">${pend.map(claimCardStaff).join('')}</div>` : `<p class="muted">لا يوجد.</p>`}
    <div class="section-title">مقبولة — بانتظار حضور صاحبها</div>
    ${appr.length ? `<div class="list">${appr.map(claimCardStaff).join('')}</div>` : `<p class="muted">لا يوجد.</p>`}
    ${hist.length ? `<div class="section-title">السجل</div><div class="list">${hist.map(claimCardStaff).join('')}</div>` : ''}`;
}
export function staffReports(){
  const rs = S.reports.filter(r => r.status === 'open').sort((a,b) => b.createdAt - a.createdAt);
  if (!rs.length) return `<div class="empty">${icon('bell')}<b>لا توجد بلاغات مفتوحة</b><span>بلاغات الزوار عن مفقوداتهم تظهر هنا مع المرشحين من المستودع.</span></div>`;
  return `<div class="list">${rs.map(r => {
    const cands = candidatesFor(r, 3, full);   // الموظف يقارن بالتفاصيل السرية أيضاً
    return `<div class="box">
      <div class="box-head"><div><h3>${esc(r.title)}</h3><span class="meta">${icon(cat(r.cat).icon)}${esc(catName(r.cat))}${r.sub ? ' — ' + esc(r.sub) : ''}${r.color ? ' · ' + colorDot(r.color) + esc(colorName(r.color)) : ''}</span></div><span class="meta">${relTime(r.createdAt)}</span></div>
      ${r.photo ? `<div class="row-thumb" style="width:84px;height:84px">${icon('camera')}<img data-photo="r_${esc(r.id)}" alt="" hidden></div>` : ''}
      ${r.desc ? `<div class="proof">${esc(r.desc)}</div>` : ''}
      <div class="meta">${person(r.uid)} · فُقد ${r.spot ? 'في ' + esc(spotText(r)) + ' ' : ''}${fmtDate(r.lostDate)}</div>
      ${acceptBtn(r)}
      ${cands.length ? `<span class="label">مرشحون من المستودع</span><div class="list">${cands.map(({i, s}) => `<div class="btn-row" style="align-items:center;flex-wrap:nowrap">${miniItem(i, `<span class="score">${s}%</span>`)}
        ${r.staffPick === i.id ? `<span class="pill ok">${icon('check')}مُرشّح</span>` : `<button class="btn sm soft" data-act="pickFor" data-r="${esc(r.id)}" data-i="${esc(i.id)}">رشّح</button>`}</div>`).join('')}</div>`
        : `<p class="muted">لا يوجد غرض مشابه في المستودع حالياً.</p>`}
    </div>`; }).join('')}</div>`;
}

// زر قبول البلاغ: يحوّله إلى غرض في المستودع، أو يُظهر الغرض إن سبق قبوله
function acceptBtn(r){
  const done = S.items.find(i => i.fromReport === r.id);
  if (done) return `<div class="btn-row" style="align-items:center"><span class="pill ok">${icon('check')}أُضيف للمستودع</span><button class="btn sm ghost" data-act="openItem" data-id="${esc(done.id)}">${esc(done.ref)}</button></div>`;
  return `<div class="btn-row"><button class="btn sm" data-act="acceptReport" data-id="${esc(r.id)}">${icon('check')}قبول وإضافة للمستودع</button></div>`;
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
    <section class="hero"><div class="hero-kicker">${icon('tag')}${i ? 'تعديل ' + esc(i.ref) : r ? 'قبول بلاغ · ' + esc(o.name) : 'قيد جديد · ' + esc(o.name)}</div><h1 class="hero-title">${i ? 'تعديل بيانات الغرض' : r ? 'إضافة الغرض المُبلَّغ عنه للمستودع' : 'تسجيل غرض معثور عليه'}</h1></section>
    ${r ? `<div class="note info">${icon('bell')}<span>عبّأنا الحقول من البلاغ، راجعها قبل الحفظ. بعد الحفظ يُرشَّح الغرض لصاحب البلاغ ويصله تنبيه.</span></div>` : ''}
    <form data-form="item" class="panel" novalidate ${r ? `data-report="${esc(r.id)}"` : ''}>
      ${photoField(photoKey, 'صورة الغرض', photoModePicker(mode))}
      <div class="field"><span class="label">التصنيف</span>${catPicker(src?.cat || '')}</div>
      <div class="field" id="subs-field" ${src?.cat && cat(src.cat).subs.length ? '' : 'hidden'}><span class="label">النوع</span><div id="subs">${src?.cat ? subsPicker(src.cat, src.sub) : ''}</div></div>
      <div class="note">${icon('lock')}<span>يظهر للزوار التصنيف والنوع والمنطقة وتاريخ العثور فقط. بقية الحقول لا يراها إلا موظفو المكتب، وتُقارن بإجابات من يطلب الاستلام.</span></div>
      <div class="field"><span class="label">اللون</span>${colorPicker(src?.color || '')}</div>
      <div class="field"><label for="f-title">اسم الغرض (للموظفين)</label><input id="f-title" name="title" class="input" required maxlength="80" value="${esc(src?.title || '')}" placeholder="مثال: سماعات لاسلكية بيضاء"></div>
      <div class="field"><label for="f-brand">الماركة أو الشركة <span class="hint">(للموظفين فقط)</span></label><input id="f-brand" name="brand" class="input" maxlength="40" value="${esc(src?.brand || '')}" placeholder="مثال: سامسونج"></div>
      <div class="field"><label for="f-desc">الوصف والعلامات المميزة (للموظفين فقط، لا يظهر للزوار)</label><textarea id="f-desc" name="desc" class="input" maxlength="600" placeholder="المحتوى، الخدوش والملصقات، الرقم التسلسلي… يُستخدم للتحقق من ملكية من يطلب الاستلام.">${esc(src?.desc || '')}</textarea></div>
      <div class="two">
        <div class="field"><label for="f-spot">مكان العثور</label><select id="f-spot" name="spot" class="input">${spotOptions(o, src?.spot || '')}</select></div>
        <div class="field"><label for="f-date">تاريخ العثور</label><input id="f-date" name="foundDate" type="date" class="input" value="${esc(i?.foundDate || today())}" max="${today()}"></div>
      </div>
      ${spotExtra(src)}
      <div class="field"><label for="f-storage">موضع الحفظ في المكتب <span class="hint">(للموظفين فقط)</span></label><input id="f-storage" name="storage" class="input" maxlength="40" value="${esc(i?.storage || '')}" placeholder="مثال: الخزانة 2 — الرف ب"></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${i ? 'حفظ التعديلات' : 'سجّل الغرض'}</button>
    </form>
  </div>`;
}
