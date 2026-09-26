// هيكل الواجهة: التنقل بين الصفحات، الشريط العلوي، الشريط السفلي، النوافذ المنبثقة
import { icon, LOGO, otype } from './constants.js';
import { $, $$, esc } from './utils.js';
import { S, curOffice, modes, homeRoute, unseenCount, markSeen, candidatesFor, getPhoto, getName } from './state.js';
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
export function go(name, params = {}, push = true){
  if (push && S.route.name !== name) S.hist.push(S.route);
  if (S.hist.length > 30) S.hist.shift();
  S.route = {name, params}; S.sheet = null;
  renderAll(); window.scrollTo(0, 0);
}
export function back(){
  const prev = S.hist.pop();
  if (prev){ S.route = prev; S.sheet = null; renderAll(); }
  else go(homeRoute(), {}, false);
}
export function renderAll(){ renderHeader(); renderMain(); renderNav(); renderSheet(); hydrate(); }
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
export function openSheet(html){ S.sheet = html; renderSheet(); hydrate(); }
export function closeSheet(){ S.sheet = null; renderSheet(); }
export { renderNav };

/* تحميل الصور وأسماء المستخدمين بعد رسم الصفحة */
export function hydrate(){
  $$('img[data-photo]').forEach(async img => {
    if (img.dataset.loaded) return; img.dataset.loaded = '1';
    const d = await getPhoto(img.dataset.photo);
    if (d && img.isConnected){ img.src = d; img.hidden = false; }
  });
  $$('[data-uname]').forEach(async el => {
    if (el.dataset.loaded) return; el.dataset.loaded = '1';
    const p = await getName(el.dataset.uname);
    if (!el.isConnected) return;
    el.textContent = p.name;
    const img = el.parentElement?.querySelector('img[data-avatar]');
    if (img && p.photo){ img.referrerPolicy = 'no-referrer'; img.src = p.photo; img.hidden = false; }
  });
}
