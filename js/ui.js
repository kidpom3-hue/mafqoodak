// هيكل الواجهة: التنقل بين الصفحات، الشريط العلوي، الشريط السفلي، النوافذ المنبثقة
import { icon, LOGO, otype } from './constants.js';
import { $, $$, esc } from './utils.js';
import { S, curOffice, modes, homeRoute, unseenCount, markSeen, candidatesFor, getPhoto, getName, SHARE_RE } from './state.js';
import { vPick, vBrowse, updateBrowse, vItem, vClaimForm, vReportForm, vMine, vOffice, vJoin } from './views/visitor.js';
import { vStaff, updateStaff, vItemForm } from './views/staff.js';
import { vAdmin, vOfficeForm } from './views/admin.js';
import { vLogin, vSetup, vNotConfigured } from './views/auth.js';
import { vHome, updateHome, vFound } from './views/home.js';
import { vPrivacy } from './views/privacy.js';
import { cat } from './constants.js';

/* live: تُعاد رسمها عند تغيّر البيانات. النماذج (live:false) لا تُعاد حتى لا يضيع ما كتبه المستخدم */
const ROUTES = {
  pick: {live: true, v: vPick},
  home: {live: true, v: vHome, update: updateHome},
  found: {live: true, v: vFound},
  browse: {live: true, v: vBrowse, update: updateBrowse},
  item: {live: true, v: vItem},
  claim: {live: false, v: vClaimForm},
  report: {live: false, v: vReportForm, after: initForm},
  mine: {live: true, v: vMine, after: markSeen},
  office: {live: true, v: vOffice},
  join: {live: false, v: vJoin},
  staff: {live: true, v: vStaff, update: updateStaff},
  add: {live: false, v: vItemForm, after: initForm},
  admin: {live: true, v: vAdmin},
  officeForm: {live: false, v: vOfficeForm},
  login: {live: false, v: vLogin},
  setup: {live: false, v: vSetup},
  privacy: {live: false, v: vPrivacy},
};

export function initForm(){
  const f = $('form[data-form=item],form[data-form=report]'); if (!f) return;
  const c = f.querySelector('input[name=cat]:checked'); const sens = c ? !!cat(c.value).sensitive : false;
  const n = f.querySelector('#sens-note'), p = f.querySelector('#photo-field');
  if (n) n.hidden = !sens; if (p) p.hidden = sens;
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
  const pushed = push && S.route.name !== name;
  if (pushed) S.hist.push(S.route);
  if (S.hist.length > 30) S.hist.shift();
  if (S.sheet) dropSheetEntry();
  S.route = {name, params}; S.sheet = null;
  renderAll(); window.scrollTo(0, 0);
  if (pushed) histDo(() => history.pushState({mf: 1}, ''));
}
// الانتقال من الشريط السفلي لا يحفظ الصفحة في S.hist، لكن نضيف خطوة واحدة في سجل المتصفح
// حتى يعود زر الرجوع إلى الرئيسية بدل الخروج من التطبيق
export function tabEntry(){ histDo(() => { if (!history.state?.mf) history.pushState({mf: 1}, ''); }); }
// خطوة رجوع داخل التطبيق (بلا pushState)
function backStep(){
  const prev = S.hist.pop(); S.sheet = null;
  if (prev){ S.route = prev; renderAll(); }
  else go(homeRoute(), {}, false);
}
// زر «رجوع» في الواجهة: نرجع عبر سجل المتصفح ليبقى متطابقاً مع التطبيق
export function back(){
  if (S.sheet){ S.sheet = null; renderSheet(); dropSheetEntry(); }
  histDo(() => { if (history.state?.mf) history.back(); else backStep(); });
}
window.addEventListener('popstate', () => {
  if (skipPop){ skipPop = 0; afterPop.splice(0).forEach(f => f()); return; }
  if (SHARE_RE.test(location.hash.slice(1))) return;   // رابط مشاركة: يعالجه مستمع hashchange في main.js
  if (S.sheet){ S.sheet = null; renderSheet(); return; }   // نافذة مفتوحة: نغلقها فقط
  backStep();
});
export function renderAll(){ renderHeader(); renderMain(); renderNav(); renderSheet(); hydrate(); }

