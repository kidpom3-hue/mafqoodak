// الصفحة الرئيسية للمكان المختار + صفحة «وجدت غرضاً»
import { icon, LOGO, otype, otypeName, oName, oPlace, oHours, oCity, brandOf, cat } from '../constants.js';
import { $, esc, today, isoDay, showTitle } from '../utils.js';
import { t, tp } from '../i18n.js';
import { S, curOffice } from '../state.js';
import { card, skelCards, groupCard, groupEntries, groupedHere, pubActive } from './visitor.js';
import { backBtn, catPicker, spotOptions, spotExtra } from './common.js';
import { APP_VERSION } from '../config.js';
import { officeUrl, brandLogo, collegeLinks, oKicker, emptyBox, navBtn, relDayT } from './common.js';
import { load } from '../lazy.js';   // H8: رمز QR في التذييل يُحمَّل بعد الرسم
import { hydrate } from '../ui.js';

const TAG_ART = `<svg class="tag-art" viewBox="0 0 220 240" aria-hidden="true">
  <path d="M104 18c-30 4-52 26-58 58" fill="none" stroke="var(--hero-accent)" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 7"/>
  <g transform="rotate(-10 120 140)">
    <path d="M70 60h82l38 38v118a10 10 0 0 1-10 10H70a10 10 0 0 1-10-10V70a10 10 0 0 1 10-10Z" fill="var(--hero-accent)"/>
    <circle cx="160" cy="84" r="10" fill="var(--hero-bg)"/>
    <circle cx="116" cy="148" r="30" fill="none" stroke="var(--hero-bg)" stroke-width="10"/>
    <path d="m138 170 26 26" stroke="var(--hero-bg)" stroke-width="12" stroke-linecap="round"/>
    <path d="M82 214h60" stroke="var(--hero-accent-line)" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>`;

// H4: شريط الأرقام الثلاثة انتقل إلى صفحة التصفح. «تفاصيل الخدمات» و«مؤشرات المكتب» صفّا روابط هادئان
// بعرض كامل بعد «خصوصيتك أولاً» وقبل التذييل
// H19: زرّان رئيسيان فقط («أضعتُ غرضاً» و«وجدتُ غرضاً»)؛ التصفح والخدمات تحتهما في صفوف الروابط
export function vHome(){
  const o = curOffice();
  return `<div class="wrap home" data-view="home">
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
        ${officeLine(o)}
      </div>
      ${TAG_ART}
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

// H26: سطر معلومات المكتب تحت البحث: المكان · ساعات العمل · الهاتف (كل عنصر فقط إن كانت بياناته موجودة)
function officeLine(o){
  const parts = [oPlace(o) && `<span>${icon('pin')}${esc(oPlace(o))}</span>`, oHours(o) && `<span>${icon('clock')}${esc(oHours(o))}</span>`,
    o?.phone && `<span>${icon('phone')}<a href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ''))}" dir="ltr">${esc(o.phone)}</a></span>`].filter(Boolean);
  return parts.length ? `<p class="hh-info" aria-label="${t('home.officeInfo')}">${parts.join('<span class="dot" aria-hidden="true">·</span>')}</p>` : '';
}
// H26: صف مضغوط في «أحدث المفقودات» (أيقونة التصنيف + العنوان + سطر صغير)، زرّ يفتح الغرض أو طلب الوصف
const miniRow = ({act, ic, title, sub, ref = ''}) => `<li><button class="mini-row" ${act}><span class="mr-ic">${icon(ic)}</span>
  <span class="grow"><b>${esc(title)}</b><small>${ref ? `<span class="ref">${esc(ref)}</span> ` : ''}${sub}</small></span>${icon('fwd')}</button></li>`;
export function updateHome(){
  const o = curOffice(); if (!o) return;
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
   الأعمدة: الهوية (الشعار، والوصف، ورمز QR للمكتب) · «روابط مهمة» · «الدعم والمساعدة» · «تواصل معنا» (المكان والأوقات والهاتف)
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
        <ul class="sf-links">${fLink('office', t('foot.officeFaq'))}${fLink('privacy', t('foot.legal'))}${fLink('a11y', t('foot.a11y'))}</ul>
      </nav>
      <div class="sf-col sf-contact">
        <h2 class="sf-h">${t('foot.officeGroup')}</h2>
        <ul class="sf-info">
          <li>${icon('pin')}<span>${esc(oPlace(o) || oName(o))}</span></li>
          ${oHours(o) ? `<li>${icon('clock')}<span>${esc(oHours(o))}</span></li>` : ''}
          ${o.phone ? `<li>${icon('phone')}<span dir="ltr">${esc(o.phone)}</span></li>` : ''}
        </ul>
      </div>
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
      <div class="section-title">${icon('building')}${t('found.where')}</div>
      <dl class="facts">
        <dt>${t('found.office')}</dt><dd>${esc(oPlace(o) || oName(o))}</dd>
        ${oHours(o) ? `<dt>${t('found.hours')}</dt><dd>${esc(oHours(o))}</dd>` : ''}
        ${o.phone ? `<dt>${t('found.contact')}</dt><dd><span dir="ltr">${esc(o.phone)}</span><button class="link" data-act="copy" data-v="${esc(o.phone)}">${icon('copy')}${t('c.copy')}</button></dd>` : ''}
      </dl>
    </div>
    <div class="panel handin-cta">
      <div class="section-title">${icon('bell')}${t('hi.ctaTitle')}</div>
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
