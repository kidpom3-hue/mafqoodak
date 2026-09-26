// الأحداث: الضغط على الأزرار وإرسال النماذج
import { icon, cat, catName, colorName, ITEM_STATUS } from './constants.js';
import { $, esc, today, relDay, pill, sha, genCode, makeRef, compress, dataUrlToBlob, matchScore, toast, LS } from './utils.js';
import { S, curOffice, item, modes, homeRoute, setOffice, write, authErr, getPhoto, cachePhoto, MATCH_MIN } from './state.js';
import { auth, dbx, GoogleAuthProvider, signInWithPopup, signInWithRedirect, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut } from './firebase.js';
import { go, back, renderAll, openSheet, closeSheet, hydrate, renderNav } from './ui.js';
import { updateBrowse } from './views/visitor.js';
import { updateStaff, staffItems } from './views/staff.js';
import { FORM, subsPicker } from './views/common.js';
import { analyzePhoto, rankMatches, aiErrMsg, aiReady } from './ai.js';
import { SETTINGS } from './config.js';
import { sampleItems } from './sample-data.js';

/* ---------- أدوات النماذج ---------- */
function formErr(form, msg){ const e = form.querySelector('.form-err'); if (!e) return; e.textContent = msg; e.hidden = !msg; if (msg) e.scrollIntoView({block: 'center', behavior: 'smooth'}); }
function busy(form, on){ const b = form.querySelector('button[type=submit]'); if (b) b.disabled = on; }

export function onCatChange(form, catId, sub){
  const sf = form.querySelector('#subs-field'), sc = form.querySelector('#subs');
  if (sc){ sc.innerHTML = subsPicker(catId, sub); sf.hidden = !cat(catId).subs.length; }
  const sens = cat(catId).sensitive;
  const note = form.querySelector('#sens-note'), pf = form.querySelector('#photo-field');
  if (note) note.hidden = !sens;
  if (pf) pf.hidden = !!sens;
  if (sens && (FORM.photo || FORM.hadPhoto)){ clearPhoto(form); toast('أُزيلت الصورة لأن الوثائق الشخصية لا تُصوَّر.'); }
}
function clearPhoto(form){
  FORM.photo = null; FORM.blob = null; FORM.copyFrom = null; if (FORM.hadPhoto) FORM.removed = true;
  const pv = form.querySelector('#pv'); if (pv) pv.innerHTML = icon('camera');
  const rm = form.querySelector('#rm-photo'); if (rm) rm.hidden = true;
  const ai = form.querySelector('#ai-btn'); if (ai) ai.disabled = true;
  const inp = form.querySelector('#photo-in'); if (inp) inp.value = '';
}
async function onPhoto(input){
  const f = input.files?.[0]; if (!f) return;
  const form = input.closest('form'); const st = form.querySelector('#ai-status');
  try {
    const {dataUrl, blob} = await compress(f);
    FORM.photo = dataUrl; FORM.blob = blob; FORM.removed = false;
    form.querySelector('#pv').innerHTML = `<img src="${dataUrl}" alt="">`;
    form.querySelector('#rm-photo').hidden = false;
    const ai = form.querySelector('#ai-btn'); if (ai){ ai.disabled = false; if (st) st.textContent = 'اضغط «تعبئة تلقائية» ليتعرّف الذكاء الاصطناعي على النوع واللون.'; }
  } catch { toast('تعذّر قراءة الصورة. جرّب صورة أخرى.'); }
}

