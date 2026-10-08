// هيكل الواجهة: التنقل بين الصفحات، الشريط العلوي، الشريط السفلي، النوافذ المنبثقة
import { icon, LOGO, statusLabel, MODE_LABEL, brandOf } from './constants.js';
import { t } from './i18n.js';
import { $, $$, esc, toast } from './utils.js';
import { S, curOffice, modes, homeRoute, unseenCount, staffNew, getPhoto, getName, getEmail, SHARE_RE, OFFICE_RE, singleMode, STAFF_TABS, TAB_RE } from './state.js';
import { vPick, vBrowse, updateBrowse, vItem, vClaimForm, vReportForm, vMine, vOffice } from './views/visitor.js';
import { vLogin, vSetup, vNotConfigured } from './views/auth.js';
import { vHome, updateHome, vFound, vHandin, footer, fillFootQr } from './views/home.js';
import { vPrivacy } from './views/privacy.js';
import { tabNum, brandLogo, feedbackBox, fbKey } from './views/common.js';   // H6: كل شارة رقمية تمرّ بها (رقم واحد: أحمر للجديد أو رمادي للعدد)
// H8: صفحات الموظف والإدارة والإحصاءات والسجل والطباعة والخدمات تُحمَّل عند أول فتح لها فقط (lazy.js)
import { need, load, loadingHtml, setLazyHooks } from './lazy.js';
import { SETTINGS } from './config.js';
import { cat } from './constants.js';

/* live: تُعاد رسمها عند تغيّر البيانات. النماذج (live:false) لا تُعاد حتى لا يضيع ما كتبه المستخدم */
const ROUTES = {
  pick: {live: true, v: vPick},
  home: {live: true, v: vHome, update: updateHome},
  found: {live: true, v: vFound},
  handin: {live: false, v: vHandin, after: initForm},
  browse: {live: true, v: vBrowse, update: updateBrowse},
  item: {live: true, v: vItem},
  claim: {live: false, v: vClaimForm},
  gclaim: {live: false, v: vClaimForm},   // H11: طلب مجمّع بالوصف ({cat})
  report: {live: false, v: vReportForm, after: initForm},
  mine: {live: true, v: vMine},   // H4: التنبيهات تُقرأ بالنقر على التبويب أو فتح البطاقة، لا بمجرد الدخول
  office: {live: true, v: vOffice},
  // lazy: اسم الوحدة في lazy.js، وv/update/after أسماء الدوال فيها
  staff: {live: true, lazy: 'staff', v: 'vStaff', update: 'updateStaff'},
  add: {live: false, lazy: 'staff', v: 'vItemForm', after: initForm},
  admin: {live: true, lazy: 'admin', v: 'vAdmin'},
  officeForm: {live: false, lazy: 'admin', v: 'vOfficeForm'},
  login: {live: false, v: vLogin},
  setup: {live: false, v: vSetup},
  privacy: {live: false, v: vPrivacy},
  labels: {live: false, lazy: 'print', v: 'vLabels'},
  poster: {live: false, lazy: 'print', v: 'vPoster'},
  stats: {live: true, lazy: 'statsView', v: 'vStats'},
  audit: {live: true, lazy: 'audit', v: 'vAudit'},
  // المرحلة F: بطاقة الخدمة، ومؤشرات المكتب، وبيان إمكانية الوصول، وشهادة الشكر (print.js)
  service: {live: false, lazy: 'gov', v: 'vService'},
  numbers: {live: true, lazy: 'gov', v: 'vNumbers'},
  a11y: {live: false, lazy: 'gov', v: 'vA11y'},
  thanks: {live: false, lazy: 'print', v: 'vThanks', after: 'fillThanks'},
};
/* H8: دوال المسار الفعلية. للمسار الكسول: من وحدته إن كانت محمّلة، وإلا null (يظهر مؤشر التحميل ويبدأ التحميل).
   after قد تكون دالة محلية (initForm) أو اسم دالة في الوحدة */
