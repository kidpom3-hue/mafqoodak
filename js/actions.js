// الأحداث: الضغط على الأزرار وإرسال النماذج
import { icon, cat, catName, colorName, statusLabel, ITEM_STATUS, CATS, COLORS, isGrouped, claimOf, claimHasRequired, detailValue, handoverChecks, CLAIM_MAX_OPEN, CLAIM_CAT_MS, pubFlag, isHiddenCat, keepUntilOf } from './constants.js';
import { t, tp, tAr, tpAr, LANG, setLang } from './i18n.js';
import { $, esc, today, relDay, pill, sha, genCode, normPickup, makeRef, compress, dataUrlToBlob, matchScore, toast, LS, isBuilding, roomWord, makeBlur, publicTitle, showTitle, isoDay, refCode, normCode, latinDigits, when } from './utils.js';
import { claimEmailOk, cleanDomain, domainRe } from './views/common.js';
import { S, curOffice, item, full, modes, saveProfile, homeRoute, setOffice, write, authErr, getPhoto, cachePhoto, MATCH_MIN, ACTIVE, refreshCounts, loadExtraItems, loadClaimHistory, loadClosedReports, loadAdminCounts, conflictOf, isStale, loadAudit, suggestFor, claimNo, claimEditable, pickOf, touch, checkInvite, createLimited, unseenKeys, markSeenKeys, keyTab, keyCard, unseenFor, staffKeys, markStaffSeen, openClaimCard, claimItemId } from './state.js';
import * as wf from './workflow.js';
import { auth, dbx, wipeLocalDb, GoogleAuthProvider, signInWithPopup, signInWithRedirect, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut, deleteField, arrayUnion, arrayRemove, serverTimestamp,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification } from './firebase.js';
import { go, back, renderAll, openSheet, closeSheet, hydrate, renderNav, tabEntry, safeAvatar, lockEvidence } from './ui.js';
import { updateBrowse, RATE_DRAFT, CARD_OPEN, ENDED_OPEN } from './views/visitor.js';
// H8: لوحة الموظف والإحصاءات والذكاء الاصطناعي والأمثلة تُحمَّل عند الحاجة (lazy.js). SM() = وحدة staff.js المحمّلة
// (أزرار لوحة الموظف لا تظهر إلا بعد تحميلها، فهي موجودة عند النقر)
import { mod, load } from './lazy.js';
const SM = () => mod('staff');
import { FORM, AGAIN, saveAddPrefs, orphanText, subsPicker, pubPhoto, person, themePicker, textPicker, catFields, dfLabel, dfOpt, detailReq } from './views/common.js';
import { setTheme, setTextSize } from './theme.js';
import { notifySupported, notifyOn, notifyDenied, toggleNotify, emailUser, emailFinder } from './notify.js';
import { aiReady } from './firebase.js';
const aiErr = e => mod('ai')?.aiErrMsg(e) || t('err.save');
import { SETTINGS, APP_VERSION } from './config.js';

/* ---------- أدوات النماذج ---------- */
// field: اسم الخانة المسؤولة عن الخطأ (H1): يُفتح القسم المطوي الذي فيه (<details>) وينتقل التركيز إليها
function formErr(form, msg, field){
  const e = form.querySelector('.form-err'); if (!e) return; e.textContent = msg; e.hidden = !msg; if (!msg) return;
  const el = field && form.querySelector(`[name="${field}"]`);
  // H19: الخانة في خطوة أخرى من النموذج: نعرض تلك الخطوة أولاً
  const st = el?.closest('.step'); if (st && st.hidden) showStep(form, Number(st.dataset.step), true);
  if (el){ const d = el.closest('details'); if (d) d.open = true; el.focus({preventScroll: true}); el.scrollIntoView({block: 'center', behavior: 'smooth'}); }
  else e.scrollIntoView({block: 'center', behavior: 'smooth'});
}
/* H19: نماذج الخطوات (البلاغ والطلب): خطوة واحدة ظاهرة، ومؤشر الخطوات يتبعها.
   «التالي» يفحص الخانات المطلوبة في الخطوة الحالية فقط؛ الفحص الكامل عند الإرسال، وخطؤه يعيد إلى خطوة الخانة */
export function showStep(form, n, keepErr){
  const total = Number(form.dataset.steps) || 1; n = Math.max(1, Math.min(total, n));
  form.dataset.step = n;
  form.querySelectorAll('.step').forEach(x => { x.hidden = Number(x.dataset.step) !== n; });
  form.querySelectorAll('.stepper li').forEach(li => { const k = Number(li.dataset.n);
    li.classList.toggle('cur', k === n); li.classList.toggle('done', k < n);
    if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
  if (!keepErr){ const e = form.querySelector('.form-err'); if (e){ e.hidden = true; e.textContent = ''; } }
  form.querySelector(`.step[data-step="${n}"] .step-h`)?.focus({preventScroll: true});
  form.scrollIntoView({block: 'start', behavior: 'smooth'});
}
function stepMissing(form){
  const st = form.querySelector(`.step[data-step="${form.dataset.step || 1}"]`); if (!st) return null;
  if (st.querySelector('input[name=cat]') && !st.querySelector('input[name=cat]:checked')) return {msg: t('a.needCat'), el: st.querySelector('input[name=cat]')};
  for (const el of st.querySelectorAll('[required]')){
    if (el.disabled || el.closest('[hidden]')) continue;
    const empty = el.type === 'radio' ? !st.querySelector(`input[name="${el.name}"]:checked`) : el.type === 'checkbox' ? !el.checked : !String(el.value || '').trim();
    if (empty) return {msg: t('step.need'), el};
  }
  return null;
}
function stepNext(form){
  const m = stepMissing(form);
  if (m){ formErr(form, m.msg); const d = m.el.closest('details'); if (d) d.open = true; m.el.focus({preventScroll: true}); m.el.scrollIntoView({block: 'center', behavior: 'smooth'}); return; }
  showStep(form, (Number(form.dataset.step) || 1) + 1);
}
function busy(form, on){ const b = form.querySelector('button[type=submit]'); if (b) b.disabled = on; }

export function onCatChange(form, catId, sub){
  // H16: بلاغ جديد بتصنيف مخفي (النقود): يتحول إلى البلاغ بالتفاصيل (طلب مجمّع يطابقه الموظف)، فلا بلاغ عادي للنقود
  if (form.dataset.form === 'report' && !form.dataset.id && isHiddenCat(catId)){ toast(t('rp.toHidden')); go('gclaim', {cat: catId}); return; }
  const sf = form.querySelector('#subs-field'), sc = form.querySelector('#subs');
  if (sc){ sc.innerHTML = subsPicker(catId, sub); sf.hidden = !cat(catId).subs.length; }
  // أسئلة التصنيف: تُعاد حسب التصنيف الجديد، مع الإبقاء على ما كُتب في الخانات ذات المفتاح نفسه.
  // ما كُتب يُحفظ في ذاكرة النموذج (catMemo)، فيعود إن رجع الموظف إلى تصنيف فيه الخانة نفسها (مثل الماركة بعد النقود)
  const cf = form.querySelector('#cat-fields');
  if (cf){
    const memo = form.catMemo ||= {details: {}}, fd = new FormData(form);
    if (form.querySelector('[name=color]')) memo.color = String(fd.get('color') || '');
    if (form.querySelector('[name=brand]')) memo.brand = String(fd.get('brand') || '');
    for (const el of form.querySelectorAll('[name^=d_]')) memo.details[el.name.slice(2)] = el.value;
    // H9: نموذج الإضافة السريعة يقسم الخانات: المطلوبة ظاهرة، والاختيارية في «تفاصيل إضافية»
    const opt = form.querySelector('#cat-fields-opt');
    cf.innerHTML = catFields(catId, memo, cf.dataset.mode, opt ? 'req' : '');
    if (opt) opt.innerHTML = catFields(catId, memo, cf.dataset.mode, 'opt');
  }
  // التصنيف المختار داخل «كل التصنيفات» المطوية: نفتحها حتى يراه الموظف
  const picked = form.querySelector(`input[name=cat]:checked`)?.closest('#cat-all'); if (picked) picked.open = true;
  const sens = cat(catId).sensitive;
  const note = form.querySelector('#sens-note'), pf = form.querySelector('#photo-field');
  if (note) note.hidden = !sens;
  if (pf) pf.hidden = !!sens;
  if (sens && (FORM.photo || FORM.hadPhoto)){ clearPhoto(form); toast(t('a.photoRemoved')); }
  lockEvidence(form);   // v14: الخانات المعاد رسمها تبقى للعرض فقط في الغرض المقفل
}
// عند تغيير المكان: نُظهر خانتي المبنى والقاعة إن كان المكان داخل مبنى، ونفرّغهما إن لم يكن
function onSpotChange(form, spot){
  const box = form.querySelector('#spot-extra'); if (!box) return;
  const on = isBuilding(spot); box.hidden = !on;
  const lbl = form.querySelector('#room-label'); if (lbl) lbl.textContent = roomWord(spot);
  if (!on) box.querySelectorAll('input').forEach(i => i.value = '');
}
function clearPhoto(form){
  FORM.photo = null; FORM.blob = null; FORM.copyFrom = null; if (FORM.hadPhoto) FORM.removed = true;
  const pv = form.querySelector('#pv'); if (pv) pv.innerHTML = icon('camera');
  const rm = form.querySelector('#rm-photo'); if (rm) rm.hidden = true;
  const ai = form.querySelector('#ai-btn'); if (ai) ai.disabled = true;
  const inp = form.querySelector('#photo-in'); if (inp) inp.value = '';
  form.querySelectorAll('.photo-file').forEach(x => x.value = '');
  if (form.dataset.quick){ photoState(form, 'pick'); form.querySelector('.qp-btn input, .qp-btn')?.focus(); }   // H9: «حذف» يعيد الأزرار
}
/* v7: صور إثبات طلب الاستلام (اختيارية، صورتان على الأكثر): صورة قديمة للغرض أو فاتورته، يراها الموظف فقط.
   تُضغط بدالة الصور نفسها (< 350KB) وتُحفظ مع الطلب في العملية نفسها (claimProofs) */
async function onProofs(input){
  const files = [...(input.files || [])].slice(0, 2); if (!files.length) return;
  try { FORM.proofs = (await Promise.all(files.map(f => compress(f)))).map(x => x.dataUrl).filter(d => d.length < 350000); }
  catch { toast(t('a.photoFail')); FORM.proofs = []; }
  const pv = input.closest('form').querySelector('#proof-pv');
  if (pv) pv.innerHTML = FORM.proofs.map(d => `<img src="${d}" alt="">`).join('') + (FORM.proofs.length ? `<button type="button" class="link" data-act="rmProofs">${icon('x')}${t('c.remove')}</button>` : '');
}
async function onPhoto(input){
  const f = input.files?.[0]; if (!f) return;
  const form = input.closest('form'); const st = form.querySelector('#ai-status');
  try {
    const {dataUrl, blob} = await compress(f);
    FORM.photo = dataUrl; FORM.blob = blob; FORM.removed = false;
    form.querySelector('#pv').innerHTML = `<img src="${dataUrl}" alt="">`;
    form.querySelector('#rm-photo').hidden = false;
    const ai = form.querySelector('#ai-btn'); if (ai){ ai.disabled = false; if (st) st.textContent = t('a.aiHint'); }
    // H9: المعاينة تحل مكان الأزرار، ويقترح الذكاء الاصطناعي الحقول (إن كان مفعّلاً)
    if (form.dataset.quick){ photoState(form, 'view'); focusNext(form); if (aiReady()) aiSuggest(form, blob); }
  } catch { toast(t('a.photoFail')); }
}

// ما يبقى من آخر غرض حُفظ (المكان وتفاصيله والتاريخ)، يُنقل إلى AGAIN عند «أضف آخر»
const LAST_ADD = {v: null};
/* ---------- الإضافة السريعة (H9) ----------
   لا يُفتح شيء تلقائياً: الموظف يختار «التقط صورة» أو «من المعرض» أو «بلا صورة».
   photoState: 'pick' الأزرار · 'view' المعاينة مع «تغيير» و«حذف» · 'none' بلا صورة */
function photoState(form, v){ const f = form.querySelector('#photo-field.qp'); if (f) f.dataset.ph = v; }
// بعد اختيار الصورة (أو «بلا صورة») ينتقل التركيز إلى أول خانة ناقصة: التصنيف، وإلا العنوان
function focusNext(form){
  const first = !form.querySelector('input[name=cat]:checked') ? form.querySelector('input[name=cat]') : form.querySelector('[name=title]');
  first?.focus({preventScroll: true});
}
/* اقتراح الذكاء الاصطناعي: التصنيف والنوع والعنوان واللون، مع علامة «اقتراح» على كل خانة عُبّئت.
   لا يُحفظ شيء تلقائياً، ولا يغيّر ما عدّله الموظف بيده. إن فشل أو تأخر أكثر من 6 ثوانٍ: يكمل الموظف يدوياً بلا رسالة خطأ */
const AI_WAIT = 6000;
async function aiSuggest(form, blob){
  const st = form.querySelector('#ai-status'), mine = FORM.blob;
  if (st) st.innerHTML = `<span class="spin" style="width:14px;height:14px"></span> ${t('a.aiSuggesting')}`;
  let r = null;
  try {
    r = await Promise.race([load('ai').then(m => m.analyzePhoto(blob)), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), AI_WAIT))]);
  } catch (e){ console.warn('[ai]', e?.message || e); }
  if (!form.isConnected || FORM.blob !== mine){ return; }   // غادر الموظف النموذج أو غيّر الصورة
  if (st) st.textContent = '';
  if (!r) return;
  const touched = form.touched || new Set(), mark = [];
  // لا نضع ناتج الذكاء الاصطناعي في querySelector إلا إن كان من معرّفات التصنيفات والألوان المعروفة
  if (!touched.has('cat') && CATS.some(c => c.id === r.cat)){
    const el = form.querySelector(`input[name=cat][value="${r.cat}"]`);
    if (el){ el.checked = true; onCatChange(form, r.cat, cat(r.cat).subs.includes(r.sub) ? r.sub : ''); mark.push(el); }
    const sub = form.querySelector('input[name=sub]:checked'); if (sub) mark.push(sub);
  }
  if (!touched.has('color') && COLORS.some(c => c.id === r.color)){ const el = form.querySelector(`input[name=color][value="${r.color}"]`); if (el){ el.checked = true; mark.push(el); } }
  const ti = form.querySelector('[name=title]');
  if (r.title && ti && !touched.has('title') && !ti.value.trim()){ ti.value = String(r.title).slice(0, 80); mark.push(ti); }
  for (const el of mark) markSugg(form, el);
  if (mark.length && st) st.innerHTML = `${icon('spark')} ${t('a.aiSuggested')}`;
}
// علامة «اقتراح» بجانب عنوان الخانة، وعلى عنوان القسم المطوي الذي فيه (إن وُجد). تزول حين يغيّرها الموظف
function markSugg(form, el){
  const field = el.closest('.field'); const lab = field?.querySelector(':scope > .label, :scope > label');
  if (lab && !lab.querySelector('.sugg-tag')) lab.insertAdjacentHTML('beforeend', ` <span class="sugg-tag">${t('if.sugg')}</span>`);
  const sum = el.closest('details')?.querySelector(':scope > summary > span');
  if (sum && !sum.querySelector('.sugg-tag')) sum.insertAdjacentHTML('beforeend', ` <span class="sugg-tag">${t('if.sugg')}</span>`);
}
function unSugg(form, el){
  form.touched ||= new Set(); form.touched.add(el.name);
  el.closest('.field')?.querySelector('.sugg-tag')?.remove();
  if (el.name === 'cat') form.querySelector('#subs-field .sugg-tag')?.remove();
}