/* ---------- الذكاء الاصطناعي ---------- */
async function aiFill(){
  const btn = $('#ai-btn'), st = $('#ai-status'); if (!FORM.blob || !btn) return;
  btn.disabled = true; st.innerHTML = `<span class="spin" style="width:14px;height:14px"></span> يحلل الذكاء الاصطناعي الصورة…`;
  try {
    const r = await analyzePhoto(FORM.blob);
    const f = btn.closest('form');
    if (r?.cat && f.querySelector(`input[name=cat][value="${r.cat}"]`)){ f.querySelector(`input[name=cat][value="${r.cat}"]`).checked = true; onCatChange(f, r.cat, r.sub); }
    if (r?.color){ const cc = f.querySelector(`input[name=color][value="${r.color}"]`); if (cc) cc.checked = true; }
    if (r?.title) f.querySelector('[name=title]').value = String(r.title).slice(0, 80);
    if (r?.desc) f.querySelector('[name=desc]').value = String(r.desc).slice(0, 600);
    st.innerHTML = `${icon('check')} تمت التعبئة — راجع الحقول قبل الحفظ.`;
  } catch (e){ console.warn(e); st.textContent = aiErrMsg(e); }
  finally { btn.disabled = !FORM.blob; }
}
async function aiMatch(reportId){
  const r = S.reports.find(x => x.id === reportId); const st = $('#ai-' + reportId); if (!r) return;
  const pool = S.items.filter(i => i.status === 'available' || i.status === 'reserved')
    .map(i => ({i, s: matchScore(r, i)})).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.i);
  if (!pool.length){ if (st) st.textContent = 'لا توجد مفقودات في المستودع للمقارنة حالياً.'; return; }
  if (st) st.innerHTML = `<span class="spin" style="width:14px;height:14px"></span> يقارن الذكاء الاصطناعي بلاغك بالمفقودات…`;
  const images = [], imgIds = [];
  if (r.photo){
    const d = await getPhoto('r_' + r.id);
    if (d){
      images.push(dataUrlToBlob(d));
      for (const i of pool){
        if (images.length >= 5) break;
        if (!i.photo || cat(i.cat).sensitive) continue;
        const p = await getPhoto(i.id); if (p){ images.push(dataUrlToBlob(p)); imgIds.push(i.id); }
      }
    }
  }
  try {
    const matches = await rankMatches(r, pool, images, imgIds);
    const ok = await write(() => dbx.update('reports/' + r.id, {ai: {at: Date.now(), matches}}), matches.length ? 'رُتّبت التطابقات المحتملة' : 'لم يُعثر على تطابق حالياً');
    if (!ok && st?.isConnected) st.textContent = '';
  } catch (e){ console.warn(e); if (st?.isConnected) st.textContent = aiErrMsg(e); }
}

