// الصفحة الرئيسية للمكان المختار + صفحة «وجدت غرضاً»
import { icon, LOGO, otype, otypeName, oName, oPlace, oHours, oCity, brandOf, cat, statusLabel, ITEM_STATUS, CLAIM_STATUS } from '../constants.js';
import { $, esc, today, isoDay, showTitle } from '../utils.js';
import { t, tp } from '../i18n.js';
import { S, curOffice } from '../state.js';
import { card, skelCards, groupCard, groupEntries, groupedHere, pubActive, attnRows } from './visitor.js';
import { backBtn, catPicker, spotOptions, spotExtra } from './common.js';
import { APP_VERSION } from '../config.js';
import { officeUrl, brandLogo, collegeLinks, oKicker, emptyBox, navBtn, relDayT, telLink } from './common.js';
import { load } from '../lazy.js';   // H8: رمز QR في التذييل يُحمَّل بعد الرسم
import { hydrate } from '../ui.js';

// H38: مقطع «خطوات الخدمة» المتحرك في الواجهة (بدل رسمة البطاقة TAG_ART). يكرّر في 10 ثوانٍ الخطوات الثلاث
//      بعناصر المنصة وكلماتها نفسها: البحث ← «هذا غرضي — طلب الاستلام» ← رمز الاستلام ← «تم الاستلام».
//      CSS فقط بلا JavaScript (يناسب CSP)؛ الأنماط والتوقيت في كتلة H38 آخر styles.css.
//      الجزء المتحرك aria-hidden، وقارئ الشاشة يقرأ الخطوات نفسها من قسم «خطوات الخدمة» تحته.
//      زر الإيقاف المؤقت = مربع اختيار #md-pause + label (بلا معالج نقر). أرقام القيد تبدأ برمز المكتب (TCA للكلية)
const howDemo = o => {
  const pre = esc((o?.code || 'MFQ').toUpperCase());
  const wallet = `<span class="md-tile">${icon('wallet')}</span>`;
  const ref = id => `<span class="md-ref">${pre}-${id}</span>`;
  const row = (cls, name, id, days) => `<div class="md-res ${cls}">${wallet}<span class="md-txt"><b>${name}</b><small>${ref(id)}${tp('time.daysAgo', days)}</small></span>${icon('fwd', 'md-chev')}</div>`;
  return `<figure class="mfq-demo" aria-label="${t('demo.aria')}">
      <input type="checkbox" id="md-pause" class="md-pause-in">
      <div class="md-in" aria-hidden="true">
        <div class="md-bars"><i><b></b></i><i><b></b></i><i><b></b></i></div>
        <div class="md-caps">${[1, 2, 3].map(n => `<p class="md-cap md-c${n}"><span class="md-n">${n}</span><span class="md-ct">${t('home.how' + n)}</span></p>`).join('')}</div>
        <div class="md-screen">
          <div class="md-sc md-s1">
            <div class="md-search">${icon('search')}<span class="md-q-box"><span class="md-ph">${t('home.searchAria')}</span><span class="md-type md-q"><span>${t('demo.q')}</span></span></span><span class="md-go">${t('home.search')}</span></div>
            ${row('md-ra', t('demo.item1'), 'W7KM', 2)}
            ${row('md-rb', t('demo.item2'), 'N4RX', 5)}
          </div>
          <div class="md-sc md-s2">
            <div class="md-item">${wallet}<span class="md-txt"><b>${t('demo.item1')}</b><small>${ref('W7KM')}<span class="md-pill md-ok">${statusLabel(ITEM_STATUS.available)}</span></small></span></div>
            <span class="md-claim">${t('it.claim')}</span>
            <div class="md-proof"><span class="md-lbl">${t('cl.proof')}</span><span class="md-input"><span class="md-type md-q2"><span>${t('demo.proof')}</span></span></span></div>
            <div class="md-status"><span class="md-pill md-warn md-pend">${icon('clock')}${statusLabel(CLAIM_STATUS.pending)}</span><span class="md-pill md-ok md-acc">${icon('check')}${statusLabel(CLAIM_STATUS.approved)}</span></div>
          </div>
          <div class="md-sc md-s3">
            <span class="md-s3-lbl">${t('mine.code')}</span>
            <div class="md-tag"><svg viewBox="0 0 270 84"><path class="md-tag-str" d="M245 27C251 13 259 5 273 0"/><path class="md-tag-body" d="M14 1H234L269 36V70A13 13 0 0 1 256 83H14A13 13 0 0 1 1 70V14A13 13 0 0 1 14 1Z"/><circle class="md-tag-hole" cx="245" cy="27" r="7"/></svg><span class="md-code-box"><span class="md-code-w"><span class="md-code">K7MA-4XTR</span></span></span></div>
            <span class="md-hint">${t('mine.codeHint')}</span>
            <div class="md-done"><span class="md-done-ic"><svg viewBox="0 0 24 24"><path class="md-ck" pathLength="1" d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><b>${statusLabel(CLAIM_STATUS.done)}</b></div>
          </div>
          <div class="md-ptr"><i></i></div>
        </div>
      </div>
      <label for="md-pause" class="md-pause"><svg class="md-stop" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg><svg class="md-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z"/></svg><span class="sr-only">${t('demo.pause')}</span></label>
    </figure>`;
};