/* إجابات أسئلة التصنيف من النموذج: القيم غير الفارغة فقط (مُطبَّعة كما تُحفظ)، وأول سؤال إجباري ناقص.
   mode: 'item' نموذج الموظف · 'claim' طلب الاستلام (بلا أسئلة as) · 'report' البلاغ (كلها اختيارية) */
function readDetails(form, catId, mode){
  const fd = new FormData(form), details = {}; let missing = '', missingKey = '';
  for (const d of claimOf(catId).details){
    if (mode === 'claim' && d.as) continue;
    const v = detailValue(d, fd.get('d_' + d.k));
    if (v) details[d.k] = v; else if (!missing && detailReq(d, mode)){ missing = dfLabel(catId, d.k); missingKey = 'd_' + d.k; }
  }
  return {details, missing, missingKey};
}

/* ---------- «تراجع» (G5) ----------
   رسالة صغيرة فيها زر «تراجع» لمدة 5 ثوانٍ قبل الحفظ؛ إن لم يُضغط يُنفَّذ الحفظ.
   عملية جديدة (أو مغادرة الصفحة) تنفّذ السابقة فوراً */
let UNDO = null;
function undoable(msg, commit, undo){
  UNDO?.finish(true);
  let bar = document.getElementById('undo');
  if (!bar){ bar = document.createElement('div'); bar.id = 'undo'; bar.className = 'undo-bar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite'); document.body.appendChild(bar); }
  bar.innerHTML = `<span>${esc(msg)}</span><button type="button" class="btn sm soft">${icon('undo')}${t('c.undo')}</button>`;
  bar.classList.add('show');
  const u = {finish(ok){
    if (UNDO !== u) return; UNDO = null; clearTimeout(u.timer);
    bar.classList.remove('show'); bar.innerHTML = '';
    ok ? commit() : undo();
  }};
  u.timer = setTimeout(() => u.finish(true), 5000);
  bar.querySelector('button').addEventListener('click', () => u.finish(false));
  UNDO = u;
}
addEventListener('pagehide', () => UNDO?.finish(true));

/* ---------- الذكاء الاصطناعي ---------- */
async function aiFill(){
  const btn = $('#ai-btn'), st = $('#ai-status'); if (!FORM.blob || !btn) return;
  btn.disabled = true; st.innerHTML = `<span class="spin" style="width:14px;height:14px"></span> ${t('a.aiAnalyzing')}`;
  try {
    const r = await (await load('ai')).analyzePhoto(FORM.blob);
    const f = btn.closest('form');
    // لا نضع ناتج الذكاء الاصطناعي في querySelector إلا إن كان من معرّفات التصنيفات والألوان المعروفة
    if (CATS.some(c => c.id === r?.cat) && f.querySelector(`input[name=cat][value="${r.cat}"]`)){ f.querySelector(`input[name=cat][value="${r.cat}"]`).checked = true; onCatChange(f, r.cat, r.sub); }
    if (COLORS.some(c => c.id === r?.color)){ const cc = f.querySelector(`input[name=color][value="${r.color}"]`); if (cc) cc.checked = true; }
    if (r?.title) f.querySelector('[name=title]').value = String(r.title).slice(0, 80);
    if (r?.desc) f.querySelector('[name=desc]').value = String(r.desc).slice(0, 600);
    st.innerHTML = `${icon('check')} ${t('a.aiFilled')}`;
  } catch (e){ console.warn(e); st.textContent = aiErr(e); }
  finally { btn.disabled = !FORM.blob; }
}
async function aiMatch(reportId){
  const r = S.myReports.find(x => x.id === reportId); const st = $('#ai-' + reportId); if (!r) return;
  const pool = S.items.filter(i => (i.status === 'available' || i.status === 'reserved') && !isHiddenCat(i.cat))   // H16: لا نقود
    .map(i => ({i, s: matchScore(r, {...i, spot: ''})})).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.i);   // بلا مكان العثور (سري)
  if (!pool.length){ if (st) st.textContent = t('a.aiNoPool'); return; }
  if (st) st.innerHTML = `<span class="spin" style="width:14px;height:14px"></span> ${t('a.aiComparing')}`;
  const images = [], imgIds = [];
  if (r.photo){
    const d = await getPhoto('r_' + r.id);
    if (d){
      images.push(dataUrlToBlob(d));
      for (const i of pool){
        if (images.length >= 5) break;
        if ((i.photo !== 'clear' && i.photo !== true) || cat(i.cat).sensitive) continue;   // النسخ المموّهة لا تفيد المقارنة
        const p = await getPhoto(i.id); if (p){ images.push(dataUrlToBlob(p)); imgIds.push(i.id); }
      }
    }
  }
  try {
    const matches = await (await load('ai')).rankMatches(r, pool, images, imgIds);
    const ok = await write(() => dbx.update('reports/' + r.id, {ai: {at: Date.now(), matches}}), t(matches.length ? 'a.aiRanked' : 'a.aiNoMatch'));
    if (!ok && st?.isConnected) st.textContent = '';
  } catch (e){ console.warn(e); if (st?.isConnected) st.textContent = aiErr(e); }
}

/* ---------- تعديل البلاغ (G3) ----------
   تحديث للبلاغ نفسه: يبقى ترشيح الموظف (staffPick، pickedAt) وقائمة «ليس غرضي» (rejected) وrenewedAt كما هي،
   ويُضاف editedAt. نتيجة الذكاء الاصطناعي القديمة تُحذف لأنها بُنيت على الوصف القديم، والمطابقة تُعاد فوراً عند العرض */
async function saveReportEdit(form, val, catId, sens, bldg, room){
  const r = S.myReports.find(x => x.id === form.dataset.id);
  if (!r || r.status !== 'open'){ busy(form, false); return formErr(form, t('rp.gone')); }
  const {details} = readDetails(form, catId, 'report');
  const had = !!r.photo, newPhoto = !!FORM.photo && !sens, removing = had && (sens || (FORM.removed && !FORM.photo));
  const patch = {cat: catId, sub: val('sub'), color: claimOf(catId).fields.includes('color') ? val('color') : '',
    title: val('title'), desc: val('desc'), spot: val('spot'), bldg, room, lostDate: val('lostDate') || today(),
    details: Object.keys(details).length ? details : deleteField(), editedAt: Date.now(), ...(r.ai ? {ai: deleteField()} : {})};
  // الصورة: حذفها يسبق تحديث البلاغ، والجديدة تُحفظ بعده (قواعد reportPhotos تقرأ البلاغ)
  if (removing){ await write(() => dbx.del('reportPhotos/' + r.id)); cachePhoto('r_' + r.id, null); patch.photo = false; }
  const ok = await write(() => dbx.update('reports/' + r.id, patch), t('a.reportEdited'));
  if (ok && newPhoto){
    cachePhoto('r_' + r.id, FORM.photo);
    if (await write(() => dbx.set('reportPhotos/' + r.id, {data: FORM.photo})) && !had) await write(() => dbx.update('reports/' + r.id, {photo: true}));
  }
  busy(form, false); if (ok){ S.hist = []; go('mine', {focus: r.id}, false); }
}