/* ---------- إرسال النماذج ---------- */
async function submitForm(form){
  const kind = form.dataset.form; const fd = new FormData(form); formErr(form, '');
  const val = k => String(fd.get(k) || '').trim();

  if (kind === 'homeSearch'){
    S.filter.q = val('q'); S.filter.cat = 'all'; S.filter.status = 'available';
    go('browse');
    return;
  }

  if (kind === 'login'){
    const email = val('email'), pass = String(fd.get('password') || ''), signup = form.dataset.mode === 'signup';
    if (!email || !pass) return formErr(form, 'اكتب البريد الإلكتروني وكلمة المرور.');
    if (signup && pass.length < 6) return formErr(form, 'كلمة المرور 6 أحرف على الأقل.');
    busy(form, true);
    try {
      if (signup){
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const name = val('name') || email.split('@')[0];
        await updateProfile(cred.user, {displayName: name});
        S.me = {...(S.me || {}), name};
        await dbx.set('users/' + cred.user.uid, {name, email, photo: '', lastSeen: Date.now()}, {merge: true}).catch(() => {});
        toast('أهلاً ' + name);
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
    } catch (e){ formErr(form, authErr(e) || 'تعذّر تسجيل الدخول.'); }
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
        const b2 = dbx.batch();
        sampleItems(id, office.code).forEach(s => b2.set(dbx.ref('items/' + s.id), s.data));
        await b2.commit();
      }
      S.mode = 'visitor'; LS.set('mode', 'visitor');
      toast('تم إعداد التطبيق. أنت الآن مالكه.');
      setOffice(id, true);
    } catch (e){
      console.warn(e);
      formErr(form, String(e?.code || '').includes('permission-denied') ? 'تعذّر الإعداد: قد يكون التطبيق مُعدّاً مسبقاً بحساب آخر، أو أن قواعد Firestore لم تُنشر بعد.' : 'تعذّر الإعداد. تأكد من إنشاء قاعدة Firestore ونشر القواعد ثم حاول مجدداً.');
    } finally { busy(form, false); }
    return;
  }

  if (kind === 'claim'){
    const i = item(form.dataset.id);
    if (!i || i.status !== 'available') return formErr(form, 'لم يعد هذا الغرض متاحاً للطلب.');
    if (val('proof').length < 15) return formErr(form, 'اكتب تفاصيل أكثر (15 حرفاً على الأقل) تثبت أن الغرض لك.');
    if (!fd.get('pledge')) return formErr(form, 'أكّد الإقرار بصحة المعلومات.');
    busy(form, true);
    const id = dbx.newId('claims'); const code = genCode(); const codeHash = await sha(id + ':' + code);
    LS.set('codes', {...LS.get('codes', {}), [id]: code});
    await dbx.set('users/' + S.uid + '/private/codes', {codes: {[id]: code}}, {merge: true}).catch(e => console.warn(e));
    const ok = await write(() => dbx.set('claims/' + id, {itemId: i.id, officeId: i.officeId, uid: S.uid, proof: val('proof').slice(0, 1200),
      lostSpot: val('spot'), lostDate: val('lostDate'), status: 'pending', codeHash, createdAt: Date.now()}), 'أُرسل طلبك إلى مكتب المفقودات');
    busy(form, false); if (ok){ S.hist = []; go('mine', {}, false); }
    return;
  }

  if (kind === 'report' || kind === 'item'){
    const catId = val('cat');
    if (!catId) return formErr(form, 'اختر التصنيف.');
    if (!val('title')) return formErr(form, 'اكتب اسماً مختصراً للغرض.');
    const sens = cat(catId).sensitive;
    busy(form, true);

    if (kind === 'report'){
      const id = dbx.newId('reports');
      const withPhoto = !!FORM.photo && !sens;
      const ok = await write(() => dbx.set('reports/' + id, {officeId: S.officeId, uid: S.uid, cat: catId, sub: val('sub'), color: val('color'),
        title: val('title'), desc: val('desc'), spot: val('spot'), lostDate: val('lostDate') || today(), photo: false, status: 'open', createdAt: Date.now()}), 'سُجّل بلاغك');
      if (ok && withPhoto){
        cachePhoto('r_' + id, FORM.photo);
        if (await write(() => dbx.set('reportPhotos/' + id, {data: FORM.photo}))) await write(() => dbx.update('reports/' + id, {photo: true}));
      }
      busy(form, false); if (ok){ S.hist = []; go('mine', {focus: id}, false); }
      return;
    }

    const existing = S.route.params.id ? item(S.route.params.id) : null;
    const id = existing ? existing.id : dbx.newId('items');
    const fromReport = existing ? '' : (form.dataset.report || '');
    // صورة البلاغ (إن وُجدت ولم يغيّرها الموظف) تُنسخ لتصبح صورة الغرض
    if (!FORM.photo && FORM.copyFrom && !sens) FORM.photo = await getPhoto(FORM.copyFrom);
    let photo = existing?.photo || false;
    const data = {
      officeId: existing?.officeId || S.officeId, ref: existing?.ref || makeRef(curOffice()),
      cat: catId, sub: val('sub'), color: val('color'), title: val('title'), desc: val('desc'), spot: val('spot'),
      foundDate: val('foundDate') || today(), storage: val('storage'), photo,
      status: existing?.status || 'available', createdBy: existing?.createdBy || S.uid, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
      sample: !!existing?.sample,
    };
    if (fromReport) data.fromReport = fromReport;   // ربط الغرض بالبلاغ الذي قُبل
    else if (existing?.fromReport) data.fromReport = existing.fromReport;
    if (existing?.reservedFor) data.reservedFor = existing.reservedFor;
    if (existing?.returnedAt) data.returnedAt = existing.returnedAt;
    // حذف الصورة عند الحاجة يسبق حفظ الغرض
    if (photo && (sens || FORM.removed) && !FORM.photo){ await write(() => dbx.del('itemPhotos/' + id)); cachePhoto(id, null); data.photo = photo = false; }
    const ok = await write(() => dbx.set('items/' + id, data), existing ? 'حُفظت التعديلات' : `سُجّل الغرض برقم ${data.ref}`);
    if (ok && FORM.photo && !sens){
      cachePhoto(id, FORM.photo);
      if (await write(() => dbx.set('itemPhotos/' + id, {data: FORM.photo})) && !photo) await write(() => dbx.update('items/' + id, {photo: true}));
    }
    busy(form, false);
    if (!ok) return;
    if (existing){ back(); return; }
    // قبول بلاغ: نرشّح الغرض الجديد لصاحب البلاغ فيصله تنبيه في «طلباتي»
    if (fromReport) await write(() => dbx.update('reports/' + fromReport, {staffPick: id, pickedAt: Date.now()}), 'أُضيف الغرض للمستودع ووصل التنبيه لصاحب البلاغ');
    const matches = S.reports.filter(r => r.status === 'open' && r.id !== fromReport && matchScore(r, {...data, id}) >= MATCH_MIN);
    S.hist = []; S.staffTab = fromReport ? 'reports' : 'items'; go('staff', {}, false);
    if (matches.length) openSheet(`<h2>${icon('bell')} ${matches.length === 1 ? 'بلاغ قد يطابق' : matches.length + ' بلاغات قد تطابق'} هذا الغرض</h2>
      <div class="list">${matches.map(r => `<div class="box"><b>${esc(r.title)}</b><span class="meta">${esc(catName(r.cat))} · ${esc(colorName(r.color))} · فُقد ${relDay(r.lostDate)}</span>${r.desc ? `<div class="proof">${esc(r.desc)}</div>` : ''}</div>`).join('')}</div>
      <p class="muted">رشّح الغرض لأصحاب هذه البلاغات ليصلهم تنبيه في «طلباتي».</p>
      <div class="btn-row"><button class="btn" data-act="pickAll" data-i="${esc(id)}" data-rs="${esc(matches.map(r => r.id).join(','))}">${icon('check')}رشّح للجميع</button><button class="btn ghost" data-act="closeSheet">لاحقاً</button></div>`);
    return;
  }

  if (kind === 'join'){
    const offices = fd.getAll('offices').map(String);
    if (!offices.length) return formErr(form, 'اختر مكتباً واحداً على الأقل.');
    if (!val('note')) return formErr(form, 'اكتب اسمك ووظيفتك ليعرفك مالك التطبيق.');
    busy(form, true);
    const ok = await write(() => dbx.set('staffRequests/' + S.uid, {offices, note: val('note').slice(0, 120), status: 'pending', createdAt: Date.now()}), 'أُرسل طلب الصلاحية');
    busy(form, false); if (ok) go('office', {}, false);
    return;
  }

  if (kind === 'office'){
    if (!val('name')) return formErr(form, 'اكتب اسم المنشأة.');
    const code = val('code').toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length < 2) return formErr(form, 'رمز القيد حرفان إلى أربعة أحرف لاتينية، مثل TCA.');
    const id = form.dataset.id || dbx.newId('offices'); const old = S.offices.find(o => o.id === form.dataset.id);
    const data = {name: val('name'), short: val('short'), type: val('type'), city: val('city'), code, place: val('place'), hours: val('hours'), phone: val('phone'),
      retentionDays: Math.max(7, Math.min(365, parseInt(val('retentionDays'), 10) || 90)),
      spots: val('spots').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40),
      active: old ? old.active !== false : true, createdAt: old?.createdAt || Date.now()};
    busy(form, true);
    const ok = await write(() => dbx.set('offices/' + id, data), 'حُفظ الموقع');
    busy(form, false); if (ok){ S.adminTab = 'offices'; S.hist = []; go('admin', {}, false); }
    return;
  }

  if (kind === 'verify'){
    const c = S.claims.find(x => x.id === form.dataset.id); const code = val('code').replace(/\D/g, '');
    if (!c) return;
    if (code.length !== 6) return formErr(form, 'الرمز من 6 أرقام.');
    if (await sha(c.id + ':' + code) !== c.codeHash) return formErr(form, 'الرمز غير صحيح. تأكد منه مع صاحب الطلب.');
    busy(form, true);
    const ok = await write(() => dbx.update('claims/' + c.id, {status: 'done', doneAt: Date.now(), doneBy: S.uid}));
    if (ok) await write(() => dbx.update('items/' + c.itemId, {status: 'returned', returnedAt: Date.now(), updatedAt: Date.now()}), 'تم التحقق وتسليم الغرض لصاحبه');
    closeSheet(); return;
  }

  if (kind === 'reject'){
    const c = S.claims.find(x => x.id === form.dataset.id); if (!c) return;
    busy(form, true);
    const ok = await write(() => dbx.update('claims/' + c.id, {status: 'rejected', note: val('note').slice(0, 200), decidedAt: Date.now(), decidedBy: S.uid}), 'رُفض الطلب');
    const i = item(c.itemId);
    if (ok && i?.reservedFor === c.id) await write(() => dbx.update('items/' + i.id, {status: 'available', reservedFor: '', updatedAt: Date.now()}));
    closeSheet(); return;
  }
}