/* ارتفاع الترويسة في متغير CSS ليلتصق شريط البحث تحتها مباشرة، وظل خفيف عند الالتصاق */
function syncHeader(){ const h = $('#hdr'); if (h) document.documentElement.style.setProperty('--hdr-h', h.offsetHeight + 'px'); }
function markStuck(){
  const bar = $('#browse-bar'); if (!bar) return;
  const top = parseFloat(getComputedStyle(bar).top) || 0;
  bar.classList.toggle('stuck', bar.getBoundingClientRect().top <= top + 1 && window.scrollY > 0);
}
window.addEventListener('resize', syncHeader);
window.addEventListener('scroll', markStuck, {passive: true});
export function refresh(){
  renderHeader();
  const r = ROUTES[S.route.name];
  const main = $('#main');
  if (r?.update && main.firstElementChild?.dataset.view === S.route.name) r.update();
  else if (r?.live) renderMain();
  renderNav(); hydrate();
}
function renderMain(){
  const main = $('#main');
  if (!S.configured){ main.innerHTML = vNotConfigured(); return; }
  if (!S.authReady || !S.configLoaded || !S.officesLoaded){ main.innerHTML = `<div class="loading"><span class="spin"></span></div>`; return; }
  if (S.route.name === 'login' && S.uid) S.route = S.route.params.next || {name: homeRoute(), params: {}};
  if (!S.config){ main.innerHTML = S.route.name === 'login' ? vLogin() : S.route.name === 'privacy' ? vPrivacy() : vSetup(); return; }
  // لا مكان مختار (أو لم يصل بعد من قاعدة البيانات): نعرض قائمة الأماكن دون تغيير الصفحة المطلوبة
  if (!curOffice() && !['pick', 'admin', 'officeForm', 'join', 'login', 'privacy'].includes(S.route.name)){ main.innerHTML = vPick(); return; }
  const r = ROUTES[S.route.name] || ROUTES.home;
  main.innerHTML = r.v();
  if (r.update) r.update();
  if (r.after) r.after();
}
function renderHeader(){
  const o = curOffice(); const ms = S.config ? modes() : ['visitor'];
  const acct = !S.configured || !S.authReady ? ''
    : S.uid ? `<button class="avatar-btn" data-act="account" aria-label="حسابي">${S.me?.photo ? `<img src="${esc(S.me.photo)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc((S.me?.name || '؟').trim().charAt(0))}</span>`}</button>`
    : `<button class="btn sm ghost" data-act="login">${icon('users')}دخول</button>`;
  $('#hdr').innerHTML = `<div class="top-row">
      <button class="brand" data-act="nav" data-r="${homeRoute()}" aria-label="الرئيسية">${LOGO}<span class="wordmark">مفقودك</span></button>
      ${S.config && (o || S.mode === 'admin') ? `<nav class="top-links" aria-label="التنقل">${navItems().map(n => {
        const on = S.route.name === n.r && (!n.tab || (n.r === 'staff' ? S.staffTab : S.adminTab) === n.tab);
        return `<button class="${on ? 'on' : ''}" data-act="nav" data-r="${n.r}" data-tab="${n.tab || ''}">${n.l}${n.b ? `<span class="count">${n.b}</span>` : ''}</button>`;
      }).join('')}</nav>` : ''}
      <div class="top-actions">
        ${o ? `<button class="office-chip" data-act="pickOffice" aria-label="تغيير المكان">${icon(otype(o.type).icon)}<span>${esc(o.short || o.name)}</span>${icon('chev')}</button>` : ''}
        ${acct}
      </div>
    </div>
    ${ms.length > 1 ? `<div class="seg modes" role="tablist" aria-label="طريقة العرض">${ms.map(m => `<button class="${S.mode === m ? 'on' : ''}" data-act="mode" data-v="${m}" role="tab" aria-selected="${S.mode === m}">${({visitor: 'زائر', staff: 'موظف المكتب', admin: 'الإدارة'})[m]}</button>`).join('')}</div>` : ''}`;
  syncHeader();
}
function navItems(){
  if (S.mode === 'staff'){
    const pend = S.claims.filter(c => c.status === 'pending').length;
    const open = S.reports.filter(r => r.status === 'open' && !r.staffPick && candidatesFor(r, 1).length).length;
    return [
      {r: 'staff', tab: 'items', l: 'المستودع', i: 'box'},
      {r: 'add', l: 'أضف غرضاً', i: 'plus'},
      {r: 'staff', tab: 'claims', l: 'الاستلام', i: 'inbox', b: pend},
      {r: 'staff', tab: 'reports', l: 'البلاغات', i: 'bell', b: open},
    ];
  }
  if (S.mode === 'admin'){
    const pend = S.staffReqs.filter(r => r.status === 'pending').length;
    return [
      {r: 'admin', tab: 'overview', l: 'نظرة عامة', i: 'grid'},
      {r: 'admin', tab: 'offices', l: 'المواقع', i: 'pin'},
      {r: 'admin', tab: 'people', l: 'الصلاحيات', i: 'users', b: pend},
    ];
  }
  return [
    {r: 'home', l: 'الرئيسية', i: 'building'},
    {r: 'browse', l: 'المفقودات', i: 'search'},
    {r: 'report', l: 'بلّغ', i: 'plus'},
    {r: 'mine', l: 'طلباتي', i: 'inbox', b: S.route.name === 'mine' ? 0 : unseenCount()},
    {r: 'office', l: 'المكتب', i: 'info'},
  ];
}
function renderNav(){
  const nav = $('#nav');
  if (!S.configured || !S.config || (!curOffice() && S.mode !== 'admin') || ['login', 'setup'].includes(S.route.name)){ nav.hidden = true; return; }
  nav.hidden = false;
  const cur = S.route.name;
  nav.innerHTML = `<div class="inner">${navItems().map(n => {
    const on = cur === n.r && (!n.tab || (n.r === 'staff' ? S.staffTab : S.adminTab) === n.tab);
    return `<button class="${on ? 'on' : ''}" data-act="nav" data-r="${n.r}" data-tab="${n.tab || ''}" ${on ? 'aria-current="page"' : ''}>${icon(n.i)}<span>${n.l}</span>${n.b ? `<span class="count">${n.b}</span>` : ''}</button>`;
  }).join('')}</div>`;
}
export function renderSheet(){
  const el = $('#sheet');
  if (!S.sheet){ el.hidden = true; el.innerHTML = ''; return; }
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
}
