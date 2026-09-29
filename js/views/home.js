// الصفحة الرئيسية للمكان المختار + صفحة «وجدت غرضاً»
import { icon, LOGO, otype, otypeName, oName, oPlace, oHours, oCity } from '../constants.js';
import { $, esc, today } from '../utils.js';
import { t, tp } from '../i18n.js';
import { S, curOffice } from '../state.js';
import { card, skelCards } from './visitor.js';
import { backBtn, catPicker, spotOptions, spotExtra, loginPrompt, verifyPrompt } from './common.js';
import { qrSvg } from '../qr.js';
import { officeUrl } from './print.js';
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
export function vHome(){
  const o = curOffice();
  return `<div class="wrap home" data-view="home">
    <section class="hero-home">
      <div class="hh-text">
        <span class="hh-kicker">${icon(otype(o.type).icon)}${esc(otypeName(o.type))}${oCity(o) ? ' · ' + esc(oCity(o)) : ''}</span>
        <h1>${t('home.lostIn', {name: esc(oName(o))})}</h1>
        <p>${t('home.lead')}</p>
        <form class="hero-search" data-form="homeSearch" role="search">
          ${icon('search')}<input id="hq" name="q" type="search" placeholder="${t('home.searchPh')}" autocomplete="off" aria-label="${t('home.searchAria')}">
          <button class="btn" type="submit">${t('home.search')}</button>
        </form>
      </div>
      ${TAG_ART}
      <div class="cta3">
        <button class="cta" data-act="nav" data-r="report"><span class="ci">${icon('bell')}</span><span><b>${t('home.ctaLost')}</b><small>${t('home.ctaLostSub')}</small></span></button>
        <button class="cta" data-act="nav" data-r="found"><span class="ci">${icon('tag')}</span><span><b>${t('home.ctaFound')}</b><small>${t('home.ctaFoundSub')}</small></span></button>
        <button class="cta" data-act="nav" data-r="browse"><span class="ci">${icon('grid')}</span><span><b>${t('home.ctaBrowse')}</b><small id="cta-count">${t('home.ctaBrowseSub')}</small></span></button>
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
      <div class="sec-head sec-sub"><h2>${t('ofc.privacy')}</h2><p>${t('home.privacySub')}</p></div>
      <div class="features compact">
        <div class="feat">${icon('lock')}<b>${t('ofc.f1')}</b><span>${t('ofc.f1d')}</span></div>
        <div class="feat">${icon('idcard')}<b>${t('ofc.f2')}</b><span>${t('ofc.f2d')}</span></div>
        <div class="feat">${icon('shield')}<b>${t('ofc.f3')}</b><span>${t('ofc.f3d')}</span></div>
        <div class="feat">${icon('spark')}<b>${t('ofc.f4')}</b><span>${t('ofc.f4d')}</span></div>
      </div>
    </section>

    <nav class="link-rows" aria-label="${t('home.moreAria')}">
      <button class="link-row" data-act="nav" data-r="service"><span class="lr-ic">${icon('grid')}</span><span class="grow"><b>${t('svc.details')}</b><small>${t('home.svcDesc')}</small></span>${icon('fwd')}</button>
      <button class="link-row" data-act="nav" data-r="numbers"><span class="lr-ic">${icon('chart')}</span><span class="grow"><b>${t('num.title')}</b><small>${t('home.numDesc')}</small></span>${icon('fwd')}</button>
    </nav>

    ${footer(o)}
  </div>`;
}

export function updateHome(){
  const o = curOffice(); if (!o) return;
  const avail = S.items.filter(i => i.status === 'available' || i.status === 'reserved');
  const cc = $('#cta-count'); if (cc && S.itemsLoaded) cc.textContent = avail.length ? t('home.availNow', {items: tp('n.item', avail.length)}) : t('home.ctaBrowseSub');
  const latest = $('#home-latest');
  if (latest){
    if (!S.itemsLoaded) latest.innerHTML = `<div class="hscroll" aria-busy="true" aria-label="${t('c.loading')}">${skelCards()}</div>`;
    else {
      const arr = avail.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
      latest.innerHTML = arr.length ? `<div class="hscroll">${arr.map(card).join('')}</div>`
        : `<div class="empty">${icon('box')}<b>${t('home.empty')}</b><span>${t('home.emptySub')}</span></div>`;
    }
  }
  hydrate();
}

/* التذييل (H4): شريط بعرض الصفحة بالأخضر الداكن نفسه لبطاقة الرئيسية (--hero-bg) ونص أبيض.
   الهوية (الشعار، ووصف سطر واحد، ورمز QR صغير للمكتب بخلفية بيضاء) · مجموعة «المكتب» (روابطه ومكانه وأوقاته وهاتفه)
   · شريط أخير: «© السنة مفقودك» وتحته «الخصوصية والشروط | إمكانية الوصول». بلا أي شعار حكومي أو شعار للمؤسسة.
   المظهر وحجم الخط انتقلا إلى زر «Aa» في الشريط العلوي، واللغة إلى زرها هناك */
function footer(o){
  return `<footer class="site-foot">
    <div class="sf-top">
      <div class="sf-brand">
        <div class="sf-id">${LOGO}<b>${t('app.name')}</b></div>
        <p>${t('foot.tagline')}</p>
        <div class="sf-qr">${qrSvg(officeUrl(o), {label: t('po.qrAria')})}<small>${t('foot.qr')}</small></div>
      </div>
      <nav class="sf-col" aria-labelledby="sf-office">
        <h2 class="sf-h" id="sf-office">${t('foot.officeGroup')}</h2>
        <div class="sf-links">
          <button class="link" data-act="nav" data-r="office">${t('foot.office')}</button>
          <button class="link" data-act="nav" data-r="service">${t('foot.services')}</button>
        </div>
        <ul class="sf-info">
          <li>${icon('pin')}<span>${esc(oPlace(o) || oName(o))}</span></li>
          ${oHours(o) ? `<li>${icon('clock')}<span>${esc(oHours(o))}</span></li>` : ''}
          ${o.phone ? `<li>${icon('phone')}<span dir="ltr">${esc(o.phone)}</span></li>` : ''}
        </ul>
      </nav>
    </div>
    <div class="sf-bottom">
      <small class="sf-copy">© ${today().slice(0, 4)} ${t('app.name')}</small>
      <div class="sf-legal"><button class="link" data-act="nav" data-r="privacy">${t('foot.legal')}</button><span aria-hidden="true">|</span><button class="link" data-act="nav" data-r="a11y">${t('foot.a11y')}</button></div>
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
  if (!S.uid) return `<div class="wrap">${backBtn()}${loginPrompt(t('hi.login'))}</div>`;
  if (!S.verified) return `<div class="wrap">${backBtn()}${verifyPrompt(t('hi.verifyWhat'))}</div>`;
  return `<div class="wrap" data-view="handin">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('tag')}${t('hi.kicker', {office: esc(oName(o))})}</div><h1 class="hero-title">${t('hi.title')}</h1>
      <p class="hero-sub">${t('hi.sub')}</p></section>
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