/* ---------- إرسال النماذج ---------- */
async function submitForm(form){
  const kind = form.dataset.form; const fd = new FormData(form); formErr(form, '');
  const val = k => String(fd.get(k) || '').trim();
  /* H18: لا تاريخ فقد أو عثور بعد اليوم (بتوقيت الرياض: today() في utils.js) في أي نموذج: البلاغ وتعديله، والطلب والمجمّع وتعديله،
     والغرض، وإشعار التسليم، والقبول المباشر للنقود. لا نعتمد على max في الحقل لأن Safari يتجاهله، والقواعد ترفضه أيضاً (notFuture) */
  for (const k of ['lostDate', 'foundDate']){
    const v = val(k);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v > today()) return formErr(form, t(k === 'lostDate' ? 'a.futureLost' : 'a.futureFound'), k);
  }
  // رقم المبنى ورقم القاعة يُحفظان فقط إذا كان المكان داخل مبنى
  const inBldg = isBuilding(val('spot'));
  const bldg = inBldg ? val('bldg').slice(0, 6) : '', room = inBldg ? val('room').slice(0, 10) : '';

  if (kind === 'homeSearch'){
    S.filter.q = val('q'); S.filter.cat = 'all'; S.filter.status = 'available';
    go('browse');
    return;
  }

  if (kind === 'login'){
    const email = val('email'), pass = String(fd.get('password') || ''), signup = form.dataset.mode === 'signup';
    if (!email || !pass) return formErr(form, t('a.needEmailPass'));
    if (signup && pass.length < 6) return formErr(form, t('a.passShort'));
    busy(form, true);
    try {
      if (signup){
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const name = val('name') || email.split('@')[0];
        await updateProfile(cred.user, {displayName: name});
        S.me = {...(S.me || {}), name};
        // H18: البريد في users/{uid}/private/profile (خاص)، والقواعد تقبله مساوياً لبريد الحساب فقط
        await saveProfile(cred.user.uid, {name, photo: '', lastSeen: Date.now()}, cred.user.email || '');
        // توثيق البريد: البلاغات وطلبات الاستلام تشترطه
        await sendEmailVerification(cred.user).catch(e => console.warn(e));
        toast(t('a.welcome', {name}));
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
    } catch (e){ formErr(form, authErr(e) || t('a.loginFail')); }
    finally { busy(form, false); }
    return;
  }

  if (kind === 'setup'){
    if (!S.uid) return;
    busy(form, true);
    try {
      const b = dbx.batch();
      b.set(dbx.ref('config/app'), {ownerUid: S.uid, appName: SETTINGS.appName, createdAt: Date.now()});
      b.set(dbx.ref('admins/' + S.uid), {role: 'owner', addedAt: Date.now()});
      await b.commit();
      const {id, ...office} = SETTINGS.firstOffice;
      await dbx.set('offices/' + id, {...office, active: true, createdAt: Date.now()});
      if (fd.get('samples')){
        const rows = (await load('sample')).sampleItems(id, office.code);
        // v14 (H19): كل غرض جديد يبدأ «متاحاً» بلا حجز ولا تسليم (القواعد تفرضه)، ومعه مدة حفظه
        const b2 = dbx.batch(); rows.forEach(s => { const {returnedAt, ...d} = s.data;
          b2.set(dbx.ref('items/' + s.id), {...d, status: 'available', public: pubFlag(d.cat), keepUntil: keepUntilOf(d.cat, office, d.foundDate)}); }); await b2.commit();
        const b3 = dbx.batch(); rows.forEach(s => b3.set(dbx.ref('itemSecrets/' + s.id), s.secret)); await b3.commit();
      }
      S.mode = 'visitor'; LS.set('mode', 'visitor');
      toast(t('a.setupDone'));
      setOffice(id, true);
    } catch (e){
      console.warn(e);
      formErr(form, String(e?.code || '').includes('permission-denied') ? t('a.setupDenied') : t('a.setupFail'));
    } finally { busy(form, false); }
    return;
  }

  if (kind === 'claim'){
    // H11: طلب مجمّع بالوصف (بلا غرض): التصنيف من النموذج، والمكتب الحالي (أو مكتب الطلب عند التعديل)
    const gcat = form.dataset.gcat || '';
    const i = gcat ? null : item(form.dataset.id);
    // G3: «تعديل الطلب»: الطلب نفسه ما دام قيد المراجعة ولم يُسأل صاحبه
    const ed = form.dataset.edit ? S.myClaims.find(c => c.id === form.dataset.edit) : null;
    if (form.dataset.edit && !claimEditable(ed)) return formErr(form, t('cl.noEdit'));
    // المتاح والمحجوز يقبلان الطلب (المحجوز: طلب منافس يراجعه المكتب قبل التسليم)
    if (gcat ? !isGrouped(gcat) : (!i || !ACTIVE.includes(i.status))) return formErr(form, t('cl.unavailable'));
    const catId = gcat || i.cat, officeId = i?.officeId || ed?.officeId || S.officeId;
    if (!S.verified) return formErr(form, t('a.verifyFirst'));
    // هوية صاحب الطلب: الاسم كما في البطاقة وآخر 4 أرقام منها (يطابقها الموظف عند التسليم)
    if (val('claimantName').length < 3) return formErr(form, t('a.needClaimantName'), 'claimantName');
    const last4 = latinDigits(val('idLast4'));
    if (!/^\d{4}$/.test(last4)) return formErr(form, t('a.needLast4'), 'idLast4');
    // أسئلة التصنيف: الإجبارية منها (مثل المبلغ للنقود)، والماركة للجوالات
    const q = claimOf(catId), {details, missing, missingKey} = readDetails(form, catId, 'claim');
    if (q.req.includes('brand') && !val('brand')) return formErr(form, t('a.needDetail', {label: t('if.brand')}), 'brand');
    if (missing) return formErr(form, t('a.needDetail', {label: missing}), missingKey);
    // الإثبات الحر: إجباري إلا في التصنيفات التي فيها سؤال إجباري («تفاصيل أخرى تثبت أنه لك»)
    if (!claimHasRequired(catId) && val('proof').length < 15) return formErr(form, t('a.proofShort'), 'proof');
    if (!fd.get('pledge')) return formErr(form, t('a.needPledge'), 'pledge');
    if (ed){
      // الحقول التي يعدّلها صاحب الطلب فقط (القواعد لا تقبل غيرها) + وقت التعديل
      busy(form, true);
      const ok = await write(() => dbx.update('claims/' + ed.id, {proof: val('proof').slice(0, 1200), details,
        color: q.fields.includes('color') ? val('color') : '', brand: q.fields.includes('brand') ? val('brand').slice(0, 40) : '',
        claimantName: val('claimantName').slice(0, 120), idLast4: last4, lostSpot: val('spot'), bldg, room, lostDate: val('lostDate'), editedAt: Date.now()}), t('a.claimEdited'));
      busy(form, false); if (ok){ S.hist = []; go('mine', {}, false); }
      return;
    }
    // طلب واحد فقط لكل مستخدم على كل غرض: رقم الطلب ثابت = رقم الغرض_رقم المستخدم
    // H11: المجمّع: g_<المستخدم>_<التصنيف>_<وقت الإنشاء> (القواعد تفرض هذا الشكل)، وطلب جارٍ واحد لكل تصنيف
    const createdAt = Date.now();
    const id = gcat ? `g_${S.uid}_${gcat}_${createdAt}` : `${i.id}_${S.uid}`;
    const dup = t('cl.already');
    if (gcat ? S.myClaims.some(c => c.grouped && c.cat === gcat && c.officeId === officeId && ['pending', 'approved'].includes(c.status)) : S.myClaims.some(c => c.id === id)) return formErr(form, dup);
    busy(form, true);
    if (!gcat && await dbx.get('claims/' + id).catch(() => null)){ busy(form, false); return formErr(form, dup); }
    // v7: حدود «الصيد» على الجهاز أولاً (القواعد تفرضها أيضاً): 3 طلبات جارية، وطلب واحد لكل تصنيف كل 24 ساعة
    if (S.myClaims.filter(c => ['pending', 'approved'].includes(c.status)).length >= CLAIM_MAX_OPEN){ busy(form, false); return formErr(form, t('cl.quotaFull', {n: CLAIM_MAX_OPEN})); }
    if (S.myClaims.some(c => (c.createdAt || 0) > Date.now() - CLAIM_CAT_MS && (c.cat || item(c.itemId)?.cat) === catId)){ busy(form, false); return formErr(form, t('cl.quotaCat', {cat: esc(catName(catId))})); }
    // H20: الحصة على الخادم (claimQuota) تحسب الطلب المسحوب أو المحذوف أيضاً، فنقرؤها ونعرض الموعد بدل رفض غامض
    const quota = await dbx.get('claimQuota/' + S.uid).catch(() => null);
    const lastRaw = quota?.lastByCat?.[catId];
    const lastMs = typeof lastRaw?.toMillis === 'function' ? lastRaw.toMillis() : Number(lastRaw) || 0;
    if (lastMs && Date.now() - lastMs < CLAIM_CAT_MS){ busy(form, false); return formErr(form, t('cl.quotaCatAt', {cat: esc(catName(catId)), when: when(lastMs + CLAIM_CAT_MS)})); }
    // v7: مكتب يشترط بريد الكلية
    if (!claimEmailOk(S.offices.find(o => o.id === officeId), S.me?.email)){ busy(form, false); return formErr(form, t('cl.domainNeed')); }
    const proofs = (FORM.proofs || []).slice(0, 2);
    // v9: رمز 8 أحرف؛ بصمته في claimCodes (لا يقرؤها أحد) تُنشأ مع الطلب، والطلب نفسه بلا codeHash
    const code = genCode(); const codeHash = await sha(id + ':' + code);
    LS.set('codes', {...LS.get('codes', {}), [id]: code});
    try {
      // خانات التصنيف فقط (الوثائق والنقود بلا لون ولا ماركة)، وإجابات أسئلته في details
      // رقم الطلب القصير يظهر للمستخدم والموظف، ويُبحث به في تبويب الاستلام
      // H7: مع حدّ الإغراق (rate/{uid} في العملية نفسها)
      await createLimited('claims/' + id, {itemId: i?.id || '', officeId, uid: S.uid, no: 'REQ-' + refCode(4), proof: val('proof').slice(0, 1200), details,
        ...(gcat ? {grouped: true, cat: gcat} : {}),
        color: q.fields.includes('color') ? val('color') : '', brand: q.fields.includes('brand') ? val('brand').slice(0, 40) : '',
        claimantName: val('claimantName').slice(0, 120), idLast4: last4,
        lostSpot: val('spot'), bldg, room, lostDate: val('lostDate'),
        ...(val('reportId') ? {reportId: val('reportId').slice(0, 100)} : {}),
        ...(proofs.length ? {proofs: proofs.length} : {}),
        status: 'pending', createdAt},
        // v7: في العملية نفسها: الحصة (قائمة الطلبات الجارية ووقت آخر طلب في هذا التصنيف) وصور الإثبات
        (b, ref) => {
          b.set(ref('claimQuota/' + S.uid), {open: arrayUnion(id), lastByCat: {[catId]: serverTimestamp()}}, {merge: true});
          b.set(ref('claimCodes/' + id), {uid: S.uid, hash: codeHash});
          // H20: نسخة الرمز في سجلك الخاص في العملية نفسها (لا يُحفظ رمز لطلب لم يُنشأ)
          b.set(ref('users/' + S.uid + '/private/codes'), {codes: {[id]: code}}, {merge: true});
          proofs.forEach((data, k) => b.set(ref(`claimProofs/${id}_${k}`), {claimId: id, officeId, uid: S.uid, data, createdAt: Date.now()}));
        });
    } catch (e){
      console.warn(e); busy(form, false);
      if (e?.msg) return formErr(form, e.msg);   // «انتظر قليلاً ثم أعد المحاولة»
      return formErr(form, String(e?.code || '').includes('permission-denied')
        ? t('a.claimDenied')
        : t('a.claimFail'));
    }
    busy(form, false); toast(t(gcat ? (isHiddenCat(catId) ? 'gc.sentHidden' : 'gc.sent') : 'a.claimSent')); S.hist = []; go('mine', {}, false);
    return;
  }

  if (kind === 'report' || kind === 'item'){
    const catId = val('cat');
    if (!catId) return formErr(form, t('a.needCat'));
    if (!val('title')) return formErr(form, t('a.needTitle'));
    // G3: اسم واضح: 3 أحرف على الأقل بعد حذف المسافات
    if (val('title').replace(/\s+/g, '').length < 3) return formErr(form, t('a.titleShort'));
    // الموظف يسجّل إجابات الأسئلة الإجبارية للتصنيف (مثل المبلغ للنقود) ليقارنها بما يقوله صاحب الطلب
    if (kind === 'item'){ const {missing, missingKey} = readDetails(form, catId, 'item'); if (missing) return formErr(form, t('a.needDetail', {label: missing}), missingKey); }
    const sens = cat(catId).sensitive;
    busy(form, true);

    if (kind === 'report'){
      // H16: احتياط: لا بلاغ عادي لتصنيف مخفي (النقود)؛ بلاغه بالتفاصيل يطابقه الموظف
      if (!form.dataset.id && isHiddenCat(catId)){ busy(form, false); go('gclaim', {cat: catId}); return; }
      if (!S.verified){ busy(form, false); return formErr(form, t('a.verifyFirst')); }
      if (form.dataset.id) return saveReportEdit(form, val, catId, sens, bldg, room);
      const id = dbx.newId('reports');
      const withPhoto = !!FORM.photo && !sens;
      // إجابات أسئلة التصنيف (اختيارية) تُحفظ لتعبئة طلب الاستلام منها لاحقاً
      const {details} = readDetails(form, catId, 'report');
      const ok = await write(() => createLimited('reports/' + id, {officeId: S.officeId, uid: S.uid, cat: catId, sub: val('sub'), color: claimOf(catId).fields.includes('color') ? val('color') : '',
        ...(Object.keys(details).length ? {details} : {}),
        title: val('title'), desc: val('desc'), spot: val('spot'), bldg, room, lostDate: val('lostDate') || today(), photo: false, status: 'open', createdAt: Date.now()}), t('a.reportSaved'));
      if (ok && withPhoto){
        cachePhoto('r_' + id, FORM.photo);
        if (await write(() => dbx.set('reportPhotos/' + id, {data: FORM.photo}))) await write(() => dbx.update('reports/' + id, {photo: true}));
      }
      busy(form, false); if (ok){ S.hist = []; go('mine', {focus: id}, false); }
      return;
    }

    const existing = S.route.params.id ? full(item(S.route.params.id)) : null;
    const id = existing ? existing.id : dbx.newId('items');
    const fromReport = existing ? '' : (form.dataset.report || '');
    const fromFound = existing ? '' : (form.dataset.found || '');   // إشعار تسليم من واجد
    const officeId = existing?.officeId || S.officeId;
    // الصورة الأصلية: المرفوعة الآن، أو صورة البلاغ عند قبوله (ولم يغيّرها الموظف)
    const original = sens ? null : FORM.photo || (FORM.copyFrom ? await getPhoto(FORM.copyFrom) : null);
    const had = !!existing?.photo;
    const removing = had && !original && (sens || FORM.removed);
    const mode = ['clear', 'blur', 'none'].includes(val('photoMode')) ? val('photoMode') : 'blur';
    const photo = !sens && (original || (had && !removing)) ? mode : false;
    // النسخة العامة تُعاد عند صورة جديدة أو تغيير طريقة الظهور (أو ترقية القيمة القديمة true)
    const redo = !!photo && (!!original || existing?.photo !== mode);
    // المستند العام: لا لون ولا وصف ولا مكان عثور ولا مبنى ولا قاعة ولا موضع حفظ (القواعد ترفضها)
    // مكان العثور سري (المرحلة E5): هو جواب «أين فقدته؟» في طلب الاستلام، فلا يراه الزائر
    const data = {
      officeId, ref: existing?.ref || makeRef(curOffice()),
      cat: catId, sub: val('sub'), title: publicTitle(catId, val('sub')),
      foundDate: val('foundDate') || today(), photo: redo ? false : photo,
      status: existing?.status || 'available', createdBy: existing?.createdBy || S.uid, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
      sample: !!existing?.sample,
      public: pubFlag(catId),   // H16: false للنقود (لا يراها الزائر)، والقواعد ترفض غير ذلك
    };
    // v14 (H19): مدة الحفظ تُكتب عند الإنشاء فقط (القواعد تتحقق منها، ولا يغيّرها إلا المدير)
    if (!existing) data.keepUntil = keepUntilOf(catId, curOffice(), data.foundDate);
    /* H10: اللون العام (pubColor) للاقتراح الآلي «قد يكون لك»: فقط حين تظهر الصورة للعامة (واضحة أو مموّهة، والتمويه يُبقي اللون)،
       فهو ظاهر أصلاً ولا يُعدّ دليل ملكية. بلا صورة عامة يبقى اللون سرياً في itemSecrets فقط.
       مع صورة جديدة يُضاف بعد حفظ الصورة العامة (مع photo)، حتى لا يظهر لون بلا صورة إن فشل رفعها */
    const colorOk = claimOf(catId).fields.includes('color') && COLORS.some(c => c.id === val('color'));
    const pubColor = colorOk && (mode === 'clear' || mode === 'blur') ? val('color') : '';
    if (pubColor && photo && !redo) data.pubColor = pubColor;
    if (fromReport) data.fromReport = fromReport;   // ربط الغرض بالبلاغ الذي قُبل
    if (fromFound) data.fromFound = fromFound;      // ربط الغرض بإشعار التسليم
    // v9: التعديل update للحقول التي يعرضها النموذج فقط (لا الحالة ولا الحجز ولا التسليم ولا التصرّف) — انظر editPatch أدناه
    // التفاصيل السرية: لموظفي المكتب فقط
    // اللون والماركة فارغان إن لم يكونا في التصنيف (حتى لا تبقى قيمة قديمة بعد تغيير التصنيف)، وإجابات أسئلته في details
    const q = claimOf(catId), {details} = readDetails(form, catId, 'item');
    const secret = {officeId, title: val('title'), color: q.fields.includes('color') ? val('color') : '', brand: q.fields.includes('brand') ? val('brand').slice(0, 40) : '',
      desc: val('desc'), spot: val('spot'), bldg, room, storage: val('storage'), ...(Object.keys(details).length ? {details} : {})};
    // من سلّم الغرض دون التطبيق (اسمه وآخر 4 أرقام): سري للموظفين، يقارنونه ببيانات صاحب الطلب
    if (val('finderNote')) secret.finderNote = val('finderNote').slice(0, 120);
    for (const k of ['handoverNote', 'disposalNote']) if (existing?.[k]) secret[k] = existing[k];
    // حذف الصورة عند الحاجة يسبق حفظ الغرض
    if (removing){
      await dbx.del('itemPhotos/' + id).catch(e => console.warn(e));
      if (existing.photo !== true) await dbx.del('itemPhotosPrivate/' + id).catch(e => console.warn(e));
      cachePhoto(id, null); cachePhoto('p_' + id, null);
    }
    // الترتيب: items أولاً (القواعد تتحقق من مكتبه)، ثم itemSecrets والصور
    const quick = !!form.dataset.quick;   // H9: الإضافة السريعة (رقم القيد يظهر في نافذة «أضف آخر» بدل الرسالة)
    // v9: الغرض الموجود: batch واحد (update لحقوله العامة المعدّلة + التفاصيل السرية + قيد «تعديل»)
    const editPatch = {cat: data.cat, sub: data.sub, title: data.title, foundDate: data.foundDate, photo: data.photo, pubColor: data.pubColor ?? deleteField()};
    const ok = existing ? await write(() => wf.editItem(existing, editPatch, secret), t('a.itemUpdated'))
      : await write(() => dbx.set('items/' + id, data), quick ? '' : t('a.itemSaved', {ref: data.ref}));
    if (ok && !existing) await write(() => dbx.set('itemSecrets/' + id, secret));
    if (ok && redo){
      // الأصل الواضح للموظفين، ثم النسخة العامة حسب الاختيار: واضحة، أو مموّهة حقاً (24px)، أو لا شيء
      const src = original || await getPhoto(existing?.photo === true ? id : 'p_' + id);
      if (src && (original || existing?.photo === true)){
        cachePhoto('p_' + id, src);
        await write(() => dbx.set('itemPhotosPrivate/' + id, {officeId, data: src}));
      }
      if (src){
        let pub = null;
        try { pub = mode === 'clear' ? src : mode === 'blur' ? await makeBlur(src) : null; } catch (e){ console.warn(e); }
        const saved = pub ? await write(() => dbx.set('itemPhotos/' + id, {data: pub}))
          : mode === 'none' ? await write(() => dbx.del('itemPhotos/' + id)) : false;
        cachePhoto(id, pub);
        if (saved) await write(() => dbx.update('items/' + id, {photo: mode, ...(pubColor && pub ? {pubColor} : {})}));
      }
    }
    busy(form, false);
    if (!ok) return;
    // قيد في سجل الحيازة، ومعه ترشيح الغرض لصاحب البلاغ أو تأكيد استلام إشعار التسليم (batch واحد)
    // H9: مدة الإضافة (من فتح النموذج إلى الحفظ) بالمللي ثانية، تُسجَّل مع قيد الإنشاء لمتوسطها في الإحصاءات
    const ms = existing ? 0 : Math.max(0, Date.now() - (FORM.t0 || Date.now()));
    if (quick){ saveAddPrefs({cat: catId, spot: val('spot')}); LAST_ADD.v = {spot: val('spot'), bldg, room, date: data.foundDate}; }
    if (existing){ back(); return; }   // قيد «تعديل» كُتب مع التعديل نفسه (wf.editItem)
    const linked = await write(() => wf.itemSaved({...data, id}, {created: true, fromReport, fromFound, ms}),
      fromReport ? t('a.reportAccepted') : fromFound ? t('hi.receivedToast') : '');
    // بريد اختياري (EmailJS): لصاحب البلاغ بأن المكتب رشّح له غرضاً، وللواجد بأن المكتب استلم ما وجده
    if (linked && fromReport) emailUser(S.reports.find(r => r.id === fromReport)?.uid);
    if (linked && fromFound) emailUser(S.found.find(f => f.id === fromFound)?.uid);
    // المطابقة على جهة الموظف تشمل التفاصيل السرية
    // البلاغات القديمة (أكثر من 60 يوماً دون تجديد) لا تدخل في المطابقة
    const matches = S.reports.filter(r => r.status === 'open' && !isStale(r) && r.id !== fromReport && matchScore(r, {...data, ...secret, id}) >= MATCH_MIN);
    S.hist = []; S.staffTab = fromReport || fromFound ? 'reports' : 'items'; go('staff', {}, false);
    if (matches.length) openSheet(`${quick ? `<p class="muted">${icon('check')} ${t('if.savedTitle', {ref: esc(data.ref)})}</p>` : ''}<h2>${icon('bell')} ${t('a.matchesTitle', {reports: tp('n.matchReports', matches.length)})}</h2>
      <div class="list">${matches.map(r => `<div class="box"><b>${esc(r.title)}</b><span class="meta">${esc(catName(r.cat))} · ${esc(colorName(r.color))} · ${t('st.lostOn', {date: relDay(r.lostDate)})}</span>${r.desc ? `<div class="proof">${esc(r.desc)}</div>` : ''}</div>`).join('')}</div>
      <p class="muted">${t('a.matchesHint')}</p>
      <div class="btn-row"><button class="btn" data-act="pickAll" data-i="${esc(id)}" data-rs="${esc(matches.map(r => r.id).join(','))}">${icon('check')}${t('a.pickAll')}</button><button class="btn ghost" data-act="closeSheet">${t('a.later')}</button></div>
      ${quick ? `<button class="btn soft block" data-act="addAgain">${icon('plus')}${t('if.addAgain')}</button>` : ''}`);
    // H9: بعد الحفظ: «أضف آخر» يفتح الكاميرا مباشرة ويبقي المكان والتاريخ
    else if (quick) openSheet(`<h2>${icon('check')} ${t('if.savedTitle', {ref: esc(data.ref)})}</h2>
      <p class="muted">${t('if.savedHint')}</p>
      <div class="btn-row"><button class="btn" data-act="addAgain">${icon('plus')}${t('if.addAgain')}</button><button class="btn ghost" data-act="closeSheet">${t('if.done')}</button></div>`);
    return;
  }

  // دعوة موظف (الإدارة): البريد بأحرف صغيرة معرّفاً، ومكتب واحد على الأقل
  if (kind === 'invite'){
    const email = val('email').toLowerCase(), offices = fd.getAll('offices').map(String);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return formErr(form, t('inv.badEmail'), 'email');
    if (!offices.length) return formErr(form, t('a.needOffice'));
    busy(form, true);
    const ok = await write(() => wf.inviteStaff(email, offices), t('inv.sent'));
    busy(form, false); if (ok) form.reset();
    return;
  }

  if (kind === 'office'){
    if (!val('name')) return formErr(form, t('a.needOrg'));
    const code = val('code').toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length < 2) return formErr(form, t('a.badCode'));
    const id = form.dataset.id || dbx.newId('offices'); const old = S.offices.find(o => o.id === form.dataset.id);
    const data = {name: val('name'), short: val('short'), type: val('type'), city: val('city'), code, place: val('place'), hours: val('hours'), phone: val('phone'),
      retentionDays: Math.max(7, Math.min(365, parseInt(val('retentionDays'), 10) || 90)),
      pickupDays: Math.max(1, Math.min(60, parseInt(val('pickupDays'), 10) || 7)),
      // مدة مراجعة الطلب بأيام العمل (تظهر في بطاقة خدمة الاستلام)
      reviewDays: Math.max(1, Math.min(30, parseInt(val('reviewDays'), 10) || 2)),
      spots: val('spots').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40),
      active: old ? old.active !== false : true, createdAt: old?.createdAt || Date.now()};
    // v7: نطاقات بريد الكلية لطلب الاستلام (فارغة = بلا قيد)، والنمط المحسوب منها الذي تتحقق به القواعد
    const doms = [...new Set(val('claimDomains').split(/[\s,\u060C]+/).map(cleanDomain).filter(Boolean))].slice(0, 5);
    if (val('claimDomains').trim() && !doms.length) return formErr(form, t('of.domainsBad'), 'claimDomains');
    data.claimDomains = doms; data.claimDomainRe = domainRe(doms);
    // الأسماء بالإنجليزية (اختيارية): الفارغ يعني «اعرض العربي». أماكن spotsEn بنفس ترتيب spots
    for (const k of ['nameEn', 'shortEn', 'cityEn', 'placeEn', 'hoursEn']) data[k] = val(k);
    const en = val('spotsEn').split('\n').map(s => s.trim()).slice(0, data.spots.length);
    data.spotsEn = en.some(Boolean) ? en : [];
    busy(form, true);
    const ok = await write(() => dbx.set('offices/' + id, data), t('a.officeSaved'));
    busy(form, false); if (ok){ S.adminTab = 'offices'; S.hist = []; go('admin', {}, false); }
    return;
  }

  if (kind === 'verify'){
    // v9: الرمز 8 أحرف (XXXX-XXXX) أو 6 أرقام للطلبات القديمة؛ يُطبَّع ويُرسل للخادم، والقواعد تتحقق من بصمته
    const c = S.claims.find(x => x.id === form.dataset.id); const code = normPickup(val('code'));
    if (!c) return;
    if (code.length !== 8 && !/^\d{6}$/.test(code)) return formErr(form, t('a.code8'));
    // هوية المستلم الفعلي: «طابقتُ البطاقة» إلزامية، والاسم وآخر 4 أرقام (قد يكون مفوّضاً عن صاحب الطلب)
    if (!fd.get('matched')) return formErr(form, t('a.needMatched'));
    if (val('rname').length < 3 || !/^\d{4}$/.test(val('rlast4'))) return formErr(form, t('wf.needReceiver'));
    busy(form, true);
    // التسليم فقط للطلب الذي حُجز له الغرض، وتُغلق بقية طلباته في العملية نفسها
    let res = null; const it = item(c.itemId);   // قبل التسليم: الغرض المُسلَّم يخرج من قائمة النشطة
    // v7: فحوص التسليم حسب التصنيف: كلها معلّمة، وتُحفظ مفاتيحها في السجل
    const checks = fd.getAll('hc').map(String), need = handoverChecks(it?.cat);
    if (!need.every(k => checks.includes(k))){ busy(form, false); return formErr(form, t('ho.needAll')); }
    // H19: سبب الرفض يظهر داخل النافذة (رمز خاطئ، أو الطلب ليس مقبولاً، أو محجوز لغيره، أو صلاحية)
    let wrong = '';
    const ok = await write(async () => {
      try { res = await wf.verifyHandover(c, {name: val('rname'), last4: val('rlast4')}, need, code); }
      catch (e){ if (e?.msg){ wrong = e.msg; return; } throw e; }
    }, '');
    busy(form, false);
    if (wrong) return formErr(form, wrong, wrong === t('a.codeWrong') ? 'code' : undefined);
    if (!ok) return;
    toast(t('a.handedOver'));
    emailFinder(it);
    closeSheet(); refreshCounts(); ownNotice(res); return;
  }

  if (kind === 'delAccount'){
    const user = auth.currentUser; if (!user) return;
    busy(form, true);
    // 1) إعادة التحقق من هويتك: Firebase يشترط دخولاً حديثاً قبل حذف الحساب
    try {
      if (user.providerData.some(p => p.providerId === 'password')){
        const pass = String(fd.get('password') || '');
        if (!pass){ busy(form, false); return formErr(form, t('a.needPassDel')); }
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pass));
      } else await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } catch (e){ busy(form, false); return formErr(form, authErr(e) || t('a.reauthFail')); }
    try {
      // 2) لا نحذف إن كان هناك طلب مقبول بانتظار الاستلام (الغرض محجوز له في المكتب)
      const claims = await dbx.list('claims', [['uid', '==', user.uid]]);
      if (claims.some(c => c.status === 'approved')){ busy(form, false); return formErr(form, t('a.delHasApproved')); }
      // 3) حذف البيانات: الصورة قبل البلاغ (ترتيب تشترطه القواعد)، ثم الطلبات، ثم الملف الشخصي
      const reports = await dbx.list('reports', [['uid', '==', user.uid]]);
      for (const r of reports){ if (r.photo) await dbx.del('reportPhotos/' + r.id).catch(() => {}); await dbx.del('reports/' + r.id); }
      // الطلبات المنتهية تبقى سجلاً للمكتب بلا بيانات شخصية، وقيد المراجعة يُحذف
      for (const c of claims){
        // الاسم وآخر 4 أرقام وملاحظة التسليم تُمسح أيضاً (القواعد تسمح بذلك)
        if (['done', 'rejected', 'expired', 'cancelled'].includes(c.status)) await dbx.update('claims/' + c.id, {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '',
          ...(c.answer ? {answer: ''} : {}), ...(c.claimantName ? {claimantName: ''} : {}), ...(c.idLast4 ? {idLast4: ''} : {}), ...(c.handoverNote ? {handoverNote: ''} : {}), ...(c.details ? {details: {}} : {}), ...(c.ratingNote ? {ratingNote: ''} : {}), anonymizedAt: Date.now()});
        else if (c.status === 'pending'){
          // v7: الطلب قيد المراجعة يُحذف مع صور إثباته، ويُزال من حصة الطلبات الجارية، في عملية واحدة
          // v9: بعد سؤال الموظف أو موافقة أولى لا يُحذف: يُلغى، ثم تُمسح بياناته الشخصية كالمنتهي
          await wf.withdrawClaim(c);
          if (!wf.canDeleteOwnClaim(c)) await dbx.update('claims/' + c.id, {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '',
            ...(c.answer ? {answer: ''} : {}), ...(c.claimantName ? {claimantName: ''} : {}), ...(c.idLast4 ? {idLast4: ''} : {}), ...(c.details ? {details: {}} : {}), anonymizedAt: Date.now()});
        }
      }
      // إشعارات التسليم: المستلَم يبقى سجلاً للمكتب بلا بيانات صاحبه، والبقية تُحذف
      const found = await dbx.list('foundReports', [['uid', '==', user.uid]]);
      for (const f of found){
        if (f.status === 'received') await dbx.update('foundReports/' + f.id, {uid: 'deleted', note: ''});
        else await dbx.del('foundReports/' + f.id);
      }
      await dbx.del('users/' + user.uid + '/private/codes');
      await dbx.del('users/' + user.uid + '/private/profile').catch(() => {});   // H18: البريد الخاص
      await dbx.del('rate/' + user.uid).catch(() => {});   // H7: وقت آخر إنشاء (تسمح القواعد بحذفه بعد 20 ثانية)
      await dbx.del('staffRequests/' + user.uid).catch(() => {});
      await dbx.del('users/' + user.uid);
      // 4) حذف الحساب نفسه من Firebase Authentication
      await deleteUser(user);
    } catch (e){
      console.warn(e); busy(form, false);
      return formErr(form, String(e?.code || '').includes('permission-denied') ? t('a.delDenied') : t('a.delFail'));
    }
    LS.set('codes', {}); LS.set('seen', []); LS.set('staffSeen', null); LS.set('notify', false); LS.set('mode', 'visitor');
    S.mode = 'visitor'; S.hist = []; S.route = {name: 'home', params: {}};
    closeSheet(); renderAll(); toast(t('a.deleted'));
    return;
  }

  // إشعار تسليم: من وجد غرضاً يسجّله قبل أن يسلّمه للمكتب
  if (kind === 'handin'){
    const catId = val('cat');
    if (!catId) return formErr(form, t('a.needCat'));
    if (!S.verified) return formErr(form, t('a.verifyFirst'));
    busy(form, true);
    const id = dbx.newId('foundReports');
    // كود قصير يُريه الواجد لموظف المكتب فيفتح إشعاره مباشرة (بحروف رقم القيد نفسها)
    const code = refCode(6);
    const ok = await write(() => createLimited('foundReports/' + id, {officeId: S.officeId, uid: S.uid, cat: catId, sub: val('sub'), spot: val('spot'), bldg, room,
      foundDate: val('foundDate') || today(), note: val('note').slice(0, 500), code, status: 'pending', createdAt: Date.now()}), t('hi.sent'));
    busy(form, false); if (ok){ S.hist = []; go('mine', {focus: id}, false); }
    return;
  }
  // قياس الرضا: تقييم الطلب المكتمل مرة واحدة (القواعد تمنع التقييم الثاني)
  if (kind === 'rate'){
    const c = S.myClaims.find(x => x.id === form.dataset.id); if (!c || c.status !== 'done' || c.rating) return;
    const rating = parseInt(val('rating'), 10);
    if (!(rating >= 1 && rating <= 5)) return formErr(form, t('rt.need'));
    busy(form, true);
    const ok = await write(() => dbx.update('claims/' + c.id, {rating, ratingNote: val('ratingNote').slice(0, 300), ratedAt: Date.now()}), t('rt.thanks'));
    busy(form, false); if (!ok) return;
    return;
  }
  // قبول طلب فيه تضارب مصالح: السبب إلزامي، ويُحفظ في note والسجل
  // H17: قبول بلاغ النقود مباشرة: المبلغ المؤكَّد وتاريخ العثور والإقرار، ثم غرض جديد مربوط ومقبول (workflow.approveCashDirect)
  if (kind === 'cashApprove'){
    const c = S.claims.find(x => x.id === form.dataset.id); if (!c) return;
    const amount = detailValue({type: 'num'}, val('amount'));
    if (!amount || Number(amount) <= 0) return formErr(form, t('wf.cashAmount'), 'amount');
    if (!fd.get('matched')) return formErr(form, t('ca.needPledge'));
    busy(form, true);
    const ok = await write(() => wf.approveCashDirect(c, {amount, foundDate: val('foundDate')}), t('a.approved'));
    busy(form, false);
    if (ok){ closeSheet(); emailUser(c.uid); }
    return;
  }
  if (kind === 'approveWhy'){
    const c = S.claims.find(x => x.id === form.dataset.id); if (!c) return;
    if (val('reason').length < 10) return formErr(form, t('a.needReason'));
    busy(form, true);
    const ok = await doApprove(c, val('reason'));
    busy(form, false); if (ok) closeSheet();
    return;
  }
  // البحث بكود إشعار التسليم (تبويب البلاغات عند الموظف)
  if (kind === 'findCode'){
    const code = normCode(val('code'));
    if (code.length !== 6) return toast(t('hi.codeBad'));
    const f = S.found.find(x => normCode(x.code) === code);
    if (!f) return toast(t('hi.codeNone'));
    openSheet(`<h2>${icon('tag')} ${t('hi.codeFound')}</h2><div class="list">${SM().foundCardStaff(f)}</div><button class="btn ghost" data-act="closeSheet">${t('c.close')}</button>`);
    return;
  }
  // سؤال تحقق يرسله الموظف لصاحب طلب قيد المراجعة
  if (kind === 'ask'){
    const c = S.claims.find(x => x.id === form.dataset.id); if (!c) return;
    busy(form, true);
    const ok = await write(() => wf.askQuestion(c, val('question')), t('qa.sent'));
    busy(form, false); if (ok){ closeSheet(); emailUser(c.uid); }
    return;
  }
  // إجابة صاحب الطلب عن سؤال التحقق (القواعد تسمح بها ما دام الطلب قيد المراجعة)
  if (kind === 'answer'){
    const c = S.myClaims.find(x => x.id === form.dataset.id); if (!c) return;
    if (val('answer').length < 2) return formErr(form, t('qa.needAnswer'));
    busy(form, true);
    const ok = await write(() => dbx.update('claims/' + c.id, {answer: val('answer').slice(0, 1000), answeredAt: Date.now()}), t('qa.answerSent'));
    busy(form, false); if (ok) closeSheet();
    return;
  }

  if (kind === 'reject'){
    const c = S.claims.find(x => x.id === form.dataset.id); if (!c) return;
    busy(form, true);
    // إن كان مقبولاً والغرض محجوزاً له، يعود الغرض متاحاً في العملية نفسها
    const ok = await write(() => wf.rejectClaim(c, val('note')), t('a.claimRejected'));
    busy(form, false); if (ok){ closeSheet(); emailUser(c.uid); } return;
  }

  // تسليم مباشر في المكتب دون طلب: ملاحظة التسليم تُحفظ في التفاصيل السرية
  if (kind === 'handover'){
    const i = item(form.dataset.id); if (!i) return;
    // تُخزَّن بالعربية (ملاحظة سرية للموظفين في قاعدة البيانات)
    const note = tAr('sys.handoverNote', {name: val('name'), last4: val('last4')});
    if (!val('name') || !/^\d{4}$/.test(val('last4'))) return formErr(form, t('a.needHandover'));
    busy(form, true);
    let res = null;
    const ok = await write(async () => { res = await wf.setItemStatus(i, 'returned', note); }, t('a.handoverSaved'));
    busy(form, false); if (ok){ closeSheet(); refreshCounts(); ownNotice(res); emailFinder(i); }
    return;
  }

  // التصرّف في الأغراض التي تجاوزت مدة الحفظ
  if (kind === 'dispose'){
    const method = val('method');
    if (!wf.DISPOSAL[method]) return formErr(form, t('wf.pickMethod'));
    const ids = fd.getAll('ids').map(String);
    if (!ids.length) return formErr(form, t('a.needItems'));
    busy(form, true);
    let n = 0;
    const ok = await write(async () => { n = await wf.disposeItems(ids.map(item).filter(Boolean), method, val('note')); });
    busy(form, false); if (ok){ closeSheet(); toast(t('a.disposed', {items: tp('n.itemGen', n)})); }
    return;
  }
}