// H4: شريط الأرقام الثلاثة انتقل إلى صفحة التصفح. «تفاصيل الخدمات» و«مؤشرات المكتب» صفّا روابط هادئان
// بعرض كامل بعد «خصوصيتك أولاً» وقبل التذييل
// H19: زرّان رئيسيان فقط («أضعتُ غرضاً» و«وجدتُ غرضاً»)؛ التصفح والخدمات تحتهما في صفوف الروابط
export function vHome(){
  const o = curOffice();
  return `<div class="wrap home" data-view="home">
    ${/* H27: لمن عاد إلى المنصة: أهم ما ينتظره في «طلباتي» (يملؤه updateHome) */ ''}<div id="home-resume" hidden></div>
    <section class="hero-home">
      <div class="hh-text">
        ${brandOf(o)
          // H15: مكتب الكلية: شعارها (أبيض فوق الأخضر الداكن) وبجانبه «مكتب المفقودات» بدل سطر نوع المكان
          ? `<div class="hh-brand">${brandLogo(o, 'dark')}<span class="hh-brand-txt">${t('br.office')}</span></div>`
          : oKicker(o) ? `<span class="hh-kicker">${oKicker(o)}</span>` : ''}
        <h1>${t('home.lostIn', {name: esc(oName(o))})}</h1>
        <p>${t('home.lead')}</p>
        <form class="hero-search" data-form="homeSearch" role="search">
          ${icon('search')}<input id="hq" name="q" type="search" placeholder="${t('home.searchPh')}" autocomplete="off" aria-label="${t('home.searchAria')}">
          <button class="btn" type="submit">${t('home.search')}</button>
        </form>
      </div>
      ${howDemo(o)}
      <div class="cta3 cta2">
        <button class="cta" data-act="nav" data-r="report"><span class="ci">${icon('bell')}</span><span><b>${t('home.ctaLost')}</b><small>${t('home.ctaLostSub')}</small></span></button>
        <button class="cta" data-act="nav" data-r="found"><span class="ci">${icon('tag')}</span><span><b>${t('home.ctaFound')}</b><small>${t('home.ctaFoundSub')}</small></span></button>
      </div>
    </section>

    <section class="home-sec">
      <div class="sec-head"><h2>${t('home.latest')}</h2><button class="link" data-act="nav" data-r="browse">${t('home.seeAll')} ${icon('fwd')}</button></div>
      <div id="home-latest"></div>
    </section>

    <section class="home-sec how-panel">
      <div class="sec-head"><h2>${t('home.how')}</h2></div>
      <ol class="how how3">
        <li><b>${t('home.how1')}</b><span>${t('home.how1d')}</span></li>
        <li><b>${t('home.how2')}</b><span>${t('home.how2d')}</span></li>
        <li><b>${t('home.how3')}</b><span>${t('home.how3d')}</span></li>
      </ol>
    </section>

    <section class="home-sec">
      <div class="sec-head"><h2>${t('ofc.privacy')}</h2><button class="link" data-act="nav" data-r="office">${t('home.privacyMore')} ${icon('fwd')}</button></div>
      <ul class="trust-row">
        <li>${icon('lock')}<span>${t('ofc.f1')}</span></li>
        <li>${icon('idcard')}<span>${t('ofc.f2')}</span></li>
        <li>${icon('shield')}<span>${t('ofc.f3')}</span></li>
      </ul>
    </section>

    <nav class="link-rows" aria-label="${t('home.moreAria')}">
      <button class="link-row" data-act="nav" data-r="service"><span class="lr-ic">${icon('book')}</span><span class="grow"><b>${t('svc.details')}</b><small>${t('home.svcDesc')}</small></span>${icon('fwd')}</button>
      <button class="link-row" data-act="nav" data-r="numbers"><span class="lr-ic">${icon('chart')}</span><span class="grow"><b>${t('num.title')}</b><small>${t('home.numDesc')}</small></span>${icon('fwd')}</button>
    </nav>

    ${footer(o)}
  </div>`;
}

