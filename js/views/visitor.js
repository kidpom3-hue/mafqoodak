// صفحات الزائر: اختيار المكان، التصفح، تفاصيل الغرض، طلب الاستلام، البلاغ، طلباتي، المكتب
import { icon, LOGO, CATS, cat, catName, colorName, otype, ITEM_STATUS, CLAIM_STATUS, REPORT_STATUS } from '../constants.js';
import { $, $$, esc, today, dayNum, daysAgo, fmtDate, daysWord, relDay, relTime, pill, colorDot, tokens, textScore, spotText } from '../utils.js';
import { S, curOffice, item, isStaffHere, myReports, myClaims, myCode, candidatesFor, unseenCount } from '../state.js';
import { backBtn, thumbHtml, miniItem, catPicker, colorPicker, photoField, spotOptions, spotExtra, resetForm, loginPrompt } from './common.js';
import { claimCardStaff } from './staff.js';
import { aiReady } from '../ai.js';
import { hydrate } from '../ui.js';

/* ---------- visitor: choose place ---------- */
export function vPick(){
  const act = S.offices.filter(o => o.active !== false);
  return `<div class="wrap" data-view="pick">
    <div class="intro">${LOGO}
      <h1>أين فقدت غرضك؟</h1>
      <p>اختر المكان لتدخل إلى مكتب المفقودات الخاص به وتشاهد كل ما عُثر عليه هناك.</p>
    </div>
    ${act.length ? `<div class="office-list">${act.map(o => `
      <button class="office-card ${o.id === S.officeId ? 'cur' : ''}" data-act="setOffice" data-id="${esc(o.id)}">
        <span class="oi">${icon(otype(o.type).icon)}</span>
        <span class="grow"><b>${esc(o.name)}</b><span class="meta">${esc(otype(o.type).name)} · ${esc(o.city || '')}</span></span>
        ${icon('fwd')}
      </button>`).join('')}</div>`
    : `<div class="empty">${icon('pin')}<b>لم تُضف أماكن بعد.</b>${S.isAdmin ? `<button class="btn" data-act="newOffice">${icon('plus')}أضف أول مكان</button>` : ''}</div>`}
    <div class="note">${icon('info')}<span>نبدأ بالكلية التقنية بالأحساء، وتُضاف المطارات والمجمعات التجارية والمستشفيات تباعاً.</span></div>
  </div>`;
}

