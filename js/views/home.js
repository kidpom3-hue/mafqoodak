// الصفحة الرئيسية للمكان المختار + صفحة «وجدت غرضاً»
import { icon, LOGO, CATS, otype } from '../constants.js';
import { $, esc, daysWord } from '../utils.js';
import { S, curOffice } from '../state.js';
import { card } from './visitor.js';
import { hydrate } from '../ui.js';

/* أسئلة شائعة — عدّلها كما تريد */
const FAQ = [
  ['كيف أعرف أن غرضي وصل إلى مكتب المفقودات؟', 'كل ما يُسلَّم للمكتب يُسجَّل هنا مع تصنيفه ولونه ومكان العثور عليه. ابحث عنه بكلمة أو تصفّح حسب التصنيف. إن لم تجده، سجّل بلاغاً وسننبّهك عند تسجيل غرض مشابه.'],
  ['كيف أستلم غرضي؟', 'اضغط «هذا غرضي» واكتب تفاصيل لا تظهر في الإعلان. بعد أن يراجعها موظف المكتب ويقبل طلبك، يظهر لك رمز من 6 أرقام في «طلباتي» تقدّمه عند الاستلام.'],
  ['لماذا لا تظهر كل تفاصيل الغرض؟', 'نُخفي بعض التفاصيل عمداً حتى لا يدّعي أحد ملكية غرض ليس له. هذه التفاصيل هي ما تثبت به أنك صاحبه.'],
  ['وجدت غرضاً، ماذا أفعل؟', 'سلّمه لمكتب المفقودات مباشرة، ولا تحتفظ به أو تنشر صوره. الموظف يسجّله ليظهر لصاحبه هنا.'],
  ['كم يُحفظ الغرض في المكتب؟', 'مدة الحفظ مذكورة في صفحة «المكتب». بعد انتهائها يتصرّف المكتب فيه وفق أنظمة المنشأة.'],
  ['هل بياناتي ظاهرة للآخرين؟', 'لا. بلاغاتك وطلباتك لا يراها إلا أنت وموظف المكتب، وصور البطاقات والوثائق الشخصية لا تُنشر أبداً.'],
];

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

export function vHome(){
  const o = curOffice();
  return `<div class="wrap home" data-view="home">
    <section class="hero-home">
      <div class="hh-text">
        <span class="hh-kicker">${icon(otype(o.type).icon)}${esc(otype(o.type).name)} · ${esc(o.city || '')}</span>
        <h1>فقدت شيئاً في <span class="hl">${esc(o.name)}</span>؟</h1>
        <p>كل ما يُسلَّم لمكتب المفقودات يُسجَّل هنا. ابحث عن غرضك، أو بلّغ عنه، واستلمه برمز تحقق.</p>
        <form class="hero-search" data-form="homeSearch" role="search">
          ${icon('search')}<input id="hq" name="q" type="search" placeholder="مثال: محفظة بنية، سماعات، مفتاح" autocomplete="off" aria-label="ابحث في المفقودات">
          <button class="btn" type="submit">ابحث</button>
        </form>
      </div>
      ${TAG_ART}
      <div class="cta3">
        <button class="cta" data-act="nav" data-r="report"><span class="ci">${icon('bell')}</span><span><b>فقدت غرضاً</b><small>سجّل بلاغاً وننبّهك عند العثور عليه</small></span></button>
        <button class="cta" data-act="nav" data-r="found"><span class="ci">${icon('tag')}</span><span><b>وجدت غرضاً</b><small>اعرف كيف تسلّمه لصاحبه</small></span></button>
        <button class="cta" data-act="nav" data-r="browse"><span class="ci">${icon('grid')}</span><span><b>تصفّح المفقودات</b><small id="cta-count">كل ما سُلّم للمكتب</small></span></button>
      </div>
    </section>

    <section class="stats-band" id="home-stats" aria-label="أرقام المكتب"></section>

    <section class="home-sec">
      <div class="sec-head"><h2>أحدث المفقودات</h2><button class="link" data-act="nav" data-r="browse">عرض الكل ${icon('fwd')}</button></div>
      <div id="home-latest"></div>
    </section>

    <section class="home-sec">
      <div class="sec-head"><h2>تصفّح حسب التصنيف</h2></div>
      <div class="cat-tiles" id="home-cats"></div>
    </section>

    <section class="home-sec">
      <div class="sec-head"><h2>كيف يعمل مفقودك؟</h2></div>
      <ol class="how how3">
        <li><b>ابحث أو بلّغ</b><span>ابحث في المفقودات المسجّلة، أو سجّل بلاغاً بوصف غرضك ليقارنه التطبيق بكل ما يُسلَّم.</span></li>
        <li><b>أثبت ملكيتك</b><span>اضغط «هذا غرضي» واكتب تفاصيل لا يعرفها غير صاحبه، ويراجعها موظف المكتب.</span></li>
        <li><b>استلم برمز التحقق</b><span>عند القبول يظهر لك رمز من 6 أرقام تقدّمه في المكتب وتستلم غرضك.</span></li>
      </ol>
    </section>

    <section class="home-sec">
      <div class="sec-head"><h2>خصوصيتك أولاً</h2></div>
      <div class="features">
        <div class="feat">${icon('lock')}<b>بياناتك لا تظهر للآخرين</b><span>بلاغاتك وطلباتك يراها موظف المكتب فقط.</span></div>
        <div class="feat">${icon('idcard')}<b>الوثائق بلا صور</b><span>البطاقات والهويات لا تُصوَّر ولا تُنشر تفاصيلها.</span></div>
        <div class="feat">${icon('shield')}<b>تسليم برمز تحقق</b><span>رمز الاستلام لا يعرفه أحد غيرك.</span></div>
        <div class="feat">${icon('spark')}<b>مطابقة تلقائية</b><span>نقارن بلاغك بكل غرض جديد وننبّهك عند التشابه.</span></div>
      </div>
    </section>

    <section class="home-sec">
      <div class="sec-head"><h2>أسئلة شائعة</h2></div>
      <div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}${icon('chev')}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    </section>

    ${footer(o)}
  </div>`;
}