function routeFns(r){
  if (!r?.lazy) return r;
  const m = need(r.lazy); if (!m) return null;
  const f = k => typeof r[k] === 'string' ? m[r[k]] : r[k];
  return {live: r.live, v: f('v'), update: f('update'), after: f('after')};
}
// بعد وصول الوحدة: نرسم الصفحة إن كانت ما زالت مفتوحة. وعند الفشل (دون اتصال ولم تُحفظ بعد): رسالة ونعود للصفحة الرئيسية للمسار
setLazyHooks(name => { if (ROUTES[S.route.name]?.lazy === name) renderAll(); else renderNav(); },
  () => { toast(t('err.offline')); if (ROUTES[S.route.name]?.lazy) $('#main').innerHTML = `<div class="empty">${icon('info')}<b>${t('err.offline')}</b></div>`; });

export function initForm(){
  const f = $('form[data-form=item],form[data-form=report],form[data-form=handin]'); if (!f) return;
  const c = f.querySelector('input[name=cat]:checked'); const sens = c ? !!cat(c.value).sensitive : false;
  const n = f.querySelector('#sens-note'), p = f.querySelector('#photo-field');
  if (n) n.hidden = !sens; if (p) p.hidden = sens;
  lockEvidence(f);
}
// v14 (H19): غرض مضى على تسجيله 24 ساعة: حقول الأدلة للعرض فقط للموظف (workflow.editItem يبقي قيمها كما سُجّلت)
export function lockEvidence(f){
  if (!f?.dataset.locked) return;
  f.querySelectorAll('[name=color],[name=brand],[name=desc],[name=spot],[name=bldg],[name=room],[name^=d_]').forEach(el => { el.disabled = true; });
}
/* ---------- زر الرجوع في الجوال والمتصفح ----------
   كل صفحة جديدة أو نافذة سفلية تضيف خطوة في سجل المتصفح (pushState).
   زر الرجوع يُطلق popstate فنرجع خطوة داخل التطبيق بدل الخروج منه.
   history.back() غير متزامن، لذلك نؤجّل أي pushState حتى يصل popstate الخاص به. */
let skipPop = 0; const afterPop = [];
function histDo(fn){ if (skipPop) afterPop.push(fn); else fn(); }
// يزيل خطوة النافذة السفلية من السجل دون أن يعدّها رجوعاً لصفحة سابقة
function dropSheetEntry(){ if (history.state?.sheet && !skipPop){ skipPop = 1; history.back(); } }