/* ---------- الأزرار ---------- */
let PENDING_CONFIRM = null;
// نافذة تأكيد. danger=false لزر عادي غير أحمر
function confirmSheet(title, text, yes, fn, danger = true){
  PENDING_CONFIRM = fn;
  openSheet(`<h2>${title}</h2><p class="muted">${esc(text)}</p><div class="btn-row"><button class="btn ${danger ? 'danger' : ''}" data-act="confirmYes">${icon(danger ? 'trash' : 'check')}${esc(yes)}</button><button class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>`);
}
/* H13a: طلب على غرض لم يعد متاحاً: رسالة بحالته الفعلية (حُذف، سُلّم، أُرشف، تُصرّف فيه) وزر «إغلاق الطلب» */
function orphanSheet(c, i){
  openSheet(`<h2>${icon('alert')} ${t('st.orphanTitle')}</h2>
    <div class="note warn">${icon('info')}<span>${orphanText(i)}</span></div>
    <p class="muted">${t('st.orphanHint')}</p>
    <div class="btn-row"><button class="btn" data-act="closeOrphan" data-id="${esc(c.id)}">${icon('x')}${t('st.orphanClose')}</button><button class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>`);
}
// إنهاء طلب يتيم: «منتهٍ» بملاحظة «الغرض لم يعد متاحاً»، ثم بريد عام لصاحبه
async function closeOrphanClaim(c){
  const ok = await write(() => wf.closeOrphan(c), t('st.orphanClosed'));
  if (ok) emailUser(c.uid);
  return ok;
}
// طلب الموظف نفسه على الغرض لا يعدّله هو (فصل المهام)، فننبّهه
function ownNotice(res){ if (res?.skippedOwn) setTimeout(() => toast(t('a.ownOpen')), 2900); }
// حذف صور الغرض وتفاصيله السرية (قبل حذف الغرض نفسه). القواعد ترفض حذف مستند غير موجود، لذلك نحذف الموجود فقط.
async function delItemParts(i){
  const quiet = e => console.warn(e);
  if (pubPhoto(i)) await dbx.del('itemPhotos/' + i.id).catch(quiet);
  if (['clear', 'blur', 'none'].includes(i.photo)) await dbx.del('itemPhotosPrivate/' + i.id).catch(quiet);
  await dbx.del('itemSecrets/' + i.id).catch(quiet);
  cachePhoto(i.id, null); cachePhoto('p_' + i.id, null);
}
const needLogin = () => { if (S.uid) return false; go('login', {next: S.route}); return true; };
// القبول ثم بريد اختياري لصاحب الطلب. reason: سبب القبول (تضارب المصالح)
async function doApprove(c, reason = ''){
  // H14: القبول بموظف واحد لكل التصنيفات
  const ok = await write(() => wf.approveClaim(c, {reason}));
  if (ok){ toast(t('a.approved')); emailUser(c.uid); }
  return ok;
}
// تسجيل الخروج على جهاز مشترك: نمسح رموز الاستلام والتنبيهات المقروءة وتفعيل الإشعارات من المتصفح،
// ونسخة Firestore المحفوظة (IndexedDB)، ثم نعيد تحميل الصفحة حتى لا يبقى شيء من بيانات الحساب في الذاكرة
function wipeDevice(){ ['codes', 'seen', 'staffSeen', 'notify'].forEach(k => { try { localStorage.removeItem('mfq:' + k); } catch {} }); }