/* ---------- visitor: browse ---------- */
export function vBrowse(){
  const o = curOffice();
  return `<div class="wrap" data-view="browse">
    <section class="hero">
      <div class="hero-kicker">${icon(otype(o.type).icon)}${esc(otype(o.type).name)} · ${esc(o.city || '')}</div>
      <h1 class="hero-title">مفقودات ${esc(o.name)}</h1>
      <p class="hero-sub" id="hero-count"></p>
    </section>
    <div id="match-banner"></div>
    <label class="searchbar">${icon('search')}<input id="q" type="search" placeholder="ابحث: محفظة سوداء، مفتاح تويوتا، سماعات…" value="${esc(S.filter.q)}" autocomplete="off" aria-label="بحث"></label>
    <div class="chips-scroll" id="cat-chips">${[{id:'all', name:'الكل', icon:'grid'}, ...CATS].map(c => `<button class="chip" data-act="fcat" data-id="${c.id}">${icon(c.icon)}<span>${esc(c.name)}</span></button>`).join('')}</div>
    <div class="filters">
      <div class="seg" id="st-seg">${[['available','المتاحة'],['all','الكل مع المُسلّمة']].map(([v,l]) => `<button data-act="fstatus" data-v="${v}">${l}</button>`).join('')}</div>
      <select class="select-sm" id="frange" aria-label="تاريخ العثور">
        <option value="all">أي وقت</option><option value="7">آخر 7 أيام</option><option value="30">آخر 30 يوماً</option>
      </select>
    </div>
    <div id="results"></div>
    <aside class="cta-lost">
      <div><b>لم تجد غرضك؟</b><p>سجّل بلاغاً بوصفه، وسننبّهك هنا عندما يُسجَّل غرض مطابق.</p></div>
      <button class="btn" data-act="nav" data-r="report">${icon('plus')}سجّل بلاغ مفقود</button>
    </aside>
  </div>`;
}
export function visibleItems(){
  let arr = S.items.filter(i => i.status !== 'archived');
  if (S.filter.status === 'available') arr = arr.filter(i => i.status === 'available' || i.status === 'reserved');
  if (S.filter.cat !== 'all') arr = arr.filter(i => i.cat === S.filter.cat);
  if (S.filter.range !== 'all'){ const lim = +S.filter.range; arr = arr.filter(i => daysAgo(i.foundDate) <= lim); }
  const q = tokens(S.filter.q);
  if (q.length) return arr.map(i => ({i, s: textScore(q, i)})).filter(x => x.s > 0).sort((a,b) => b.s - a.s || (b.i.createdAt||0) - (a.i.createdAt||0)).map(x => x.i);
  return arr.sort((a,b) => (dayNum(b.foundDate) - dayNum(a.foundDate)) || ((b.createdAt||0) - (a.createdAt||0)));
}
export function card(i){
  const c = cat(i.cat);
  return `<article class="card" role="button" tabindex="0" data-act="openItem" data-id="${esc(i.id)}">
    <div class="thumb">${icon(c.icon)}${i.photo && !c.sensitive ? `<img data-photo="${esc(i.id)}" alt="" hidden>` : ''}${i.sample ? '<span class="badge-sample">مثال</span>' : ''}</div>
    <div class="card-body">
      <span class="ref">${esc(i.ref)}</span>
      <h3>${esc(i.title)}</h3>
      <div class="meta">${colorDot(i.color)}${esc(colorName(i.color))}${i.spot ? ' · ' + esc(spotText(i)) : ''}</div>
      <div class="meta">${icon('clock')}<span>${relDay(i.foundDate)}</span></div>
      ${i.status !== 'available' ? pill(ITEM_STATUS, i.status) : ''}
    </div>
  </article>`;
}
export function updateBrowse(){
  const avail = S.items.filter(i => i.status === 'available').length;
  const ret = S.items.filter(i => i.status === 'returned').length;
  const hc = $('#hero-count');
  if (hc) hc.innerHTML = !S.itemsLoaded ? 'جارٍ التحميل…' : `<b>${avail}</b> ${avail === 1 ? 'غرض ينتظر' : 'غرضاً تنتظر'} أصحابها${ret ? ` · أعدنا <b>${ret}</b> لأصحابها` : ''}`;
  const n = unseenCount(); const mb = $('#match-banner');
  if (mb) mb.innerHTML = n ? `<button class="banner" data-act="nav" data-r="mine">${icon('bell')}<span class="grow">لديك ${n === 1 ? 'تنبيه جديد' : n + ' تنبيهات جديدة'} على بلاغاتك وطلباتك</span>${icon('fwd')}</button>` : '';
  $$('#cat-chips .chip').forEach(b => b.classList.toggle('on', b.dataset.id === S.filter.cat));
  $$('#st-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.filter.status));
  const fr = $('#frange'); if (fr) fr.value = S.filter.range;
  const res = $('#results'); if (!res) return;
  if (!S.itemsLoaded){ res.innerHTML = `<div class="loading"><span class="spin"></span></div>`; return; }
  const arr = visibleItems();
  res.innerHTML = arr.length ? `<div class="grid">${arr.map(card).join('')}</div>`
    : `<div class="empty">${icon('search')}<b>${S.items.length ? 'لا توجد نتائج مطابقة' : 'لا توجد مفقودات مسجّلة بعد'}</b><span>${S.items.length ? 'جرّب كلمة أخرى أو تصنيفاً مختلفاً، أو سجّل بلاغاً.' : 'عندما يسجّل مكتب المفقودات غرضاً سيظهر هنا.'}</span></div>`;
  hydrate();
}

/* ---------- item detail ---------- */
export function vItem(){
  const i = item(S.route.params.id);
  if (!i) return `<div class="wrap">${backBtn()}<div class="empty">${icon('box')}<b>لم يعد هذا الغرض موجوداً.</b></div></div>`;
  const c = cat(i.cat); const o = S.offices.find(x => x.id === i.officeId) || curOffice();
  const staffMode = S.mode === 'staff' || S.mode === 'admin';
  const keepDays = (o?.retentionDays || 90) - daysAgo(i.foundDate);
  const mine = S.claims.filter(cl => cl.itemId === i.id && cl.uid === S.uid && cl.status !== 'rejected')[0];
  let actions = '';
  if (staffMode){
    const cls = S.claims.filter(cl => cl.itemId === i.id).sort((a,b) => b.createdAt - a.createdAt);
    actions = `<div class="btn-row">
        <button class="btn" data-act="editItem" data-id="${esc(i.id)}">${icon('edit')}تعديل</button>
        <button class="btn ghost" data-act="itemStatus" data-id="${esc(i.id)}">${icon('swap')}تغيير الحالة</button>
        <button class="btn danger" data-act="delItem" data-id="${esc(i.id)}">${icon('trash')}حذف</button>
      </div>
      ${cls.length ? `<div class="section-title">طلبات الاستلام على هذا الغرض</div><div class="list">${cls.map(claimCardStaff).join('')}</div>` : ''}`;
  } else if (mine){
    actions = `<div class="note ok">${icon('check')}<span>لديك طلب استلام على هذا الغرض: <b>${CLAIM_STATUS[mine.status].l}</b></span></div>
      <button class="btn soft" data-act="nav" data-r="mine">تابع طلبك</button>`;
  } else if (i.status === 'available'){
    actions = S.uid ? `<button class="btn block" data-act="goClaim" data-id="${esc(i.id)}">${icon('shield')}هذا غرضي — اطلب استلامه</button>
      <p class="hint">ستُسأل عن تفاصيل لا تظهر في الإعلان لتثبت ملكيتك، ثم يصلك رمز تحقق تقدّمه عند الاستلام.</p>`
      : `<button class="btn block" data-act="login">${icon('shield')}سجّل الدخول لتطلب الاستلام</button>`;
  } else if (i.status === 'reserved'){
    actions = `<div class="note warn">${icon('clock')}<span>هذا الغرض محجوز لصاحب طلب تمت الموافقة عليه وبانتظار حضوره.</span></div>`;
  } else if (i.status === 'returned'){
    actions = `<div class="note info">${icon('check')}<span>سُلّم هذا الغرض لصاحبه.</span></div>`;
  }
  return `<div class="wrap" data-view="item">${backBtn()}
    <div class="detail">
      <div class="detail-photo">${icon(c.icon)}${i.photo && !c.sensitive ? `<img data-photo="${esc(i.id)}" alt="${esc(i.title)}" hidden>` : ''}
        ${c.sensitive ? `<div class="veil">${icon('lock')}<span>لا تُعرض صور الوثائق الشخصية حفاظاً على خصوصية أصحابها.</span></div>` : ''}
        ${i.sample ? '<span class="badge-sample">مثال توضيحي</span>' : ''}
      </div>
      <div class="panel">
        <div class="panel-head"><span class="ref">${esc(i.ref)}</span>${pill(ITEM_STATUS, i.status)}</div>
        <h1 style="font-size:24px;font-weight:800">${esc(i.title)}</h1>
        ${i.desc ? `<p>${esc(i.desc)}</p>` : ''}
        <dl class="facts">
          <dt>التصنيف</dt><dd>${icon(c.icon)}${esc(c.name)}${i.sub ? ' — ' + esc(i.sub) : ''}</dd>
          ${i.color ? `<dt>اللون</dt><dd>${colorDot(i.color)}${esc(colorName(i.color))}</dd>` : ''}
          <dt>مكان العثور</dt><dd>${esc(spotText(i) || 'غير محدد')}</dd>
          <dt>تاريخ العثور</dt><dd>${fmtDate(i.foundDate)} <span class="muted">(${relDay(i.foundDate)})</span></dd>
          ${staffMode && i.storage ? `<dt>موضع الحفظ</dt><dd>${esc(i.storage)}</dd>` : ''}
          ${i.status === 'available' || i.status === 'reserved' ? `<dt>مدة الحفظ</dt><dd>${keepDays > 0 ? `متبقٍّ ${daysWord(keepDays)}` : '<span class="flag">انتهت مدة الحفظ</span>'}</dd>` : ''}
        </dl>
        ${actions}
      </div>
    </div>
    ${o ? `<div class="panel"><div class="section-title">${icon('building')}أين تستلم؟</div>
      <dl class="facts"><dt>المكتب</dt><dd>${esc(o.place || o.name)}</dd>${o.hours ? `<dt>أوقات العمل</dt><dd>${esc(o.hours)}</dd>` : ''}</dl></div>` : ''}
  </div>`;
}

/* ---------- visitor: claim ---------- */
export function vClaimForm(){
  const i = item(S.route.params.id); const o = curOffice();
  if (!i) return `<div class="wrap">${backBtn()}<div class="empty">لم يعد هذا الغرض موجوداً.</div></div>`;
  return `<div class="wrap" data-view="claim">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('shield')}طلب استلام</div><h1 class="hero-title">أثبت أن الغرض لك</h1></section>
    ${miniItem(i)}
    <form data-form="claim" data-id="${esc(i.id)}" class="panel" novalidate>
      <div class="field"><label for="proof">صف تفاصيل لا تظهر في الإعلان</label>
        <textarea id="proof" name="proof" class="input" required placeholder="مثال: داخل المحفظة بطاقة صراف من بنك معين وصورة عائلية، وفيها خدش عند الزاوية اليمنى."></textarea>
        <span class="hint">محتوى الغرض، علامة مميزة، خلفية الشاشة، رقم تسلسلي… كلما كانت التفاصيل أدق كان القبول أسرع.</span></div>
      <div class="two">
        <div class="field"><label for="c-spot">أين فقدته تقريباً؟</label><select id="c-spot" name="spot" class="input"><option value="">لا أعرف</option>${(o?.spots || []).map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label for="c-date">متى فقدته؟</label><input id="c-date" name="lostDate" type="date" class="input" max="${today()}"></div>
      </div>
      <label class="check"><input type="checkbox" name="pledge" id="pledge"><span>أقرّ بأن هذا الغرض ملكي، وأن المعلومات التي كتبتها صحيحة.</span></label>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}أرسل الطلب</button>
      <div class="note">${icon('lock')}<span>لا يرى هذه التفاصيل إلا موظف مكتب المفقودات. عند قبول طلبك يظهر لك رمز تحقق من 6 أرقام في «طلباتي» تقدّمه عند الاستلام.</span></div>
    </form>
  </div>`;
}

/* ---------- visitor: report lost ---------- */
export function vReportForm(){
  resetForm();
  const o = curOffice();
  if (!S.uid) return `<div class="wrap">${loginPrompt('سجّل الدخول لتسجيل بلاغ عن غرض مفقود.')}</div>`;
  return `<div class="wrap" data-view="report">
    <section class="hero"><div class="hero-kicker">${icon('bell')}بلاغ مفقود · ${esc(o.name)}</div><h1 class="hero-title">ماذا فقدت؟</h1>
      <p class="hero-sub">صف غرضك مرة واحدة، ويقارنه مفقودك بكل ما يُسجَّل في المكتب وينبّهك عند وجود تطابق.</p></section>
    <form data-form="report" class="panel" novalidate>
      ${photoField(null, 'صورة للغرض (اختياري)')}
      <div class="field"><span class="label">التصنيف</span>${catPicker('')}</div>
      <div class="field" id="subs-field" hidden><span class="label">النوع</span><div id="subs"></div></div>
      <div class="field"><span class="label">اللون</span>${colorPicker('')}</div>
      <div class="field"><label for="r-title">اسم الغرض باختصار</label><input id="r-title" name="title" class="input" required placeholder="مثال: محفظة جلد بنية" maxlength="80"></div>
      <div class="field"><label for="r-desc">وصف يساعد على التعرف عليه</label><textarea id="r-desc" name="desc" class="input" placeholder="العلامة التجارية، المقاس، ما بداخله، أي علامة مميزة…" maxlength="600"></textarea></div>
      <div class="two">
        <div class="field"><label for="r-spot">أين فقدته؟</label><select id="r-spot" name="spot" class="input">${spotOptions(o, '')}</select></div>
        <div class="field"><label for="r-date">متى؟</label><input id="r-date" name="lostDate" type="date" class="input" value="${today()}" max="${today()}"></div>
      </div>
      ${spotExtra(null)}
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('search')}سجّل البلاغ وابحث عن تطابق</button>
    </form>
  </div>`;
}

/* ---------- visitor: my requests ---------- */
export function vMine(){
  if (!S.uid) return `<div class="wrap">${loginPrompt('سجّل الدخول لمتابعة بلاغاتك وطلبات الاستلام.')}</div>`;
  const reps = myReports(), cls = myClaims(), o = curOffice();
  const focus = S.route.params.focus;
  return `<div class="wrap" data-view="mine">
    <section class="hero"><div class="hero-kicker">${icon('inbox')}${esc(o.name)}</div><h1 class="hero-title">طلباتي</h1></section>
    <div class="section-title">طلبات الاستلام ${cls.length ? `<span class="count">${cls.length}</span>` : ''}</div>
    ${cls.length ? `<div class="list">${cls.map(claimCardMine).join('')}</div>` : `<div class="note">${icon('info')}<span>عندما تجد غرضك في القائمة اضغط «هذا غرضي» وسيظهر طلبك هنا.</span></div>`}
    <div class="section-title">بلاغاتي عن المفقودات ${reps.length ? `<span class="count">${reps.length}</span>` : ''}</div>
    ${reps.length ? `<div class="list">${reps.map(r => reportCardMine(r, r.id === focus)).join('')}</div>`
      : `<div class="empty">${icon('bell')}<b>لا توجد بلاغات</b><button class="btn soft" data-act="nav" data-r="report">${icon('plus')}سجّل بلاغ مفقود</button></div>`}
  </div>`;
}
export function claimSteps(st){
  const s1 = true, s2 = st === 'approved' || st === 'done', s3 = st === 'done';
  return `<div class="steps"><span class="${s1 ? 'done' : ''}"><i></i>أُرسل</span><span class="sep"></span><span class="${s2 ? 'done' : ''}"><i></i>قُبل</span><span class="sep"></span><span class="${s3 ? 'done' : ''}"><i></i>استُلم</span></div>`;
}
export function claimCardMine(c){
  const i = item(c.itemId); const o = curOffice(); const code = myCode(c.id);
  let body = '';
  if (c.status === 'pending') body = `<p class="muted">يراجع موظف المكتب التفاصيل التي أرسلتها.</p>`;
  else if (c.status === 'approved') body = code
    ? `<div class="code-tag"><small>رمز الاستلام</small><span class="digits">${esc(code)}</span><small>اعرضه لموظف المكتب عند الاستلام</small></div>
       <dl class="facts"><dt>المكان</dt><dd>${esc(o?.place || o?.name || '')}</dd>${o?.hours ? `<dt>الأوقات</dt><dd>${esc(o.hours)}</dd>` : ''}</dl>`
    : `<div class="note warn">${icon('info')}<span>قُبل طلبك، لكن الرمز غير محفوظ على هذا الجهاز. افتح التطبيق من الجهاز الذي أرسلت منه الطلب، أو راجع المكتب مع إثبات الهوية.</span></div>`;
  else if (c.status === 'done') body = `<div class="note info">${icon('check')}<span>استلمت غرضك ${relTime(c.doneAt)}. سعداء بعودته إليك.</span></div>`;
  else if (c.status === 'rejected') body = `<div class="note warn">${icon('info')}<span>لم يُقبل الطلب${c.note ? ': ' + esc(c.note) : '.'}</span></div>`;
  return `<div class="box">
    <div class="box-head"><div>${i ? `<span class="ref">${esc(i.ref)}</span>` : ''}<h3>${esc(i?.title || 'غرض محذوف')}</h3><span class="meta">أُرسل ${relTime(c.createdAt)}</span></div>${pill(CLAIM_STATUS, c.status)}</div>
    ${c.status !== 'rejected' ? claimSteps(c.status) : ''}
    ${body}
  </div>`;
}
export function reportCardMine(r, focus){
  const pick = r.staffPick ? item(r.staffPick) : null;
  const cands = r.status === 'open' ? candidatesFor(r, 4).filter(x => x.i.id !== r.staffPick) : [];
  const ai = r.ai?.matches || [];
  return `<div class="box" ${focus ? 'style="border-color:var(--primary)"' : ''}>
    <div class="box-head"><div><h3>${esc(r.title)}</h3><span class="meta">${icon(cat(r.cat).icon)}${esc(catName(r.cat))}${r.color ? ' · ' + colorDot(r.color) + esc(colorName(r.color)) : ''} · فُقد ${relDay(r.lostDate)}</span></div>${pill(REPORT_STATUS, r.status)}</div>
    ${r.status === 'open' ? `
      ${pick ? `<div class="pick-box"><span class="t">${icon('shield')}رشّح موظف المكتب هذا الغرض لبلاغك</span>${miniItem(pick)}</div>` : ''}
      ${cands.length ? `<span class="label">تطابقات محتملة</span><div class="list">${cands.map(({i, s}) => miniItem(i, `<span class="score">${s}%</span>`)).join('')}</div>`
        : !pick ? `<div class="note">${icon('clock')}<span>لا يوجد تطابق حتى الآن. سنعرض هنا أي غرض مشابه فور تسجيله في المكتب.</span></div>` : ''}
      ${ai.length ? `<span class="label">${icon('spark')} ترتيب الذكاء الاصطناعي</span><div class="list">${ai.map(m => { const it = item(m.id); return it ? `<div>${miniItem(it, `<span class="score">${Math.round(m.score)}%</span>`)}<div class="reason">${esc(m.reason || '')}</div></div>` : ''; }).join('')}</div>`
        : r.ai ? `<div class="note">${icon('spark')}<span>لم يجد الذكاء الاصطناعي غرضاً مطابقاً ${relTime(r.ai.at)}.</span></div>` : ''}
      <div class="btn-row">
        ${aiReady() ? `<button class="btn sm soft" data-act="aiMatch" data-id="${esc(r.id)}">${icon('spark')}مطابقة ذكية</button>` : ''}
        <button class="btn sm ghost" data-act="closeReport" data-id="${esc(r.id)}">${icon('check')}وجدت غرضي</button>
        <button class="btn sm ghost" data-act="delReport" data-id="${esc(r.id)}">${icon('trash')}حذف</button>
      </div>
      <span class="ai-status" id="ai-${esc(r.id)}"></span>`
    : `<div class="btn-row"><button class="btn sm ghost" data-act="delReport" data-id="${esc(r.id)}">${icon('trash')}حذف البلاغ</button></div>`}
  </div>`;
}

/* ---------- visitor: office info ---------- */
export function vOffice(){
  const o = curOffice();
  const req = S.myReq; const isStaff = isStaffHere();
  return `<div class="wrap" data-view="office">
    <section class="hero"><div class="hero-kicker">${icon(otype(o.type).icon)}${esc(otype(o.type).name)} · ${esc(o.city || '')}</div><h1 class="hero-title">${esc(o.name)}</h1></section>
    <div class="panel">
      <div class="section-title">${icon('building')}مكتب المفقودات</div>
      <dl class="facts">
        <dt>الموقع</dt><dd>${esc(o.place || '—')}</dd>
        ${o.hours ? `<dt>أوقات العمل</dt><dd>${esc(o.hours)}</dd>` : ''}
        ${o.phone ? `<dt>التواصل</dt><dd><span dir="ltr">${esc(o.phone)}</span><button class="link" data-act="copy" data-v="${esc(o.phone)}">${icon('copy')}نسخ</button></dd>` : ''}
        <dt>مدة حفظ المفقودات</dt><dd>${daysWord(o.retentionDays || 90)}</dd>
      </dl>
    </div>
    <div class="section-title">كيف يعمل مفقودك؟</div>
    <ol class="how">
      <li><b>ابحث في المفقودات</b><span>تصفّح ما سجّله المكتب حسب التصنيف واللون والمكان.</span></li>
      <li><b>اطلب الاستلام</b><span>اكتب تفاصيل لا يعرفها إلا صاحب الغرض ليتحقق منها الموظف.</span></li>
      <li><b>استلم برمز التحقق</b><span>بعد القبول يظهر لك رمز من 6 أرقام تقدّمه في المكتب.</span></li>
      <li><b>أو سجّل بلاغاً</b><span>إن لم تجده، صف غرضك وسننبّهك عند تسجيل غرض مطابق.</span></li>
    </ol>
    <button class="btn ghost" data-act="pickOffice">${icon('pin')}تغيير المكان</button>
    <div class="panel">
      <div class="section-title">${icon('users')}هل تعمل في مكتب المفقودات؟</div>
      ${isStaff ? `<div class="note ok">${icon('check')}<span>لديك صلاحية موظف في هذا المكتب. بدّل إلى «موظف المكتب» من أعلى الشاشة.</span></div>`
      : req?.status === 'pending' ? `<div class="note warn">${icon('clock')}<span>طلب الصلاحية قيد المراجعة من إدارة التطبيق.</span></div>`
      : `<p class="muted">يمنح مالك التطبيق صلاحية إدخال المفقودات لموظفي كل مكتب.</p><button class="btn soft" data-act="nav" data-r="join">${icon('shield')}اطلب صلاحية موظف</button>`}
    </div>
  </div>`;
}
export function vJoin(){
  if (!S.uid) return `<div class="wrap">${backBtn()}${loginPrompt('سجّل الدخول أولاً لطلب صلاحية موظف.')}</div>`;
  const req = S.myReq; const act = S.offices.filter(o => o.active !== false);
  return `<div class="wrap" data-view="join">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('shield')}صلاحية موظف</div><h1 class="hero-title">اطلب صلاحية إدخال المفقودات</h1>
      <p class="hero-sub">يصل طلبك إلى مالك التطبيق، وعند الموافقة يظهر لك وضع «موظف المكتب».</p></section>
    ${req ? `<div class="note ${req.status === 'pending' ? 'warn' : req.status === 'approved' ? 'ok' : ''}">${icon('info')}<span>${req.status === 'pending' ? 'طلبك السابق قيد المراجعة. يمكنك تعديله وإعادة إرساله.' : req.status === 'approved' ? 'تمت الموافقة على طلبك.' : 'لم تتم الموافقة على طلبك السابق. يمكنك إرسال طلب جديد.'}</span></div>` : ''}
    <form data-form="join" class="panel" novalidate>
      <div class="field"><span class="label">المكتب الذي تعمل فيه</span>
        ${act.map(o => `<label class="check"><input type="checkbox" name="offices" value="${esc(o.id)}" ${(req?.offices || [S.officeId]).includes(o.id) ? 'checked' : ''}><span>${esc(o.name)}</span></label>`).join('')}</div>
      <div class="field"><label for="j-note">الاسم والوظيفة</label><input id="j-note" name="note" class="input" maxlength="120" value="${esc(req?.note || '')}" placeholder="مثال: خالد — شؤون المتدربين"></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}أرسل الطلب</button>
    </form>
  </div>`;
}