/* ---------- الأزرار ---------- */
let PENDING_CONFIRM = null;
function confirmSheet(title, text, yes, fn){
  PENDING_CONFIRM = fn;
  openSheet(`<h2>${title}</h2><p class="muted">${esc(text)}</p><div class="btn-row"><button class="btn danger" data-act="confirmYes">${icon('trash')}${esc(yes)}</button><button class="btn ghost" data-act="closeSheet">إلغاء</button></div>`);
}
const needLogin = () => { if (S.uid) return false; go('login', {next: S.route}); return true; };

const ACT = {
  nav(el){
    const r = el.dataset.r, tab = el.dataset.tab;
    if (r === 'staff' && tab){ S.staffTab = tab; if (S.route.name === 'staff'){ updateStaff(); renderNav(); window.scrollTo(0, 0); return; } }
    if (r === 'admin' && tab) S.adminTab = tab;
    const fromNav = !!el.closest('#nav, .top-links, .brand');
    if (fromNav) S.hist = [];
    go(r, {}, !fromNav);
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
    if (!email) return toast('اكتب بريدك الإلكتروني أولاً ثم اضغط «نسيت كلمة المرور».');
    try { await sendPasswordResetEmail(auth, email); toast('أرسلنا رابط تعيين كلمة المرور إلى بريدك.'); }
    catch (e){ toast(authErr(e)); }
  },
  account(){
    openSheet(`<div class="person" style="gap:12px">${S.me?.photo ? `<img src="${esc(S.me.photo)}" alt="" referrerpolicy="no-referrer" style="width:44px;height:44px">` : ''}<div><b>${esc(S.me?.name || '')}</b><div class="meta" dir="ltr">${esc(S.me?.email || '')}</div></div></div>
      <div class="list">
        <button class="opt" data-act="nav" data-r="mine">${icon('inbox')}طلباتي وبلاغاتي</button>
        <button class="opt" data-act="signOut">${icon('x')}تسجيل الخروج</button>
      </div>`);
  },
  async signOut(){ closeSheet(); S.mode = 'visitor'; LS.set('mode', 'visitor'); S.hist = []; S.route = {name: 'home', params: {}}; await signOut(auth); toast('سُجّل خروجك'); },
  pickOffice(){ go('pick'); },
  setOffice(el){ setOffice(el.dataset.id); },
  mode(el){ const m = el.dataset.v; if (!modes().includes(m)) return; S.mode = m; LS.set('mode', m); S.hist = []; go(homeRoute(), {}, false); },
  openItem(el){ go('item', {id: el.dataset.id}); },
  goClaim(el){ if (!needLogin()) go('claim', {id: el.dataset.id}); },
  fcat(el){ S.filter.cat = el.dataset.id; updateBrowse(); },
  catGo(el){ S.filter.cat = el.dataset.id; S.filter.q = ''; S.filter.status = 'available'; go('browse'); },
  fstatus(el){ S.filter.status = el.dataset.v; updateBrowse(); },
  sTab(el){ S.staffTab = el.dataset.v; updateStaff(); renderNav(); },
  closeSheet(){ closeSheet(); },
  copy(el){ const v = el.dataset.v; navigator.clipboard?.writeText(v).then(() => toast('نُسخ'), () => toast(v)); },
  removePhoto(el){ clearPhoto(el.closest('form')); },
  aiFill(){ if (aiReady()) aiFill(); },
  aiMatch(el){ if (aiReady()) aiMatch(el.dataset.id); },
  closeReport(el){ write(() => dbx.update('reports/' + el.dataset.id, {status: 'closed', closedAt: Date.now()}), 'أُغلق البلاغ — سعداء بعثورك على غرضك'); },
  delReport(el){
    confirmSheet('حذف البلاغ؟', 'لن تصلك تنبيهات عن هذا الغرض بعد الحذف.', 'احذف البلاغ', async () => {
      const r = S.reports.find(x => x.id === el.dataset.id);
      if (r?.photo) await write(() => dbx.del('reportPhotos/' + r.id));
      await write(() => dbx.del('reports/' + el.dataset.id), 'حُذف البلاغ');
    });
  },
  editItem(el){ go('add', {id: el.dataset.id}); },
  itemStatus(el){
    const i = item(el.dataset.id); if (!i) return;
    openSheet(`<h2>تغيير حالة ${esc(i.ref)}</h2><div class="list">${Object.keys(ITEM_STATUS).map(k => `<button class="opt" data-act="setStatus" data-id="${esc(i.id)}" data-v="${k}">${pill(ITEM_STATUS, k)}${k === i.status ? '<span class="muted">(الحالية)</span>' : ''}</button>`).join('')}</div>
      <p class="hint">استخدم «سُلّم لصاحبه» عند التسليم المباشر في المكتب دون طلب عبر التطبيق.</p><button class="btn ghost" data-act="closeSheet">إلغاء</button>`);
  },
  async setStatus(el){
    const patch = {status: el.dataset.v, updatedAt: Date.now()};
    if (el.dataset.v === 'returned') patch.returnedAt = Date.now();
    if (el.dataset.v === 'available') patch.reservedFor = '';
    closeSheet(); await write(() => dbx.update('items/' + el.dataset.id, patch), 'تم تحديث الحالة');
  },
  delItem(el){
    const i = item(el.dataset.id); if (!i) return;
    confirmSheet(`حذف ${esc(i.ref)}؟`, 'يُحذف الغرض وصورته نهائياً. للاحتفاظ بالسجل استخدم «مؤرشف» بدلاً من الحذف.', 'احذف نهائياً', async () => {
      if (i.photo) await write(() => dbx.del('itemPhotos/' + i.id));
      if (await write(() => dbx.del('items/' + i.id), 'حُذف الغرض')) back();
    });
  },
  async approve(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return;
    const i = item(c.itemId);
    if (i && i.status !== 'available'){ toast('هذا الغرض ليس متاحاً الآن؛ قد يكون محجوزاً لطلب آخر.'); return; }
    const ok = await write(() => dbx.update('claims/' + c.id, {status: 'approved', decidedAt: Date.now(), decidedBy: S.uid}));
    if (ok && i) await write(() => dbx.update('items/' + i.id, {status: 'reserved', reservedFor: c.id, updatedAt: Date.now()}), 'قُبل الطلب — سيظهر رمز الاستلام لصاحبه');
  },
  reject(el){
    openSheet(`<h2>رفض طلب الاستلام</h2><form data-form="reject" data-id="${esc(el.dataset.id)}" novalidate>
      <div class="field"><label for="rj-note">السبب (يظهر لصاحب الطلب)</label><input id="rj-note" name="note" class="input" maxlength="200" placeholder="مثال: التفاصيل لا تطابق محتوى المحفظة"></div>
      <div class="form-err" hidden></div>
      <div class="btn-row"><button class="btn danger" type="submit">${icon('x')}رفض الطلب</button><button type="button" class="btn ghost" data-act="closeSheet">إلغاء</button></div></form>`);
  },
  verify(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return; const i = item(c.itemId);
    openSheet(`<h2>${icon('shield')} تسليم ${i ? esc(i.ref) : ''}</h2>
      <p class="muted">اطلب من صاحب الطلب إظهار رمز الاستلام من «طلباتي» واكتبه هنا.</p>
      <form data-form="verify" data-id="${esc(c.id)}" novalidate>
        <input name="code" class="input code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="رمز الاستلام">
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}تحقق وسلّم</button><button type="button" class="btn ghost" data-act="closeSheet">إلغاء</button></div>
      </form>`);
  },
  acceptReport(el){ go('add', {fromReport: el.dataset.id}); },
  async pickFor(el){ await write(() => dbx.update('reports/' + el.dataset.r, {staffPick: el.dataset.i, pickedAt: Date.now()}), 'رُشّح الغرض وسيصل التنبيه لصاحب البلاغ'); },
  async pickAll(el){
    const rs = el.dataset.rs.split(',').filter(Boolean); closeSheet();
    for (const r of rs) await write(() => dbx.update('reports/' + r, {staffPick: el.dataset.i, pickedAt: Date.now()}));
    toast('رُشّح الغرض لأصحاب البلاغات');
  },
  newOffice(){ go('officeForm', {}); },
  editOffice(el){ go('officeForm', {id: el.dataset.id}); },
  async toggleOffice(el){ const o = S.offices.find(x => x.id === el.dataset.id); if (o) await write(() => dbx.update('offices/' + o.id, {active: o.active === false})); },
  async approveReq(el){
    const r = S.staffReqs.find(x => x.id === el.dataset.id); if (!r) return;
    const cur = S.staffList.find(s => s.id === r.id);
    const offices = [...new Set([...(cur?.offices || []), ...(r.offices || [])])];
    const ok = await write(() => dbx.set('staff/' + r.id, {offices, note: r.note || '', approvedAt: Date.now(), approvedBy: S.uid}));
    if (ok) await write(() => dbx.update('staffRequests/' + r.id, {status: 'approved', decidedAt: Date.now()}), 'مُنحت الصلاحية');
  },
  async rejectReq(el){ await write(() => dbx.update('staffRequests/' + el.dataset.id, {status: 'rejected', decidedAt: Date.now()}), 'رُفض الطلب'); },
  revoke(el){ confirmSheet('سحب صلاحية الموظف؟', 'لن يتمكن من إضافة المفقودات أو مراجعة طلبات الاستلام.', 'اسحب الصلاحية', () => write(() => dbx.del('staff/' + el.dataset.id), 'سُحبت الصلاحية')); },
  delSamples(){
    const s = S.allItems.filter(i => i.sample);
    confirmSheet(`حذف ${s.length} عناصر توضيحية؟`, 'تُحذف العناصر المعلّمة بـ«مثال» فقط، ولا تتأثر المفقودات الحقيقية.', 'احذف الأمثلة', async () => {
      const b = dbx.batch();
      s.forEach(i => { if (i.photo) b.delete(dbx.ref('itemPhotos/' + i.id)); b.delete(dbx.ref('items/' + i.id)); });
      await write(() => b.commit(), 'حُذفت البيانات التوضيحية');
    });
  },
  confirmYes(){ const fn = PENDING_CONFIRM; PENDING_CONFIRM = null; closeSheet(); if (fn) fn(); },
};

/* ---------- ربط المستمعين ---------- */
export function bindEvents(){
  const app = $('#app');
  app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || !app.contains(el)) return;
    const fn = ACT[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  });
  app.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')){ e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && S.sheet) closeSheet();
  });
  app.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault(); submitForm(f);
  });
  let qTimer;
  app.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q'){ S.filter.q = t.value; clearTimeout(qTimer); qTimer = setTimeout(updateBrowse, 120); }
    if (t.id === 'sq'){ S.staffQ = t.value; clearTimeout(qTimer); qTimer = setTimeout(() => { $('#s-body').innerHTML = staffItems(); hydrate(); }, 120); }
    if (t.name === 'code' && t.classList.contains('code-input')) t.value = t.value.replace(/\D/g, '').slice(0, 6);
  });
  app.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'frange'){ S.filter.range = t.value; updateBrowse(); }
    if (t.id === 'sstatus'){ S.staffStatus = t.value; $('#s-body').innerHTML = staffItems(); hydrate(); }
    if (t.id === 'photo-in') onPhoto(t);
    if (t.name === 'cat' && t.closest('form')) onCatChange(t.closest('form'), t.value, '');
  });
}