export function go(name, params = {}, push = true){
  // H23: تبويب لوحة الموظف جزء من الصفحة (params.tab): تغييره خطوة في السجل، فيعيده زر الرجوع
  if (name === 'staff'){ params = {...params, tab: params.tab || S.staffTab}; S.staffTab = params.tab; }
  const pushed = push && (S.route.name !== name || (name === 'staff' && S.route.params?.tab !== params.tab));
  // G6: نحفظ مكان التمرير مع الصفحة الحالية، فيعود إليه الرجوع (بلا قفزة للأعلى بعد السحب للرجوع في الآيفون)
  if (pushed){ S.route.y = window.scrollY; S.hist.push(S.route); }
  if (S.hist.length > 30) S.hist.shift();
  if (S.sheet) dropSheetEntry();
  S.route = {name, params}; S.sheet = null;
  GOING = true; try { renderAll(); } finally { GOING = false; }
  // H23: كل تبويب في اللوحة يعود إلى موضع تمريره السابق (بقية الصفحات من الأعلى)
  if (name === 'staff' && S.tabY[params.tab]) restoreScroll(S.tabY[params.tab]); else window.scrollTo(0, 0);
  if (pushed) histDo(() => { history.pushState({mf: 1}, ''); syncUrl(); }); else syncUrl();
}
// الانتقال من الشريط السفلي لا يحفظ الصفحة في S.hist، لكن نضيف خطوة واحدة في سجل المتصفح
// حتى يعود زر الرجوع إلى الرئيسية بدل الخروج من التطبيق
export function tabEntry(){ histDo(() => { if (!history.state?.mf) history.pushState({mf: 1}, ''); }); }
// خطوة رجوع داخل التطبيق (بلا pushState)
function backStep(){
  const prev = S.hist.pop(); S.sheet = null;
  if (prev){ S.route = prev; if (prev.name === 'staff' && prev.params?.tab) S.staffTab = prev.params.tab; renderAll(); restoreScroll(prev.y || 0); }
  else go(homeRoute(), {}, false);
}
// G6: إعادة التمرير بعد رسم الصفحة السابقة. نعيده في إطار الرسم التالي، ومرة ثانية إن لم تكن الصفحة
// قد اكتملت بعد (أقصر من المكان المحفوظ). الصور الكسولة محجوزة الارتفاع (aspect-ratio) فلا يتغيّر المكان بعد تحميلها
function restoreScroll(y){
  window.scrollTo(0, y);
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) > 1) requestAnimationFrame(() => window.scrollTo(0, y));
  });
}
// زر «رجوع» في الواجهة: نرجع عبر سجل المتصفح ليبقى متطابقاً مع التطبيق
export function back(){
  if (S.sheet){ S.sheet = null; renderSheet(); dropSheetEntry(); }
  histDo(() => { if (history.state?.mf) history.back(); else backStep(); });
}
document.addEventListener('keydown', e => {
  if (!S.sheet) return;
  if (e.key === 'Escape'){ e.preventDefault(); back(); return; }
  if (e.key !== 'Tab') return;
  const p = $('#sheet .sheet-panel'); if (!p) return;
  const f = [...p.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!p.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
// الكيبورد في الجوال يصغّر الجزء الظاهر من الشاشة: نرفع اللوح السفلي بمقداره (--kb) فلا يغطي الحقول
if (window.visualViewport){ const kb = () => document.documentElement.style.setProperty('--kb', Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop) + 'px');
  visualViewport.addEventListener('resize', kb); visualViewport.addEventListener('scroll', kb); }
window.addEventListener('popstate', () => {
  if (skipPop){ skipPop = 0; afterPop.splice(0).forEach(f => f()); return; }
  if (SHARE_RE.test(location.hash.slice(1)) || OFFICE_RE.test(location.hash.slice(1))) return;   // رابط مشاركة أو مكتب: يعالجه مستمع hashchange في main.js
  if (S.sheet){ S.sheet = null; renderSheet(); return; }   // نافذة مفتوحة: نغلقها فقط
  // H23: الرابط بعد الرجوع/التقدم يحدد تبويب اللوحة (زر «التقدم» في المتصفح يصل إلى التبويب الصحيح أيضاً)
  const urlTab = (TAB_RE.test(location.hash.slice(1)) && Object.keys(STAFF_TABS).find(k => '#/office/' + STAFF_TABS[k] === location.hash)) || '';
  backStep();
  if (urlTab && !(S.route.name === 'staff' && S.staffTab === urlTab)){ S.staffTab = urlTab; S.route = {name: 'staff', params: {tab: urlTab}}; renderAll(); }
});
export function renderAll(){ renderHeader(); renderMain(); renderNav(); renderSheet(); hydrate(); if (!GOING) syncUrl(); }
// H23: داخل go() يُكتب الرابط بعد pushState (وإلا كُتب التبويب الجديد على الخطوة السابقة في السجل)
let GOING = false;
/* H23: الرابط يتبع الصفحة: في لوحة الموظف #/office/<التبويب>، وفي غيرها بلا اختصار (replaceState: لا خطوة جديدة في السجل) */
function syncUrl(){
  const want = S.route.name === 'staff' && S.mode === 'staff' ? '#/office/' + (STAFF_TABS[S.staffTab] || 'warehouse') : '';
  const cur = location.hash;
  if (cur === want || (!want && (SHARE_RE.test(cur.slice(1)) || OFFICE_RE.test(cur.slice(1))))) return;
  if (!want && !TAB_RE.test(cur.slice(1))) return;   // لا نلمس اختصاراً آخر (يعالجه main.js)
  history.replaceState(history.state, '', location.pathname + location.search + want);
}
// H22: انقطاع الاتصال وعودته يغيّران الترويسة فقط (main.js)، فلا يُعاد رسم الصفحة ولا يضيع ما كُتب في نموذج مفتوح
export { renderHeader };

/* ارتفاع الترويسة في متغير CSS ليلتصق شريط البحث تحتها مباشرة، وظل خفيف عند الالتصاق */
/* H13a: ومعه --hdr-vh = ارتفاعها الظاهر فعلاً (بعد zoom حجم الخط) لـ scroll-padding-top في CSS: أي تمرير إلى عنصر
   (التركيز، فتح بطاقة من «يحتاج انتباهك»، خطأ في نموذج) يُبقيه تحت الترويسة الملتصقة لا خلفها.
   ويُحدَّث كلما تغيّر ارتفاعها (شريط «وثّق بريدك»، تغيير اللغة أو حجم الخط، تدوير الشاشة) عبر ResizeObserver */
let hdrObs = null;
function syncHeader(){
  const h = $('#hdr'); if (!h) return;
  const root = document.documentElement.style;
  root.setProperty('--hdr-h', h.offsetHeight + 'px');
  root.setProperty('--hdr-vh', Math.ceil(h.getBoundingClientRect().height) + 'px');
  if (!hdrObs && 'ResizeObserver' in window){ hdrObs = new ResizeObserver(() => syncHeader()); hdrObs.observe(h); }
}
function markStuck(){
  const bar = $('#browse-bar'); if (!bar) return;
  const top = parseFloat(getComputedStyle(bar).top) || 0;
  bar.classList.toggle('stuck', bar.getBoundingClientRect().top <= top + 1 && window.scrollY > 0);
}
window.addEventListener('resize', syncHeader);
window.addEventListener('scroll', markStuck, {passive: true});
export function refresh(){
  // H4: إن أعاد الرسم بناء العنصر الذي عليه التركيز (مثل تبويب بعد الأسهم) نعيد التركيز إليه بمعرّفه
  const fid = document.activeElement?.id;
  renderHeader();
  const r = routeFns(ROUTES[S.route.name]);
  const main = $('#main');
  if (r?.update && main.firstElementChild?.dataset.view === S.route.name) r.update();
  else if (r?.live || (!r && ROUTES[S.route.name])) renderMain();
  renderNav(); hydrate();
  if (fid && (document.activeElement === document.body || !document.activeElement)) document.getElementById(fid)?.focus({preventScroll: true});
}
function renderMain(){
  const main = $('#main');
  if (!S.configured){ main.innerHTML = vNotConfigured(); return; }
  if (!S.authReady || !S.configLoaded || !S.officesLoaded){ main.innerHTML = `<div class="loading"><span class="spin"></span></div>`; return; }
  if (S.route.name === 'login' && S.uid) S.route = S.route.params.next || {name: homeRoute(), params: {}};
  if (!S.config){ main.innerHTML = S.route.name === 'login' ? vLogin() : S.route.name === 'privacy' ? vPrivacy() : vSetup(); return; }
  // لا مكان مختار (أو لم يصل بعد من قاعدة البيانات): نعرض قائمة الأماكن دون تغيير الصفحة المطلوبة
  // H19: وضع المكتب الواحد: صفحة اختيار المكان لا تظهر للزائر
  if (S.route.name === 'pick' && singleMode() && curOffice()) S.route = {name: homeRoute(), params: {}};
  if (!curOffice() && !['pick', 'admin', 'officeForm', 'audit', 'login', 'privacy', 'a11y'].includes(S.route.name)){ main.innerHTML = vPick(); return; }
  const r = routeFns(ROUTES[S.route.name] || ROUTES.home);
  if (!r){ main.innerHTML = loadingHtml(); return; }   // H8: الوحدة في الطريق
  main.innerHTML = r.v();
  decorate(main);
  // H23: سطر التاريخ المقروء («15 أكتوبر 2026») تحت كل حقل تاريخ من البداية (checkDate في actions.js يستمع لـ change)
  main.querySelectorAll('input[type=date]').forEach(el => el.dispatchEvent(new Event('change', {bubbles: true})));
  if (r.update) r.update();
  if (r.after) r.after();
}
/* H24: مسار التنقل (أعلى الصفحة) والتذييل (أسفلها) في صفحات الزائر فقط، بأسلوب المنصات الحكومية.
   يُضافان داخل أول عنصر في #main (العنصر ذو data-view يبقى أولاً لأن دوال update تبحث عنه) */
const VISITOR_PAGES = ['found', 'handin', 'browse', 'item', 'claim', 'gclaim', 'report', 'mine', 'office', 'privacy', 'service', 'numbers', 'a11y', 'login'];
// خطوة المسار: [النص، المسار، params] — الأخيرة هي الصفحة الحالية (بلا رابط)
function trail(){
  const {name, params: p = {}} = S.route;
  const browse = [t('nav.browse'), 'browse'], svc = [t('svc.details'), 'service'], found = [t('term.handin'), 'found'];
  const cur = {
    found: [t('term.handin')], handin: [found, t('hi.title')], browse: [t('nav.browse')],
    item: [browse, t('bc.item')], claim: [browse, t('cl.title')], gclaim: [browse, t('cl.title')],
    report: [svc, t('rp.title')], mine: [t('nav.mine')], office: [t('foot.office')], privacy: [t('foot.legal')],
    service: ['claim', 'report', 'handin'].includes(p.id) ? [svc, t('svc.' + p.id + '.name')] : [t('svc.details')], numbers: [t('num.title')], a11y: [t('foot.a11y')], login: [t('login.titleIn')],
  }[name];
  return cur ? [[t('nav.home'), homeRoute()], ...cur] : null;
}
function crumbs(){
  const tr = trail(); if (!tr) return '';
  return `<nav class="crumbs" aria-label="${t('bc.aria')}"><ol>${tr.map(x => typeof x === 'string'
    ? `<li><span aria-current="page">${x}</span></li>`
    : `<li><button class="link" data-act="nav" data-r="${x[1]}">${x[0]}</button></li>`).join('')}</ol></nav>`;
}
// H25: «هل كانت هذه الصفحة مفيدة؟» قبل التذييل في كل صفحات الزائر، وفي الرئيسية (تذييلها في صفحتها) قبل تذييلها
function decorate(main){
  const o = curOffice(), box = main.firstElementChild;
  if (!o || !box || ['staff', 'admin'].includes(S.mode)) return;
  if (S.route.name === 'home'){ box.querySelector(':scope > .site-foot')?.insertAdjacentHTML('beforebegin', feedbackBox(o, 'home')); return; }
  if (!VISITOR_PAGES.includes(S.route.name)) return;
  box.insertAdjacentHTML('afterbegin', crumbs());
  box.insertAdjacentHTML('beforeend', feedbackBox(o, fbKey()) + footer(o));
  fillFootQr();
}
function renderHeader(){
  const o = curOffice(); const ms = S.config ? modes() : ['visitor'];
  const acct = !S.configured || !S.authReady ? ''
    : S.uid ? `<button class="avatar-btn" data-keep="acct" data-act="account" aria-label="${t('ui.account')}">${safeAvatar(S.me?.photo) ? `<img src="${esc(S.me.photo)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc((S.me?.name || '?').trim().charAt(0))}</span>`}</button>`
    // H3: تحت 400px يصبح زر الدخول أيقونة فقط (النص مخفي بصرياً ويبقى اسمه في aria-label)، فيتسع اسم المكتب
    : `<button class="btn sm ghost login-btn" data-act="login" aria-label="${t('ui.signIn')}">${icon('users')}<span class="login-txt">${t('ui.signIn')}</span></button>`;
  // زر اللغة: يعرض اللغة الأخرى («EN» في العربية، «عربي» في الإنجليزية)
  const langBtn = `<button class="lang-btn" data-act="lang" lang="${t('lang.otherCode')}" aria-label="${t('lang.switch')}"><span class="lang-txt">${t('lang.other')}</span>${icon('globe')}</button>`;
  // H4: «Aa» يفتح نافذة العرض (المظهر وحجم الخط)
  const aaBtn = `<button class="aa-btn" data-act="displaySheet" aria-label="${t('ui.display')}"><span aria-hidden="true">Aa</span></button>`;
  // H15: هوية الكلية (ألوانها وشعارها) في مكتبها فقط، وليس في لوحة الإدارة التي تدير كل المواقع
  const bo = S.mode !== 'admin' ? o : null;
  applyBrand(bo);
  // H23: في صفحة لوحة الموظف لا تكرر الترويسة تبويباتها (المستودع/الاستلام/البلاغات)؛ تظهر في غيرها للعودة إليها
  // H5: الترتيب: الشعار + «مفقودك» | Aa | اللغة | الحساب. أُزيل زر اسم المكتب (تغيير المكان في صفحة المكتب)
  // H15: بجانب «مفقودك» نجمة شعار المؤسسة بعد خط فاصل (تظهر في كل المقاسات؛ الشعار الكامل في الواجهة الرئيسية)
  setHeader($('#hdr'), `<div class="top-row">
      <div class="brand-wrap" data-keep="brand"><button class="brand" data-act="nav" data-r="${homeRoute()}" aria-label="${t('app.name')} — ${t('nav.home')}">${LOGO}<span class="wordmark">${t('app.name')}</span></button>${brandLogo(bo, 'light', 'hdr-logo', 'mark')}</div>
      ${S.config && (o || S.mode === 'admin') ? `<nav class="top-links" aria-label="${t('ui.navigation')}">${navItems().filter(n => !(n.r === 'staff' && n.tab && S.route.name === 'staff')).map(n => {
        const on = S.route.name === n.r && (!n.tab || (n.r === 'staff' ? S.staffTab : S.adminTab) === n.tab);
        return `<button class="${on ? 'on' : ''}" data-act="nav" data-r="${n.r}" data-tab="${n.tab || ''}">${n.l}${tabNum(n.b, 0)}</button>`;
      }).join('')}</nav>` : ''}
      <div class="top-actions">
        ${aaBtn}${langBtn}${acct}
      </div>
    </div>
    ${S.uid && !S.verified ? `<div class="verify-bar" role="status">${icon('lock')}<span>${t('ui.verifyBar')} ${t('ui.verifyStaff')}</span>
      <button class="btn sm" data-act="checkVerified">${t('c.verified')}</button><button class="btn sm ghost" data-act="resendVerify">${t('ui.resend')}</button></div>` : ''}
    ${navigator.onLine === false ? `<div class="verify-bar net-bar" role="status">${icon('wifiOff')}<span>${t('net.offline')}</span></div>` : ''}
    ${ms.length > 1 ? `<div class="seg modes" role="tablist" aria-label="${t('ui.viewMode')}">${ms.map(m => `<button class="${S.mode === m ? 'on' : ''}" data-act="mode" data-v="${m}" role="tab" aria-selected="${S.mode === m}">${statusLabel(MODE_LABEL[m])}</button>`).join('')}</div>` : ''}`);
  syncHeader();
}
/* H21: innerHTML كان يعيد بناء الترويسة مع كل رسم فيُنشأ شعار الكلية من جديد ويومض. العناصر data-keep تبقى ما دامت لم تتغير */
function setHeader(h, html){
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  // importNode: نقل الصورة القديمة إلى محتوى <template> (مستند آخر) يعيد تحميلها
  const frag = document.importNode(tpl.content, true);
  for (const n of frag.querySelectorAll('[data-keep]')){
    const o = h.querySelector(`[data-keep="${n.dataset.keep}"]`);
    if (o && o.isEqualNode(n)) n.replaceWith(o);
  }
  h.replaceChildren(frag);
}
const BRAND_IMGS = new Map();
function preloadBrand(b){
  for (const src of [b.logo, b.logoWhite, b.mark, b.markWhite].filter(Boolean)){
    if (BRAND_IMGS.has(src)) continue;
    const im = new Image(); im.src = src; im.decode?.().catch(() => {}); BRAND_IMGS.set(src, im);
  }
}
/* H15: data-brand على <html> يبدّل ألوان CSS إلى ألوان المؤسسة، ولون شريط المتصفح (theme-color) معها */
function applyBrand(o){
  const b = brandOf(o), h = document.documentElement;
  if (b) preloadBrand(b);
  if ((h.dataset.brand || '') === (b?.id || '')) return;
  if (b) h.dataset.brand = b.id; else delete h.dataset.brand;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = b?.themeColor || '#14573A';   // '#14573A' = لون مفقودك في index.html (H24)
}
function navItems(){
  if (S.mode === 'staff'){
    // H5: شارتا «الاستلام» و«البلاغات» = عدد الجديد غير المقروء فقط، و0 والموظف داخل الصفحة نفسها (كـ«طلباتي» للزائر)
    const here = tab => S.route.name === 'staff' && S.staffTab === tab;
    const inbox = here('claims') ? 0 : staffNew('claims'), open = here('reports') ? 0 : staffNew('reports');
    return [
      {r: 'staff', tab: 'items', l: t('nav.store'), i: 'box'},
      {r: 'add', l: t('nav.add'), i: 'plus'},
      {r: 'staff', tab: 'claims', l: t('nav.claims'), i: 'inbox', b: inbox},
      {r: 'staff', tab: 'reports', l: t('nav.reports'), i: 'bell', b: open},
    ];
  }
  if (S.mode === 'admin'){
    return [
      {r: 'admin', tab: 'overview', l: t('nav.overview'), i: 'grid'},
      {r: 'admin', tab: 'offices', l: t('nav.offices'), i: 'pin'},
      {r: 'admin', tab: 'people', l: t('nav.people'), i: 'users'},
    ];
  }
  return [
    {r: 'home', l: t('nav.home'), i: 'building'},
    {r: 'browse', l: t('nav.browse'), i: 'search'},
    {r: 'report', l: t('nav.report'), i: 'plus'},
    {r: 'mine', l: t('nav.mine'), i: 'inbox', b: S.route.name === 'mine' ? 0 : unseenCount()},
    {r: 'office', l: t('nav.office'), i: 'info'},
  ];
}
function renderNav(){
  const nav = $('#nav');
  if (!S.configured || !S.config || (!curOffice() && S.mode !== 'admin') || ['login', 'setup'].includes(S.route.name)){ nav.hidden = true; return; }
  nav.hidden = false;
  const cur = S.route.name;
  nav.innerHTML = `<div class="inner">${navItems().map(n => {
    const on = cur === n.r && (!n.tab || (n.r === 'staff' ? S.staffTab : S.adminTab) === n.tab);
    return `<button class="${on ? 'on' : ''}" data-act="nav" data-r="${n.r}" data-tab="${n.tab || ''}" ${on ? 'aria-current="page"' : ''}>${icon(n.i)}<span>${n.l}</span>${tabNum(n.b, 0)}</button>`;
  }).join('')}</div>`;
}
/* H23: النافذة: في الكمبيوتر وسط الشاشة (عرض 560 وارتفاع 90vh وتمرير داخلي)، وفي الجوال لوح سفلي بمقبض.
   الخلفية لا تتمرر، وEsc يغلقها، والتركيز لا يخرج منها (Tab)، والكيبورد لا يغطيها (visualViewport)، ويعود التركيز بعد الإغلاق */
let sheetFrom = null;
export function renderSheet(){
  const el = $('#sheet');
  document.documentElement.classList.toggle('sheet-open', !!S.sheet);
  if (!S.sheet){ el.hidden = true; el.innerHTML = ''; if (sheetFrom?.isConnected) sheetFrom.focus({preventScroll: true}); sheetFrom = null; return; }
  if (el.hidden) sheetFrom = document.activeElement;
  el.hidden = false;
  el.innerHTML = `<div class="sheet-backdrop" data-act="closeSheet"></div><div class="sheet-panel" role="dialog" aria-modal="true">${S.sheet}</div>`;
  const f = el.querySelector('input,textarea'); if (f) setTimeout(() => f.focus(), 60);
}
export function openSheet(html){
  const wasOpen = !!S.sheet;
  S.sheet = html; renderSheet(); hydrate();
  if (!wasOpen) histDo(() => history.pushState({mf: 1, sheet: 1}, ''));
}
export function closeSheet(){
  if (!S.sheet) return;
  S.sheet = null; renderSheet(); dropSheetEntry();
}
export { renderNav };

/* الأمان: لا نضع في img.src إلا صورة مضمّنة (data:image) أو صورة حساب Google،
   حتى لا يضع مستخدم رابط صورة من موقعه فيعرف متى فُتح طلبه وعنوان IP من فتحه */
export const safeData = v => typeof v === 'string' && v.startsWith('data:image/');
export const safeAvatar = v => typeof v === 'string' && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(v);

async function loadPhoto(img){
  if (img.dataset.loaded) return; img.dataset.loaded = '1';
  const d = await getPhoto(img.dataset.photo);
  if (safeData(d) && img.isConnected){ img.src = d; img.hidden = false; }
}
// تحميل الصور عند اقترابها من الشاشة فقط (توفيراً لحصة Firestore).
// الصورة مخفية حتى تُحمَّل فلا تتقاطع أبداً، لذلك نراقب الحاوية الأب.
const lazy = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries){
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    e.target.querySelectorAll('img[data-photo]').forEach(loadPhoto);
  }
}, {rootMargin: '300px'}) : null;