// H30: حُذف سطر المكان والأوقات والهاتف من الواجهة بطلب المالك (لا حاجة له فيها). تبقى في صفحة «المكتب»
//      وحيث يحتاجها الزائر للاستلام (صفحة الغرض، وبطاقة رمز الاستلام، وبطاقة الخدمة)
// H26: صف مضغوط في «أحدث المفقودات» (أيقونة التصنيف + العنوان + سطر صغير)، زرّ يفتح الغرض أو طلب الوصف
const miniRow = ({act, ic, title, sub, ref = ''}) => `<li><button class="mini-row" ${act}><span class="mr-ic">${icon(ic)}</span>
  <span class="grow"><b>${esc(title)}</b><small>${ref ? `<span class="ref">${esc(ref)}</span> ` : ''}${sub}</small></span>${icon('fwd')}</button></li>`;
export function updateHome(){
  const o = curOffice(); if (!o) return;
  // H27: سطر «متابعة» أعلى الصفحة: أول مهمة في «يحتاج انتباهك» (رمز استلام جاهز، سؤال من المكتب، تقييم…). يتبع «لاحقاً» هناك
  const rs = $('#home-resume');
  if (rs){
    const r = S.uid ? attnRows()[0] : null, k = r ? r.ak : '';
    if (rs.dataset.k !== k){
      rs.dataset.k = k; rs.hidden = !r;
      rs.innerHTML = r ? `<section class="resume" aria-label="${t('home.resumeAria')}">${icon(r.ic)}<span class="grow">${r.msg}</span>
        <button class="btn sm" data-act="resume" data-tab="${r.tab}" data-card="${esc(r.key)}">${t('home.resumeBtn')}${icon('fwd')}</button></section>` : '';
    }
  }
  const avail = pubActive();   // H16: بلا النقود (لا تظهر للزائر)
  const cc = $('#cta-count'); if (cc && S.itemsLoaded) cc.textContent = avail.length ? t('home.availNow', {items: tp('n.item', avail.length)}) : t('home.ctaBrowseSub');
  const latest = $('#home-latest');
  if (latest){
    if (!S.itemsLoaded) latest.innerHTML = `<div class="hscroll" aria-busy="true" aria-label="${t('c.loading')}">${skelCards()}</div>`;
    else {
      // H11: أغراض التصنيفات المجمّعة (نقود، بطاقات…) بطاقة واحدة لكل تصنيف، مرتّبة مع غيرها بآخر تسجيل
      const rows = [...groupEntries(avail).map(g => ({at: g.last, html: groupCard(g), mini: miniRow({act: `data-act="gclaim" data-cat="${esc(g.group)}"`, ic: cat(g.group).icon,
          title: t('grp.' + g.group + '.title'), sub: t('grp.count', {items: tp('n.item', g.n), date: g.last ? relDayT(isoDay(g.last)) : '—'})})})),
        ...avail.filter(i => !groupedHere(i.cat)).map(i => ({at: i.createdAt || 0, html: card(i), mini: miniRow({act: `data-act="openItem" data-id="${esc(i.id)}"`, ic: cat(i.cat).icon,
          title: showTitle(i), sub: relDayT(i.foundDate), ref: i.ref})}))];
      const arr = rows.sort((a, b) => b.at - a.at).slice(0, 8);
      // H26: أقل من 3 أغراض: قائمة مضغوطة بلا مساحة صور كبيرة (البطاقات الكبيرة تبدو فارغة مع غرض أو اثنين)
      latest.innerHTML = arr.length && arr.length < 3 ? `<ul class="latest-mini">${arr.map(x => x.mini).join('')}</ul>`
        : arr.length ? `<div class="hscroll">${arr.map(x => x.html).join('')}</div>`
        : emptyBox('box', t('home.empty'), t('home.emptySub'), navBtn('report', 'bell', t('home.ctaLost')));
    }
  }
  fillFootQr();
  hydrate();
}
// H8: رمز QR في التذييل يُرسم بعد تحميل qr.js (مكانه محجوز بالحجم نفسه فلا تقفز الصفحة).
// H24: مصدّرة لأن التذييل صار في كل صفحات الزائر (decorate في ui.js)
export function fillFootQr(){
  const q = $('#sf-qr');
  if (q && !q.firstChild) load('qr').then(m => { if (q.isConnected && !q.firstChild) q.innerHTML = m.qrSvg(q.dataset.url, {label: t('po.qrAria')}); }).catch(() => {});
}