const ACT = {
  nav(el){
    const r = el.dataset.r, tab = el.dataset.tab;
    if (r === 'staff' && tab){ S.staffTab = tab; if (S.route.name === 'staff'){ SM()?.updateStaff(); renderNav(); window.scrollTo(0, 0); return; } }
    if (r === 'admin' && tab) S.adminTab = tab;
    const fromNav = !!el.closest('#nav, .top-links, .brand');
    if (fromNav) S.hist = [];
    if (r === 'add') AGAIN.v = null;   // H9: غرض جديد من البداية (آخر تصنيف ومكان فقط)
    go(r, el.dataset.id ? {id: el.dataset.id} : {}, !fromNav);   // data-id: مثل بطاقة خدمة محددة (service)
    if (fromNav && r !== homeRoute()) tabEntry();
  },
  back(){ back(); },
  login(){ go('login', {next: S.route.name === 'login' ? null : S.route}); },
  loginMode(el){ go('login', {...S.route.params, mode: el.dataset.v}, false); },
  async google(){
    const p = new GoogleAuthProvider();
    try { await signInWithPopup(auth, p); }
    catch (e){
      if (String(e?.code).includes('popup-blocked') || String(e?.code).includes('operation-not-supported')) return signInWithRedirect(auth, p);
      const m = authErr(e); if (m) toast(m);
    }
  },
  async resetPass(){
    const email = String($('#l-email')?.value || '').trim();
    if (!email) return toast(t('a.resetNeedEmail'));
    try { await sendPasswordResetEmail(auth, email); toast(t('a.resetSent')); }
    catch (e){ toast(authErr(e)); }
  },
  // H4: زر «Aa» في الشريط العلوي: المظهر وحجم الخط (كانا في التذييل؛ وما زالا في قائمة الحساب أيضاً)
  displaySheet(){
    openSheet(`<h2>${t('ui.display')}</h2><div class="list">
      <div class="opt-row"><span class="label">${icon('contrast')}${t('th.label')}</span>${themePicker()}</div>
      <div class="opt-row"><span class="label">${icon('info')}${t('tx.label')}</span>${textPicker()}</div></div>`);
  },
  account(){
    openSheet(`<div class="person" style="gap:12px">${safeAvatar(S.me?.photo) ? `<img src="${esc(S.me.photo)}" alt="" referrerpolicy="no-referrer" style="width:44px;height:44px">` : ''}<div><b>${esc(S.me?.name || '')}</b><div class="meta" dir="ltr">${esc(S.me?.email || '')}</div></div></div>
      <div class="list">
        <button class="opt" data-act="nav" data-r="mine">${icon('inbox')}${t('acc.mine')}</button>
        <button class="opt" data-act="lang" lang="${t('lang.otherCode')}">${icon('globe')}${t('foot.lang')}</button>
        ${notifySupported() ? `<button class="opt" data-act="notify" aria-pressed="${notifyOn()}">${icon('bell')}<span class="grow">${t('nt.label')}</span><span class="pill ${notifyOn() ? 'ok' : 'mute'}">${t(notifyOn() ? 'nt.on' : 'nt.off')}</span></button>
          ${notifyDenied() ? `<p class="hint">${t('nt.deniedHint')}</p>` : ''}` : ''}
        <div class="opt-row"><span class="label">${icon('contrast')}${t('th.label')}</span>${themePicker()}</div>
        <div class="opt-row"><span class="label">${icon('info')}${t('tx.label')}</span>${textPicker()}</div>
        <button class="opt" data-act="signOut">${icon('x')}${t('acc.signOut')}</button>
        <p class="hint">${icon('info')}${t('acc.shared')}</p>
        <button class="opt" data-act="nav" data-r="privacy">${icon('lock')}${t('acc.privacy')}</button>
        <button class="opt" data-act="deleteAccount" style="color:var(--bad)">${icon('trash')}${t('acc.delete')}</button>
        <p class="app-ver">${t('ui.version', {v: APP_VERSION})}</p>
      </div>`);
  },
  deleteAccount(){
    // مالك التطبيق ومديروه لا يحذفون حساباتهم من هنا حتى لا يفقد التطبيق إدارته
    if (S.isAdmin) return openSheet(`<h2>${t('acc.delTitle')}</h2><p class="muted">${t('acc.adminNoDel')}</p><button class="btn ghost" data-act="closeSheet">${t('c.ok')}</button>`);
    const pw = auth.currentUser?.providerData.some(p => p.providerId === 'password');
    openSheet(`<h2>${icon('trash')} ${t('acc.delForever')}</h2>
      <p class="muted">${t('acc.delWhat')}</p>
      <form data-form="delAccount" novalidate>
        ${pw ? `<div class="field"><label for="da-pass">${t('acc.passConfirm')}</label><input id="da-pass" name="password" type="password" class="input" dir="ltr" autocomplete="current-password"></div>`
          : `<p class="hint">${t('acc.googleConfirm')}</p>`}
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn danger" type="submit">${icon('trash')}${t('acc.delBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
  },
  async share(el){
    const i = item(el.dataset.id); if (!i) return;
    // رابط مباشر يفتح نفس الغرض: ./#item/<المكتب>/<الغرض>
    const url = location.origin + location.pathname + '#item/' + i.officeId + '/' + i.id;
    const data = {title: t('share.title', {title: showTitle(i)}), text: t('share.text', {title: showTitle(i), ref: i.ref}), url};
    if (navigator.share){ try { await navigator.share(data); return; } catch (e){ if (e?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast(t('share.copied')); }
    catch { openSheet(`<h2>${icon('share')} ${t('share.link')}</h2><input class="input share-url" dir="ltr" readonly value="${esc(url)}"><button class="btn ghost" data-act="closeSheet">${t('c.close')}</button>`); }
  },
  rmProofs(el){ FORM.proofs = []; const f = el.closest('form'); f.querySelector('#proof-pv').innerHTML = ''; const inp = f.querySelector('#proof-in'); if (inp) inp.value = ''; },
  // v7: «سجّل الدخول ببريد الكلية»: خروج من الحساب الحالي ثم صفحة الدخول بعد إعادة التحميل
  collegeLogin(){ try { sessionStorage.setItem('mfq:thenLogin', '1'); } catch {} ACT.signOut(); },
  async signOut(){
    closeSheet(); S.mode = 'visitor'; LS.set('mode', 'visitor'); S.hist = []; S.route = {name: 'home', params: {}};
    wipeDevice();
    try { await signOut(auth); } catch (e){ console.warn(e); }
    await wipeLocalDb();   // إن فشل (تبويب آخر مفتوح) يكفي مسح localStorage
    wipeDevice();          // مرة ثانية: قد يكتب مستمع قبل إيقاف Firestore
    try { sessionStorage.setItem('mfq:signedOut', '1'); } catch {}
    location.reload();
  },
  pickOffice(){ go('pick'); },
  // المظهر: يُطبَّق فوراً ويُحدَّث الزر المختار دون إعادة رسم
  theme(el){
    setTheme(el.dataset.v);
    el.parentElement.querySelectorAll('button').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  },
  // حجم الخط: يُطبَّق فوراً ويُحفظ على الجهاز
  textSize(el){
    setTextSize(el.dataset.v);
    el.parentElement.querySelectorAll('button').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  },
  // إشعارات المتصفح: تفعيل أو إيقاف
  async notify(el){
    const r = await toggleNotify();
    toast(t('nt.t.' + r));
    if (S.sheet) ACT.account();   // نعيد رسم نافذة الحساب بالحالة الجديدة
  },
  // تبديل اللغة: يُحفظ على الجهاز، وفي users.lang لمن سجّل دخوله (يتبعه على أجهزته الأخرى)
  async lang(){
    closeSheet();
    try { await setLang(LANG === 'ar' ? 'en' : 'ar'); } catch (e){ console.warn(e); return toast(t('err.offline')); }
    if (auth) auth.languageCode = LANG;   // رسائل Firebase (توثيق البريد، استعادة كلمة المرور) بنفس اللغة
    if (S.uid) dbx.set('users/' + S.uid, {lang: LANG}, {merge: true}).catch(e => console.warn(e));
    renderAll(); window.scrollTo(0, 0);
  },
  setOffice(el){ setOffice(el.dataset.id); },
  mode(el){ const m = el.dataset.v; if (!modes().includes(m)) return; S.mode = m; LS.set('mode', m); S.hist = []; go(homeRoute(), {}, false); },
  openItem(el){ go('item', {id: el.dataset.id}); },
  // «هذا غرضي — اطلب استلامه» من ترشيح البلاغ: يُعبّأ الطلب من البلاغ ويُربط به
  goClaim(el){ if (!needLogin()) go('claim', {id: el.dataset.id, ...(el.dataset.report ? {report: el.dataset.report} : {})}); },
  // اختيار عدد النجوم في تقييم الطلب
  rateStar(el){
    const f = el.closest('form'), v = +el.dataset.v; if (!f) return;
    f.querySelector('[name=rating]').value = v; (RATE_DRAFT[f.dataset.id] ||= {}).rating = v;
    f.querySelectorAll('.star').forEach(b => { const on = +b.dataset.v <= v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(+b.dataset.v === v)); });
  },
  /* «ليس غرضي» (G5): على أي غرض مقترح (ترشيح الموظف أو «قد يكون لك»). يختفي فوراً، ويُحفظ بعد 5 ثوانٍ
     ما لم يضغط «تراجع». يُضاف إلى القائمة rejected (تكبر فقط)، فلا يُقترح له مرة أخرى ولا ينبّه، ويراه الموظف */
  notMine(el){
    const r = S.myReports.find(x => x.id === el.dataset.id), id = el.dataset.item; if (!r || !id) return;
    if ((r.rejected || []).length >= 30) return toast(t('rc.rejectFull'));
    const drop = () => { S.rejecting[r.id] = (S.rejecting[r.id] || []).filter(x => x !== id); touch(); };
    (S.rejecting[r.id] ||= []).push(id); touch();
    undoable(t('rc.notMineHidden'), () => write(() => dbx.update('reports/' + r.id, {rejected: arrayUnion(id)})).finally(drop), drop);
  },
  // G3: «تعديل» البلاغ من «طلباتي»، و«تعديل الطلب» ما دام قيد المراجعة بلا سؤال
  editReport(el){ go('report', {id: el.dataset.id}); },
  editClaim(el){ const c = S.myClaims.find(x => x.id === el.dataset.id); if (claimEditable(c)) go('claim', {id: c.itemId, edit: c.id}); },
  // «افتح الطلب»: الانتقال إلى بطاقة الطلب في «طلباتي»
  showClaim(el){
    const c = S.myClaims.find(x => x.id === el.dataset.id);
    openCard('claims', 'c:' + el.dataset.id, ['done', 'rejected', 'expired', 'cancelled'].includes(c?.status));
  },
  /* «طلباتي» (PR 3): تبديل التبويب (يُحفظ على الجهاز)، و«افتح» في «يحتاج انتباهك» ينقل إلى البطاقة ويفتحها */
  mineTab(el){
    LS.set('mineTab', el.dataset.v);
    // H4: النقر على التبويب يسجّل تنبيهاته مقروءة، فتختفي شارته الحمراء (وتبقى مختفية بعد التحديث)
    markSeenKeys(unseenKeys().filter(k => keyTab(k) === el.dataset.v));
    renderAll(); document.getElementById('mt-' + el.dataset.v)?.focus({preventScroll: true});
  },
  // «لاحقاً» في «يحتاج انتباهك»: تختفي المهمة حتى يتغير مفتاحها (حدث جديد)
  // H4: تبويب فرعي للموظف (قراري/الحضور/قادمة/منتهية، ولها مرشّح/مفتوحة/مغلقة): النقر يسجّل جديده مقروءاً
  staffSub(el){
    const g = el.dataset.g, v = el.dataset.v; S.staffSub[g] = v;
    // H5: كل أحداث التبويب تُسجَّل مقروءة (staffSeen)، فيختفي الأحمر وحدود البطاقات الجديدة فوراً
    markStaffSeen(staffKeys().filter(x => x.sub === g + ':' + v).map(x => x.k));
    SM()?.updateStaff(); renderNav(); document.getElementById(`st-${g}-${v}`)?.focus({preventScroll: true});   // H13a: بلا قفزة تحت الترويسة
  },
  attLater(el){ LS.set('snoozed', [...new Set([...LS.get('snoozed', []), el.dataset.k])].slice(-200)); renderAll(); },
  openCard(el){ openCard(el.dataset.tab, el.dataset.card, el.dataset.ended === '1'); },
  fcat(el){ S.filter.cat = el.dataset.id; updateBrowse(); },
  catGo(el){ S.filter.cat = el.dataset.id; S.filter.q = ''; S.filter.status = 'available'; go('browse'); },
  fstatus(el){ S.filter.status = el.dataset.v; updateBrowse(); },
  sTab(el){ S.staffTab = el.dataset.v; SM()?.updateStaff(); renderNav(); },
  closeSheet(){ closeSheet(); },
  copy(el){ const v = el.dataset.v; navigator.clipboard?.writeText(v).then(() => toast(t('a.copied')), () => toast(v)); },
  removePhoto(el){ clearPhoto(el.closest('form')); },
  aiFill(){ if (aiReady()) aiFill(); },
  // H9: الإضافة السريعة: فتح الكاميرا، أو المتابعة بلا صورة، أو «أضف آخر» بعد الحفظ (يبقى المكان والتاريخ)
  // v9: سحب الطلب قيد المراجعة من «طلباتي» (قبل سؤال الموظف يُحذف، وبعده يُلغى)
  withdrawClaim(el){
    const c = S.myClaims.find(x => x.id === el.dataset.id); if (!c || c.status !== 'pending') return;
    confirmSheet(t('cl.withdrawQ'), t(wf.canDeleteOwnClaim(c) ? 'cl.withdrawBody' : 'cl.withdrawCancelBody'), t('cl.withdraw'), () => write(() => wf.withdrawClaim(c), t('cl.withdrawn')), true);
  },
  // H13a: إغلاق طلب يتيم (غرضه غير متاح أو محذوف)، واحد أو كلها من تنبيه «قراري»
  async closeOrphan(el){ const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return; closeSheet(); await closeOrphanClaim(c); },
  closeOrphans(){
    const list = SM()?.orphanClaims?.() || []; if (!list.length) return;
    confirmSheet(t('st.orphansQ', {claims: tp('n.claim', list.length)}), t('st.orphansBody'), t('st.orphansClose'), async () => {
      for (const c of list) await closeOrphanClaim(c);
    });
  },
  // H11: البطاقة المجمّعة في المفقودات: «أثبت أنه لك» يفتح الطلب بالوصف (بعد الدخول)
  gclaim(el){ const cat = el.dataset.cat; if (!S.uid) return go('login', {next: {name: 'gclaim', params: {cat}}}); go('gclaim', {cat}); },
  // H11 (الموظف): ربط الطلب المجمّع بالغرض المختار، أو إرسال سؤال التحقق المقترح بضغطة
  async linkClaim(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return;
    if (await write(() => wf.linkClaim(c, el.dataset.i), t('gc.linked'))) SM()?.updateStaff?.();
  },
  async askSugg(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return;
    await write(() => wf.askQuestion(c, el.dataset.q), t('qa.sent'));
  },
  noPhoto(el){ const f = el.closest('form'); photoState(f, 'none'); focusNext(f); },
  photoPick(el){ const f = el.closest('form'); photoState(f, 'pick'); f.querySelector('.qp-btn input, .qp-btn')?.focus(); },
  // «أضف آخر»: نموذج جديد بالأزرار الثلاثة، يبقى فيه التصنيف والمكان والتاريخ، ولا يُفتح شيء تلقائياً
  addAgain(){ AGAIN.v = LAST_ADD.v; go('add', {}, S.route.name !== 'add'); },
  aiMatch(el){ if (aiReady()) aiMatch(el.dataset.id); },
  // «وجدته بنفسي»: تأكيد أولاً، وتنبيه إن كان المكتب رشّح غرضاً أو ظهر غرض مشابه (فيطلب استلامه بدل الإغلاق)
  closeReport(el){
    const r = S.myReports.find(x => x.id === el.dataset.id); if (!r) return;
    const pickOn = !!pickOf(r);
    const warn = pickOn || suggestFor(r) ? `<div class="note warn">${icon('info')}<span>${t('rc.closeWarn')}</span></div>` : '';
    PENDING_CONFIRM = () => write(() => dbx.update('reports/' + r.id, {status: 'closed', closedAt: Date.now(), closedReason: 'self'}), t('a.reportClosed'));
    openSheet(`<h2>${t('rc.closeQ')}</h2><p class="muted">${t('rc.closeBody')}</p>${warn}
      <div class="btn-row"><button class="btn" data-act="confirmYes">${icon('check')}${t('rc.foundIt')}</button><button class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>`);
  },
  delReport(el){
    confirmSheet(t('a.delReportQ'), t('a.delReportBody'), t('a.delReportBtn'), async () => {
      const r = S.myReports.find(x => x.id === el.dataset.id) || S.reports.find(x => x.id === el.dataset.id);
      if (r?.photo) await write(() => dbx.del('reportPhotos/' + r.id));
      const ok = await write(() => dbx.del('reports/' + el.dataset.id), t('a.reportDeleted'));
      // الحذف من صفحة التعديل: نعود إلى «طلباتي»
      if (ok && S.route.name === 'report'){ S.hist = []; go('mine', {}, false); }
    });
  },
  editItem(el){ go('add', {id: el.dataset.id}); },
  // H2: «المزيد» في لوحة الموظف على الجوال: الملصقات وملصق المكتب والإحصاءات في النافذة السفلية
  staffMore(){
    openSheet(`<h2>${t('st.moreTitle')}</h2><div class="sheet-list">
      <button class="btn ghost block" data-act="labelsMenu">${icon('qr')}${t('lb.menu')}</button>
      <button class="btn ghost block" data-act="poster">${icon('print')}${t('po.btn')}</button>
      <button class="btn ghost block" data-act="stats">${icon('chart')}${t('sx.btn')}</button></div>`);
  },
  // تغيير الحالة يدوياً: متاح، أو سُلّم مباشرة (بملاحظة تسليم)، أو مؤرشف. «محجوز» يأتي من قبول طلب فقط
  itemStatus(el){
    const i = item(el.dataset.id); if (!i) return;
    // v9: التسليم المباشر لغرض ثمين للإدارة فقط (بلا رمز ولا موافقتين)
    // v14 (H19): الأرشفة للمدير، أو بعد انتهاء مدة الحفظ (القواعد تفرضها)
    const opts = ['available', 'returned', 'archived'].filter(k => (k !== 'returned' || wf.canDirectReturn(i)) && (k !== 'archived' || wf.canArchive(i)));
    openSheet(`<h2>${t('a.statusTitle', {ref: esc(i.ref)})}</h2><div class="list">${opts.map(k => `<button class="opt" data-act="setStatus" data-id="${esc(i.id)}" data-v="${k}" ${k === i.status ? 'disabled aria-disabled="true"' : ''}>${pill(ITEM_STATUS, k)}${k === i.status ? `<span class="muted">${t('a.current')}</span>` : ''}</button>`).join('')}</div>
      <p class="hint">${t('a.statusHint', {returned: statusLabel(ITEM_STATUS.returned)})}</p><button class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button>`);
  },
  setStatus(el){
    const i = item(el.dataset.id), to = el.dataset.v; if (!i) return;
    const open = wf.openClaimsOf(i.id).length;
    if (to === 'returned') return openSheet(`<h2>${icon('idcard')} ${t('a.directTitle', {ref: esc(i.ref)})}</h2>
      <form data-form="handover" data-id="${esc(i.id)}" novalidate>
        <div class="field"><label for="ho-name">${t('a.recipient')}</label><input id="ho-name" name="name" class="input" maxlength="80" autocomplete="off"></div>
        <div class="field"><label for="ho-4">${t('a.last4')}</label><input id="ho-4" name="last4" class="input" inputmode="numeric" maxlength="4" dir="ltr"></div>
        ${open ? `<div class="note warn">${icon('info')}<span>${t('a.openOnHandover', {claims: tp('n.openClaims', open)})}</span></div>` : ''}
        <p class="hint">${t('a.handoverPrivate')}</p>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('a.handoverBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
    const run = async () => { let res = null; if (await write(async () => { res = await wf.setItemStatus(i, to); }, t('a.statusUpdated'))){ refreshCounts(); ownNotice(res); } };
    if (to === 'available' && i.status === 'reserved' && S.claims.some(c => c.id === i.reservedFor && c.status === 'approved'))
      return confirmSheet(t('a.reopenQ'), t('a.reopenBody'), t('st.release'), run, false);
    if (to === 'archived' && open) return confirmSheet(t('a.archiveQ'), t('a.archiveBody', {claims: tp('n.openClaims', open)}), t('a.archiveBtn'), run, false);
    closeSheet(); run();
  },
  delItem(el){
    const i = item(el.dataset.id); if (!i) return;
    const open = wf.openClaimsOf(i.id).length;
    confirmSheet(t('a.delItemQ', {ref: esc(i.ref)}), (open ? t('a.delItemOpen', {claims: tp('n.openClaims', open)}) + ' ' : '') + t('a.delItemBody'), t('a.delItemBtn'), async () => {
      // إلغاء الطلبات، ثم الصور والتفاصيل السرية، ثم الغرض نفسه: كلها في batch واحد
      let res = null;
      if (await write(async () => { res = await wf.deleteItem(i); }, t('a.itemDeleted'))){ ownNotice(res); back(); }
    });
  },
  async approve(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return;
    // H11: الطلب المجمّع: الغرض المربوط (claimLinks). H13a: الغرض من الخادم إن لم يكن محمّلاً، ثم فحص حالته
    const iid = claimItemId(c);
    if (!iid){ toast(t('wf.needLink')); return; }
    let i = null;
    try { i = await wf.fetchItem(iid); } catch (e){ console.warn(e); toast(t('err.offline')); return; }
    if (!i || !ACTIVE.includes(i.status)) return orphanSheet(c, i);
    // تضارب مصالح (صاحب الطلب سلّم الغرض أو سجّله): القبول يحتاج سبباً مكتوباً يُحفظ في الطلب والسجل
    const kind = conflictOf(c, full(i));
    if (kind) return openSheet(`<h2>${icon('alert')} ${t('a.conflictTitle')}</h2>
      <div class="note bad">${icon('alert')}<span><b>${t(kind === 'finder' ? 'st.conflictFinder' : 'st.conflictRecorder')}</b></span></div>
      <form data-form="approveWhy" data-id="${esc(c.id)}" novalidate>
        <div class="field"><label for="ap-why">${t('a.conflictWhy')}</label><textarea id="ap-why" name="reason" class="input" maxlength="300" required placeholder="${t('a.conflictPh')}"></textarea></div>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('a.weakBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
    const go2 = () => doApprove(c);
    // تطابق ضعيف: أقل من 2 من 3 في جدول المقارنة
    // تطابق ضعيف: أقل من نصف الصفوف التي لها نتيجة في جدول المقارنة (أو لا شيء يمكن مقارنته)
    const {hits, total} = (SM() || await load('staff')).claimChecks(c, full(i));
    if (!total || hits / total < 0.5) return confirmSheet(t('a.weakQ'), t('a.weakBody', {n: hits, total}), t('a.weakBtn'), go2, false);
    go2();
  },
  // إعادة تفعيل طلب منتهٍ أو ملغى (من سجل الطلبات)
  reactivate(el){
    const c = (S.claimHist || []).find(x => x.id === el.dataset.id); if (!c) return;
    confirmSheet(t('a.reactQ'), t('a.reactBody'), t('st.reactivate'), async () => {
      let to = '';
      if (await write(async () => { to = await wf.reactivateClaim(c); }, t('a.reactDone'))){ if (to === 'approved') emailUser(c.uid); }
    }, false);
  },
  // البلاغ القديم: «نعم، ما زلت أبحث» يجدّد تاريخه (renewedAt)
  renewReport(el){ write(() => dbx.update('reports/' + el.dataset.id, {renewedAt: Date.now()}), t('rc.renewed')); },
  toggleStale(){ S.showStale = !S.showStale; SM()?.updateStaff(); },
  release(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return;
    confirmSheet(t('a.reopenQ'), t('a.releaseBody'), t('st.release'),
      () => write(() => wf.releaseReservation(c), t('a.released')), false);
  },
  // التصرّف في الأغراض التي تجاوزت مدة الحفظ (إجراء جماعي)
  dispose(){
    const over = S.items.filter(i => i.status === 'available' && SM().keepLeft(i) < 0 && wf.canArchive(i)).map(full);
    if (!over.length) return toast(t('a.noneOver'));
    // الطريقة المقترحة: إن اتفقت كل الأغراض عليها (مثل الوثائق ← تسليم للجهة المختصة)
    const sug = new Set(over.map(i => cat(i.cat).disposal || '')); const pre = sug.size === 1 ? [...sug][0] : '';
    openSheet(`<h2>${icon('clock')} ${t('a.disposeTitle', {items: tp('n.itemGen', over.length)})}</h2>
      <form data-form="dispose" novalidate>
        <div class="list">${over.map(i => `<label class="check"><input type="checkbox" name="ids" value="${esc(i.id)}" checked><span><b>${esc(i.ref)}</b> ${esc(showTitle(i))} <span class="muted">· ${relDay(i.foundDate)}${SM().catKeepNote(i) ? ' · ' + SM().catKeepNote(i) : ''}${cat(i.cat).disposal ? ' · ' + t('a.suggested', {method: t('disposal.' + cat(i.cat).disposal)}) : ''}</span></span></label>`).join('')}</div>
        <div class="field"><span class="label">${t('a.method')}</span>
          ${wf.disposalsFor(over).map(k => `<label class="check"><input type="radio" name="method" value="${k}" ${k === pre ? 'checked' : ''}><span>${t('disposal.' + k)}</span></label>`).join('')}
          ${wf.disposalsFor(over).includes('finder') ? `<span class="hint">${t('a.finderHint')}</span>` : ''}</div>
        <div class="field"><label for="dp-note">${t('a.noteStaff')}</label><input id="dp-note" name="note" class="input" maxlength="300" placeholder="${t('a.disposePh')}"></div>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('a.disposeBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
  },
  claimHist(){ loadClaimHistory(); },
  closedReps(){ loadClosedReports(); },   // «مغلقة» في تبويب البلاغات (PR 3)
  adminRefresh(){ loadAdminCounts(true); },
  // تعبئة طلب الاستلام من بلاغ المستخدم المفتوح
  stepNext(el){ const f = el.closest('form'); if (f) stepNext(f); },
  stepPrev(el){ const f = el.closest('form'); if (f) showStep(f, (Number(f.dataset.step) || 1) - 1); },
  useReport(el){
    const r = S.myReports.find(x => x.id === el.dataset.id); const f = el.closest('form'); if (!r || !f) return;
    const more = f.querySelector('#cl-more'); if (more) more.open = true;   // H1: ما عُبّئ من البلاغ يظهر
    const cc = f.querySelector(`input[name=color][value="${COLORS.some(c => c.id === r.color) ? r.color : ''}"]`); if (cc) cc.checked = true;
    const sp = f.querySelector('[name=spot]'); if (sp && [...sp.options].some(o => o.value === r.spot)){ sp.value = r.spot; onSpotChange(f, r.spot); }
    if (r.bldg) f.querySelector('[name=bldg]').value = r.bldg;
    if (r.room) f.querySelector('[name=room]').value = r.room;
    if (r.lostDate){ const d = f.querySelector('[name=lostDate]'); d.value = r.lostDate; const h = d.parentElement.querySelector('.date-hint'); if (h) h.hidden = true; }
    if (r.desc) f.querySelector('[name=proof]').value = r.desc;
    // إجابات أسئلة التصنيف من البلاغ
    for (const [k, v] of Object.entries(r.details || {})){ const x = f.querySelector(`[name="d_${k}"]`); if (x) x.value = v; }
    f.querySelector('[name=reportId]').value = r.id;
    toast(t('a.filledFromReport'));
  },
  async resendVerify(){
    try { await sendEmailVerification(auth.currentUser); toast(t('a.verifyResent')); }
    catch (e){ toast(authErr(e)); }
  },
  // بعد الضغط على رابط التوثيق: نحدّث بيانات الحساب ثم رمز الدخول (حتى تراه القواعد موثّقاً)
  async checkVerified(){
    const u = auth.currentUser; if (!u) return;
    try { await u.reload(); if (auth.currentUser.emailVerified) await auth.currentUser.getIdToken(true); } catch (e){ console.warn(e); }
    S.verified = !!auth.currentUser?.emailVerified;
    toast(S.verified ? t('a.verifiedOk') : t('a.notVerified', {btn: t('c.verified')}));
    if (S.verified) checkInvite();   // دعوة موظف تنتظر توثيق البريد: تُقبل الآن
    renderAll();
  },
  reject(el){
    openSheet(`<h2>${t('a.rejectTitle')}</h2><form data-form="reject" data-id="${esc(el.dataset.id)}" novalidate>
      <div class="field"><label for="rj-note">${t('a.rejectWhy')}</label><input id="rj-note" name="note" class="input" maxlength="200" placeholder="${t('a.rejectPh')}"></div>
      <div class="form-err" hidden></div>
      <div class="btn-row"><button class="btn danger" type="submit">${icon('x')}${t('a.rejectBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div></form>`);
  },
  // سؤال تحقق: اقتراحات جاهزة حسب تصنيف الغرض، ويكتب الموظف سؤاله
  ask(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return; const i = item(claimItemId(c)), catId = i?.cat || c.cat || '';
    const sugs = [...(catId ? t('qa.sug.' + catId).split('|') : []), t('qa.sugAny')].filter(Boolean);
    openSheet(`<h2>${icon('question')} ${t('qa.askTitle')}</h2>
      <p class="muted">${t('qa.askHint')}</p>
      <form data-form="ask" data-id="${esc(c.id)}" novalidate>
        <div class="field"><label for="qa-q">${t('qa.q')}</label><textarea id="qa-q" name="question" class="input" maxlength="300" required>${esc(c.question || '')}</textarea></div>
        <div class="chips-wrap" role="group" aria-label="${t('qa.suggestions')}">${[...new Set(sugs)].map(q => `<button type="button" class="chip" data-act="qaSuggest" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('qa.send')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
  },
  qaSuggest(el){ const f = el.closest('form'); const q = f?.querySelector('[name=question]'); if (q){ q.value = el.dataset.v; q.focus(); } },
  answerQ(el){
    const c = S.myClaims.find(x => x.id === el.dataset.id); if (!c?.question) return;
    openSheet(`<h2>${icon('question')} ${t('qa.answerTitle')}</h2>
      <div class="qa"><div class="qa-q">${icon('question')}<span><b>${t('qa.q')}</b> ${esc(c.question)}</span></div></div>
      <form data-form="answer" data-id="${esc(c.id)}" novalidate>
        <div class="field"><label for="qa-a">${t('qa.yourAnswer')}</label><textarea id="qa-a" name="answer" class="input" maxlength="1000" required></textarea>
          <span class="hint">${t('qa.answerHint')}</span></div>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('qa.sendAnswer')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
  },
  // H17: «قبول» بلاغ نقود غير مربوط بغرض: نافذة قصيرة (المبلغ المسلَّم، وتاريخ العثور، والإقرار)
  approveCash(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return;
    const d = c.details || {};
    const facts = [d.denoms ? `<dt>${dfLabel(c.cat, 'denoms')}</dt><dd>${esc(d.denoms)}</dd>` : '',
      d.holder ? `<dt>${dfLabel(c.cat, 'holder')}</dt><dd>${esc(dfOpt('holder', d.holder))}</dd>` : ''].join('');
    openSheet(`<h2>${icon('cash')} ${t('ca.title')}</h2>
      <p class="muted">${t('ca.sub', {no: `<b dir="ltr">${esc(claimNo(c))}</b>`})}</p>
      ${facts ? `<dl class="facts">${facts}</dl>` : ''}
      <form data-form="cashApprove" data-id="${esc(c.id)}" data-allcheck="1" novalidate>
        <div class="field"><label for="ca-amt">${t('ca.amount')}</label>
          <input id="ca-amt" name="amount" class="input num-in" inputmode="numeric" dir="ltr" maxlength="9" autocomplete="off" required value="${esc(d.amount || '')}">
          <span class="hint">${t('ca.amountHint')}</span></div>
        <div class="field"><label for="ca-date">${t('ca.foundDate')} <span class="hint">${t('c.optional')}</span></label>
          <input id="ca-date" name="foundDate" type="date" class="input" max="${today()}" value="${today()}"></div>
        <label class="check"><input type="checkbox" name="matched" required><span><b>${t('ca.pledge')}</b></span></label>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit" disabled>${icon('check')}${t('ca.confirm')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
  },
  verify(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return; const i = item(c.itemId);
    // هوية المستلم: الاسم وآخر 4 أرقام كما كتبهما صاحب الطلب، والموظف يطابقهما مع البطاقة نفسها
    const tip = i && cat(i.cat).staffCheck ? `<div class="note info">${icon('shield')}<span>${t(cat(i.cat).staffCheck)}</span></div>` : '';
    openSheet(`<h2>${icon('shield')} ${t('a.handTitle', {ref: i ? esc(i.ref) : ''})}</h2>
      <p class="muted">${t('a.askCode', {who: person(c.uid)})}</p>
      <p class="meta">${t('c.reqNo')}: <b dir="ltr">${esc(claimNo(c))}</b></p>
      <dl class="facts id-facts"><dt>${t('st.cmpName')}</dt><dd>${c.claimantName ? esc(c.claimantName) : `<span class="muted">${t('st.notSaid')}</span>`}</dd>
        <dt>${t('st.cmpLast4')}</dt><dd>${c.idLast4 ? `<b dir="ltr">${esc(c.idLast4)}</b>` : `<span class="muted">${t('st.notSaid')}</span>`}</dd></dl>
      <div class="note warn">${icon('idcard')}<span>${t('a.matchId')}</span></div>${tip}
      <form data-form="verify" data-id="${esc(c.id)}" data-allcheck="1" novalidate>
        <input name="code" class="input code-input" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="XXXX-XXXX" aria-label="${t('mine.code')}">
        <div class="two">
          <div class="field"><label for="vf-name">${t('a.receiverName')}</label><input id="vf-name" name="rname" class="input" maxlength="120" autocomplete="off" value="${esc(c.claimantName || '')}"></div>
          <div class="field"><label for="vf-4">${t('a.last4')}</label><input id="vf-4" name="rlast4" class="input" inputmode="numeric" maxlength="4" dir="ltr" autocomplete="off" value="${esc(c.idLast4 || '')}"></div>
        </div>
        <span class="hint">${t('a.receiverHint')}</span>
        <label class="check"><input type="checkbox" name="matched" required><span><b>${t('a.matched')}</b></span></label>
        <fieldset class="ho-checks"><legend>${t('ho.title')}</legend>
          ${handoverChecks(i?.cat).map(k => `<label class="check"><input type="checkbox" name="hc" value="${k}" required><span>${t(k)}</span></label>`).join('')}</fieldset>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit" disabled>${icon('check')}${t('a.verifyBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
  },
  acceptReport(el){ go('add', {fromReport: el.dataset.id}); },
  // ملصقات QR: لغرض واحد من صفحته، أو لمجموعة من لوحة الموظف
  labels(el){ go('labels', {ids: String(el.dataset.ids || '').split(',').filter(Boolean)}); },
  labelsMenu(){
    const act = S.items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const day = today(), week = Date.now() - 7 * 864e5;
    const opts = [['lb.today', act.filter(i => isoDay(i.createdAt) === day)], ['lb.week', act.filter(i => (i.createdAt || 0) >= week)], ['lb.all', act]];
    openSheet(`<h2>${icon('qr')} ${t('lb.menuTitle')}</h2><p class="muted">${t('lb.menuHint')}</p>
      <div class="list">${opts.map(([k, list]) => `<button class="opt" data-act="labels" data-ids="${esc(list.map(i => i.id).join(','))}" ${list.length ? '' : 'disabled aria-disabled="true"'}>${icon('qr')}<span class="grow">${t(k)}</span><span class="muted">${tp('n.item', list.length)}</span></button>`).join('')}</div>
      <button class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button>`);
  },
  poster(el){ go('poster', {office: el.dataset.id || S.officeId}); },
  print(){ window.print(); },
  stats(el){ go('stats', {office: el.dataset.id || S.officeId}); },
  statsRefresh(el){ load('stats').then(m => m.loadStats(el.dataset.id, true)); },
  /* H8: نسخة احتياطية (JSON) لمكتب واحد، للمدير فقط: المكتب والمفقودات وتفاصيلها السرية والطلبات والبلاغات وإشعارات التسليم والسجل.
     بلا صور (مستندات itemPhotos) ولا بيانات المستخدمين الخاصة (users/private). خطة Spark بلا نسخ احتياطي تلقائي، فاحفظ الملف في مكان آمن:
     فيه بيانات شخصية (الأسماء وآخر 4 أرقام وأسئلة التحقق) */
  async backup(el){
    if (!S.isAdmin) return;
    const id = el.dataset.id; el.disabled = true;
    try {
      const q = col => dbx.list(col, [['officeId', '==', id]]);
      const [office, items, itemSecrets, claims, reports, foundReports, logs] = await Promise.all([
        dbx.get('offices/' + id), q('items'), q('itemSecrets'), q('claims'), q('reports'), q('foundReports'), q('logs')]);
      const data = {app: 'mafqoodak', version: APP_VERSION, exportedAt: new Date().toISOString(), exportedBy: S.uid, officeId: id,
        offices: office ? [{id, ...office}] : [], items, itemSecrets, claims, reports, foundReports, logs};
      const n = items.length + itemSecrets.length + claims.length + reports.length + foundReports.length + logs.length;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'}));
      const a = document.createElement('a');
      a.href = url; a.download = `mafqoodak-backup-${(office?.code || id).toLowerCase()}-${today()}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      // القيد يُحفظ بالعربية (قيم قاعدة البيانات عربية)، والرسالة بلغة الواجهة
      await write(() => wf.logBackup(id, tAr('sys.backupNote', {records: tpAr('n.record', n)})), t('bk.done', {records: tp('n.record', n)}));
    } catch (e){ console.warn(e); toast(t('bk.fail')); }
    finally { el.disabled = false; }
  },
  async exportCsv(el){ el.disabled = true; try { await (await load('stats')).exportCsv(el.dataset.id); } finally { el.disabled = false; } },
  // إشعار التسليم: الموظف يستلم الغرض (نموذج الغرض معبّأ)، أو يغلق الإشعار إن لم يصل الغرض
  async receiveFound(el){
    const f = S.found.find(x => x.id === el.dataset.id); if (!f) return;
    const done = S.items.find(i => i.fromFound === f.id);
    if (done){ if (await write(() => wf.itemSaved(done, {fromFound: f.id}), t('hi.receivedToast'))) emailUser(f.uid); return; }
    go('add', {fromFound: f.id});
  },
  dropFound(el){
    const f = S.found.find(x => x.id === el.dataset.id); if (!f) return;
    confirmSheet(t('hi.dropQ'), t('hi.dropBody'), t('hi.drop'), () => write(() => wf.dropFound(f), t('hi.dropped')), false);
  },
  // الواجد يلغي إشعاره ما دام لم يسلّم الغرض، ويحذف الملغى
  cancelFound(el){
    confirmSheet(t('hi.cancelQ'), t('hi.cancelBody'), t('hi.cancel'),
      () => write(() => dbx.update('foundReports/' + el.dataset.id, {status: 'cancelled', cancelledAt: Date.now()}), t('hi.cancelled')), false);
  },
  delFound(el){ write(() => dbx.del('foundReports/' + el.dataset.id), t('hi.deleted')); },
  async pickFor(el){
    if (await write(() => dbx.update('reports/' + el.dataset.r, {staffPick: el.dataset.i, pickedAt: Date.now()}), t('a.picked')))
      emailUser(S.reports.find(r => r.id === el.dataset.r)?.uid);
  },
  async pickAll(el){
    const rs = el.dataset.rs.split(',').filter(Boolean); closeSheet();
    for (const r of rs) if (await write(() => dbx.update('reports/' + r, {staffPick: el.dataset.i, pickedAt: Date.now()})))
      emailUser(S.reports.find(x => x.id === r)?.uid);
    toast(t('a.pickedAll'));
  },
  newOffice(){ go('officeForm', {}); },
  editOffice(el){ go('officeForm', {id: el.dataset.id, en: el.dataset.en === '1'}); },
  async toggleOffice(el){ const o = S.offices.find(x => x.id === el.dataset.id); if (o) await write(() => dbx.update('offices/' + o.id, {active: o.active === false})); },
  // سحب الصلاحية والإدارة: batch واحد مع قيد في السجل لكل مكتب معني (workflow.js)
  cancelInvite(el){ confirmSheet(t('inv.cancelQ'), t('inv.cancelBody'), t('inv.cancel'), () => write(() => wf.cancelInvite(el.dataset.id), t('inv.cancelled'))); },

  makeAdmin(el){ confirmSheet(t('a.makeAdminQ'), t('a.makeAdminBody'), t('adm.makeAdmin'), () => write(() => wf.setAdmin(el.dataset.id, true), t('a.adminAdded')), false); },
  unAdmin(el){ confirmSheet(t('a.unAdminQ'), t('a.unAdminBody'), t('adm.unAdmin'), () => write(() => wf.setAdmin(el.dataset.id, false), t('a.adminRemoved'))); },
  audit(el){ go('audit', {office: el.dataset.id || S.offices[0]?.id || ''}); },
  auditRefresh(){ const p = S.route.params; loadAudit(p.office, p.filter || 'all', true); },
  revoke(el){ confirmSheet(t('a.revokeQ'), t('a.revokeBody'), t('a.revokeBtn'), () => write(() => wf.revokeStaff(el.dataset.id), t('a.revoked'))); },
  async delSamples(){
    // تُجلب الأمثلة عند الطلب فقط (لا اشتراك دائم في كل الأغراض)
    const s = await dbx.list('items', [['sample', '==', true]]).catch(() => []);
    if (!s.length) return toast(t('a.noSamples'));
    confirmSheet(t('a.delSamplesQ', {items: tp('n.sampleGen', s.length)}), t('a.delSamplesBody'), t('a.delSamplesBtn'), async () => {
      // H13a: batch لكل مثال مع إغلاق طلباته المفتوحة (من الخادم) وحذف صوره وتفاصيله (wf.deleteItem)؛
      // كان الحذف المتسلسل يترك طلبات مفتوحة على أغراض محذوفة
      let failed = 0;
      for (const i of s){ try { await wf.deleteItem(i); } catch (e){ console.warn(e); failed++; } }
      S.counts.samples = failed; toast(failed ? t('a.samplesPartly', {n: failed}) : t('a.samplesDeleted')); renderAll();
    });
  },
  // v14 (H19): إيقاف البيانات التوضيحية نهائياً بعد حذفها (القواعد ترفض بعده أي غرض «مثال»)
  samplesOff(){
    confirmSheet(t('adm.samplesOffQ'), t('adm.samplesOffBody'), t('adm.samplesOff'), async () => {
      if (await write(() => dbx.update('config/app', {samplesOff: true}), t('adm.samplesOffDone'))) renderAll();
    });
  },
  confirmYes(){ const fn = PENDING_CONFIRM; PENDING_CONFIRM = null; closeSheet(); if (fn) fn(); },
};

/* ---------- ربط المستمعين ---------- */
// ينقل إلى بطاقة في «طلباتي»: تبويبها، ثم «منتهية» إن كانت فيها، ثم يفتحها ويبرزها
function openCard(tab, key, ended){
  LS.set('mineTab', tab); CARD_OPEN.set(key, true); if (ended) ENDED_OPEN.set(tab, true);
  renderAll();
  const box = document.querySelector(`details[data-card="${CSS.escape(key)}"]`); if (!box) return;
  box.open = true;
  box.scrollIntoView({behavior: 'smooth', block: 'center'});
  box.querySelector('summary')?.focus({preventScroll: true});
  box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 1600);
}
export function bindEvents(){
  const app = $('#app');
  // تذكّر فتح البطاقات المختصرة و«منتهية» (حتى لا تُطوى عند إعادة الرسم الحيّ). حدث toggle لا ينتشر، فنلتقطه مبكراً
  document.addEventListener('toggle', e => {
    const d = e.target; if (!(d instanceof HTMLDetailsElement)) return;
    if (d.dataset.card) CARD_OPEN.set(d.dataset.card, d.open);
    else if (d.dataset.ended) ENDED_OPEN.set(d.dataset.ended, d.open);
  }, true);
  app.addEventListener('click', e => {
    // H4: فتح بطاقة مختصرة بيد المستخدم يسجّل تنبيهاتها مقروءة (فيختفي حدّها الملوّن)
    const sum = e.target.closest('details[data-card] > summary');
    if (sum){ const d = sum.parentElement, card = d.dataset.card;
      setTimeout(() => { if (!d.open) return; markSeenKeys(unseenFor(card)); markStaffSeen(staffKeys().filter(x => x.card === card).map(x => x.k));
        if (card.startsWith('s:')) openClaimCard(card.slice(2)); }, 0); }   // v7: سجل صاحب الطلب يُقرأ عند فتح بطاقته
    const el = e.target.closest('[data-act]'); if (!el || !app.contains(el)) return;
    const fn = ACT[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  });
  app.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')){ e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && S.sheet) closeSheet();
    // التبويبات (role="tablist"): الأسهم تنقل بين التبويبات وتفعّلها، مع مراعاة اتجاه الصفحة، وHome/End للأول والأخير
    if (e.target.matches('[role=tab]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)){
      const tabs = [...e.target.closest('[role=tablist]').querySelectorAll('[role=tab]')], k = tabs.indexOf(e.target);
      const fwd = (e.key === 'ArrowLeft') === (document.dir === 'rtl');
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (k + (fwd ? 1 : -1) + tabs.length) % tabs.length;
      e.preventDefault(); tabs[n].click();
    }
  });
  app.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    // H19: Enter في خطوة غير الأخيرة = «التالي» لا الإرسال
    if (f.dataset.steps && Number(f.dataset.step || 1) < Number(f.dataset.steps)) return stepNext(f);
    submitForm(f);
  });
  let qTimer;
  app.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q'){ S.filter.q = t.value; clearTimeout(qTimer); qTimer = setTimeout(updateBrowse, 120); }
    if (t.name === 'ratingNote'){ const f = t.closest('form'); if (f) (RATE_DRAFT[f.dataset.id] ||= {}).note = t.value; }
    if (t.id === 'cq'){ S.claimQ = t.value; clearTimeout(qTimer); qTimer = setTimeout(() => { $('#s-body').innerHTML = SM().staffClaims(); hydrate(); }, 120); }
    if (t.id === 'sq'){ S.staffQ = t.value; clearTimeout(qTimer); qTimer = setTimeout(() => { $('#s-body').innerHTML = SM().staffItems(); hydrate(); }, 120); }
    // v9: رمز الاستلام: أحرف كبيرة وأرقام لاتينية، وشرطة بعد الأحرف الأربعة الأولى (الرموز القديمة: 6 أرقام)
    if (t.name === 'code' && t.classList.contains('code-input')){ const v = normPickup(t.value); t.value = /^\d{1,6}$/.test(v) || v.length <= 4 ? v : v.slice(0, 4) + '-' + v.slice(4); }
    // خانات الأرقام في أسئلة التصنيف: الأرقام الهندية إلى لاتينية، وحذف ما ليس رقماً
    if (t.classList.contains('num-in')) t.value = detailValue({type: 'num'}, t.value).slice(0, Number(t.maxLength) > 0 ? t.maxLength : 9);
    if (t.classList.contains('code-in')) t.value = normCode(t.value);
    if (t.name === 'idLast4' || t.name === 'rlast4' || t.name === 'last4') t.value = latinDigits(t.value).replace(/\D/g, '').slice(0, 4);
    if (t.name === 'title' && t.closest('form[data-quick]')) unSugg(t.closest('form'), t);
  });
  app.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'frange'){ S.filter.range = t.value; updateBrowse(); }
    if (t.id === 'sstatus'){
      S.staffStatus = t.value; $('#s-body').innerHTML = SM().staffItems(); hydrate();
      // المُسلَّم والمؤرشف والمُتصرَّف فيه تُجلب عند اختيار الفلتر فقط
      if (t.value !== 'active') loadExtraItems(t.value);
    }
    if (t.id === 'photo-in' || t.classList.contains('photo-file')) onPhoto(t);
    if (t.id === 'proof-in') onProofs(t);
    // v7: نموذج فيه قائمة فحوص (التسليم): الزر يعمل فقط بعد تعليم كل المربعات
    const af = t.closest?.('form[data-allcheck]'); if (af) af.querySelector('[type=submit]').disabled = ![...af.querySelectorAll('input[type=checkbox]')].every(x => x.checked);
    // «سجل العمليات»: تغيير المكتب أو الفلتر يجلب القيود المطلوبة فقط
    if (t.id === 'au-office' || t.id === 'au-filter'){ const p = {office: $('#au-office').value, filter: $('#au-filter').value}; S.route.params = p; renderAll(); }
    // تلميح خانة التاريخ الاختيارية يظهر فقط وهي فارغة
    if (t.type === 'date'){ const h = t.parentElement.querySelector('.date-hint'); if (h) h.hidden = !!t.value; }
    if (t.name === 'spot' && t.closest('form')) onSpotChange(t.closest('form'), t.value);
    if (t.name === 'cat' && t.closest('form')) onCatChange(t.closest('form'), t.value, '');
    // H9: ما يغيّره الموظف بيده لا يغيّره اقتراح الذكاء الاصطناعي، وتزول عنه علامة «اقتراح»
    const qf = t.closest?.('form[data-quick]'); if (qf && ['cat', 'sub', 'color'].includes(t.name)) unSugg(qf, t);
  });
  // تلميح الرسوم البيانية: عند المرور بالمؤشر أو التركيز بلوحة المفاتيح (النص يوضع بـ textContent)
  const tip = document.createElement('div'); tip.id = 'viz-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  tip.innerHTML = '<b></b><span></span>'; document.body.append(tip);
  const showTip = el => {
    tip.firstChild.textContent = el.dataset.tipV; tip.lastChild.textContent = el.dataset.tipL; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - h - 8) + 'px';
  };
  const hideTip = () => { tip.hidden = true; };
  app.addEventListener('pointerover', e => { const el = e.target.closest?.('[data-tip-v]'); if (el) showTip(el); });
  app.addEventListener('pointerout', e => { if (e.target.closest?.('[data-tip-v]') && document.activeElement !== e.target) hideTip(); });
  app.addEventListener('focusin', e => { if (e.target.matches?.('[data-tip-v]')) showTip(e.target); });
  // H7: رابط المشاركة يُحدَّد كاملاً عند التركيز (كان onfocus مضمّناً في HTML، وسياسة CSP تمنع المعالجات المضمّنة). النافذة خارج #app
  document.addEventListener('focusin', e => { if (e.target.matches?.('input.share-url')) e.target.select(); });
  app.addEventListener('focusout', e => { if (e.target.matches?.('[data-tip-v]')) hideTip(); });
  // التمرير يخفي تلميح المؤشر، ويُبقي تلميح العنصر المُركَّز عليه (مع إعادة تحديد مكانه)
  window.addEventListener('scroll', () => { const a = document.activeElement; if (a?.matches?.('[data-tip-v]')) showTip(a); else hideTip(); }, {passive: true});
}