/* تحميل الصور وأسماء المستخدمين بعد رسم الصفحة */
export function hydrate(){
  $$('img[data-photo]').forEach(img => {
    if (img.dataset.loaded) return;
    const box = img.closest('.thumb, .detail-photo, .row-thumb, .pv');
    if (lazy && box) lazy.observe(box); else loadPhoto(img);
  });
  $$('[data-uname]').forEach(async el => {
    if (el.dataset.loaded) return; el.dataset.loaded = '1';
    const p = await getName(el.dataset.uname);
    if (!el.isConnected) return;
    el.textContent = p.name;
    const img = el.parentElement?.querySelector('img[data-avatar]');
    if (img && safeAvatar(p.photo)){ img.referrerPolicy = 'no-referrer'; img.src = p.photo; img.hidden = false; }
  });
  // بريد صاحب الحساب (للإدارة)، وتحذير إن كان خارج نطاق الموظفين المضبوط في config.js
  $$('[data-uemail]').forEach(async el => {
    if (el.dataset.loaded) return; el.dataset.loaded = '1';
    const email = await getEmail(el.dataset.uemail);   // H18: من private/profile (للإدارة فقط)
    if (!el.isConnected || !email) return;
    el.textContent = email;
    const dom = String(SETTINGS.staffEmailDomain || '').trim().toLowerCase().replace(/^@/, '');
    const host = email.toLowerCase().split('@')[1] || '';
    if (dom && host !== dom && !host.endsWith('.' + dom)){
      const w = document.createElement('span'); w.className = 'pill bad';
      w.textContent = t('adm.outDomain', {domain: dom});
      el.after(w);
    }
  });
}