/* التذييل (H24، بأسلوب المنصات الحكومية): شريط بعرض الصفحة بالأخضر الداكن (--hero-bg) ونص أبيض، في كل صفحات الزائر.
   الأعمدة: الهوية (الشعار، والوصف، ورمز QR للمكتب) · «روابط مهمة» · «الدعم والمساعدة» (H28: حُذف عمود «تواصل معنا»،
   ومعلومات المكتب في صفحة المكتب وسطر الواجهة)
   · «روابط الكلية» (مكتب الكلية فقط، H15) · شريط أخير: الحقوق، وسطر إذن الكلية، ورقم الإصدار.
   بلا ختم «موقع حكومي رسمي» ولا شعار الهيئة أو رؤية 2030: المنصة ليست جهة حكومية، والشعار الوحيد شعار الكلية */
const fLink = (r, label, extra = '') => `<li><button class="link" data-act="nav" data-r="${r}"${extra}>${label}</button></li>`;
export function footer(o){
  return `<footer class="site-foot">
    <div class="sf-top">
      <div class="sf-brand">
        <div class="sf-id">${LOGO}<b>${t('app.name')}</b></div>
        <p>${t('foot.tagline')}</p>
        <div class="sf-qr"><span class="qr-slot" id="sf-qr" data-url="${esc(officeUrl(o))}"></span><small>${t('foot.qr')}</small></div>
      </div>
      <nav class="sf-col sf-imp" aria-labelledby="sf-links">
        <h2 class="sf-h" id="sf-links">${t('foot.links')}</h2>
        <ul class="sf-links">${fLink('service', t('svc.details'))}${fLink('browse', t('nav.browse'))}${fLink('numbers', t('num.title'))}</ul>
      </nav>
      <nav class="sf-col sf-help" aria-labelledby="sf-support">
        <h2 class="sf-h" id="sf-support">${t('foot.support')}</h2>
        <ul class="sf-links">${fLink('office', t('foot.faq'))}${fLink('privacy', t('foot.legal'))}${fLink('a11y', t('foot.a11y'))}</ul>
      </nav>
      ${brandOf(o) ? `<nav class="sf-col sf-college" aria-labelledby="sf-college">
        <h2 class="sf-h" id="sf-college">${t('br.links')}</h2>
        <div class="sf-cl-row">${brandLogo(o, 'dark', 'sf-logo')}${collegeLinks(o)}</div>
      </nav>` : ''}
    </div>
    <div class="sf-bottom">
      <small class="sf-copy">${t('foot.rights', {year: today().slice(0, 4)})}</small>
      ${brandOf(o) ? `<small class="sf-perm">${t('br.permission')}</small>` : ''}
      <small class="sf-ver">${t('ui.version', {v: APP_VERSION})}</small>
    </div>
  </footer>`;
}