export function updateHome(){
  const o = curOffice(); if (!o) return;
  const avail = S.items.filter(i => i.status === 'available' || i.status === 'reserved');
  const returned = S.items.filter(i => i.status === 'returned').length;
  const st = $('#home-stats');
  if (st) st.innerHTML = !S.itemsLoaded ? '' : `
    <div><b>${avail.length}</b><span>متاح للاستلام</span></div>
    <div><b>${returned}</b><span>أُعيد لأصحابه</span></div>
    <div><b>${o.retentionDays || 90}</b><span>يوماً مدة الحفظ</span></div>`;
  const cc = $('#cta-count'); if (cc && S.itemsLoaded) cc.textContent = avail.length ? `${avail.length} متاح الآن` : 'كل ما سُلّم للمكتب';
  const latest = $('#home-latest');
  if (latest){
    if (!S.itemsLoaded) latest.innerHTML = `<div class="loading" style="padding:30px"><span class="spin"></span></div>`;
    else {
      const arr = avail.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
      latest.innerHTML = arr.length ? `<div class="hscroll">${arr.map(card).join('')}</div>`
        : `<div class="empty">${icon('box')}<b>لا توجد مفقودات مسجّلة حالياً</b><span>عندما يسجّل المكتب غرضاً سيظهر هنا.</span></div>`;
    }
  }
  const cats = $('#home-cats');
  if (cats) cats.innerHTML = CATS.map(c => {
    const n = avail.filter(i => i.cat === c.id).length;
    return `<button class="cat-tile" data-act="catGo" data-id="${c.id}">${icon(c.icon)}<b>${esc(c.name)}</b><span>${n ? `${n} متاح` : 'لا يوجد'}</span></button>`;
  }).join('');
  hydrate();
}

function footer(o){
  return `<footer class="site-foot">
    <div class="sf-brand">${LOGO}<b>مفقودك</b><p>منصة مكاتب المفقودات: يسجّل المكتب ما يُعثر عليه، ويجد صاحبه طريقه إليه بأمان.</p></div>
    <div class="sf-col"><b>${esc(o.name)}</b>
      <span>${icon('pin')}${esc(o.place || '')}</span>
      ${o.hours ? `<span>${icon('clock')}${esc(o.hours)}</span>` : ''}
      ${o.phone ? `<span>${icon('phone')}<span dir="ltr">${esc(o.phone)}</span></span>` : ''}
    </div>
    <div class="sf-col"><b>روابط</b>
      <button class="link" data-act="nav" data-r="browse">تصفّح المفقودات</button>
      <button class="link" data-act="nav" data-r="report">سجّل بلاغ مفقود</button>
      <button class="link" data-act="nav" data-r="found">وجدت غرضاً</button>
      <button class="link" data-act="nav" data-r="office">عن المكتب</button>
    </div>
    <small class="sf-copy">© ${new Date().getFullYear()} مفقودك</small>
  </footer>`;
}

export function vFound(){
  const o = curOffice();
  return `<div class="wrap" data-view="found">
    <section class="hero"><div class="hero-kicker">${icon('tag')}وجدت غرضاً</div>
      <h1 class="hero-title">شكراً لأمانتك</h1>
      <p class="hero-sub">سلّم الغرض لمكتب المفقودات، ونحن نوصله لصاحبه.</p></section>
    <ol class="how how3">
      <li><b>لا تحتفظ به</b><span>سلّمه في نفس اليوم إن استطعت؛ صاحبه يبحث عنه الآن غالباً.</span></li>
      <li><b>سلّمه لمكتب المفقودات</b><span>أخبر الموظف أين وجدته ومتى، فهذه المعلومات تساعد صاحبه على إثبات ملكيته.</span></li>
      <li><b>يُسجَّل ويظهر لصاحبه</b><span>يسجّله الموظف هنا، ويصل تنبيه لمن سجّل بلاغاً عن غرض مشابه.</span></li>
    </ol>
    <div class="panel">
      <div class="section-title">${icon('building')}أين تسلّمه؟</div>
      <dl class="facts">
        <dt>المكتب</dt><dd>${esc(o.place || o.name)}</dd>
        ${o.hours ? `<dt>أوقات العمل</dt><dd>${esc(o.hours)}</dd>` : ''}
        ${o.phone ? `<dt>التواصل</dt><dd><span dir="ltr">${esc(o.phone)}</span><button class="link" data-act="copy" data-v="${esc(o.phone)}">${icon('copy')}نسخ</button></dd>` : ''}
      </dl>
    </div>
    <div class="note warn">${icon('idcard')}<span>إذا كان الغرض بطاقة أو وثيقة شخصية فلا تصوّرها ولا تنشر بياناتها؛ سلّمها كما هي.</span></div>
    <div class="note">${icon('shield')}<span>هل أنت موظف في المكتب؟ سجّل الغرض من وضع «موظف المكتب» ← «أضف غرضاً».</span></div>
  </div>`;
}