export function vFound(){
  const o = curOffice();
  return `<div class="wrap" data-view="found">
    <section class="hero"><div class="hero-kicker">${icon('tag')}${t('found.kicker')}</div>
      <h1 class="hero-title">${t('found.title')}</h1>
      <p class="hero-sub">${t('found.sub')}</p></section>
    <ol class="how how3">
      <li><b>${t('found.s1')}</b><span>${t('found.s1d')}</span></li>
      <li><b>${t('found.s2')}</b><span>${t('found.s2d')}</span></li>
      <li><b>${t('found.s3')}</b><span>${t('found.s3d')}</span></li>
    </ol>
    <div class="panel">
      <h2 class="section-title">${icon('building')}${t('found.where')}</h2>
      <dl class="facts">
        <dt>${t('found.office')}</dt><dd>${esc(oPlace(o) || oName(o))}</dd>
        ${oHours(o) ? `<dt>${t('found.hours')}</dt><dd>${esc(oHours(o))}</dd>` : ''}
        ${o.phone ? `<dt>${t('found.contact')}</dt><dd>${telLink(o.phone)}<button class="link" data-act="copy" data-v="${esc(o.phone)}">${icon('copy')}${t('c.copy')}</button></dd>` : ''}
      </dl>
    </div>
    <div class="panel handin-cta">
      <h2 class="section-title">${icon('bell')}${t('hi.ctaTitle')}</h2>
      <p class="muted">${t('hi.ctaBody')}</p>
      <button class="btn" data-act="nav" data-r="handin" style="align-self:flex-start">${icon('plus')}${t('hi.ctaBtn')}</button>
    </div>
    <div class="note warn">${icon('idcard')}<span>${t('found.idWarn')}</span></div>
    <div class="note">${icon('shield')}<span>${t('found.staffNote')}</span></div>
  </div>`;
}

/* إشعار تسليم: من وجد غرضاً يسجّله قبل أن يسلّمه للمكتب، فيعرف الموظف ما سيصله ويتابع الواجد حالته */
export function vHandin(){
  const o = curOffice();
  // H26: يُعبّأ بلا دخول؛ الدخول والتوثيق عند «إرسال الإشعار» فقط، والمسودة تبقى (draftGate في actions.js)
  return `<div class="wrap" data-view="handin">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('tag')}${t('hi.kicker', {office: esc(oName(o))})}</div><h1 class="hero-title">${t('hi.title')}</h1>
      <p class="hero-sub">${t('hi.sub')}</p></section>
    ${!S.uid ? `<div class="note info">${icon('info')}<span>${t('dr.hintHandin')}</span></div>` : ''}
    <form data-form="handin" class="panel" novalidate>
      <div class="field"><span class="label">${t('c.category')}</span>${catPicker('')}</div>
      <div class="field" id="subs-field" hidden><span class="label">${t('c.type')}</span><div id="subs"></div></div>
      <div class="two">
        <div class="field"><label for="h-spot">${t('if.spot')}</label><select id="h-spot" name="spot" class="input">${spotOptions(o, '')}</select></div>
        <div class="field"><label for="h-date">${t('if.date')}</label><input id="h-date" name="foundDate" type="date" class="input" value="${today()}" max="${today()}"></div>
      </div>
      ${spotExtra(null)}
      <div class="field"><label for="h-note">${t('hi.note')} <span class="hint">${t('c.optional')}</span></label><textarea id="h-note" name="note" class="input" maxlength="500" placeholder="${t('hi.notePh')}"></textarea></div>
      <div class="note">${icon('lock')}<span>${t('hi.privacy')}</span></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${t('hi.send')}</button>
    </form>
  </div>`;
}
