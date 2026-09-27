// الأحداث: الضغط على الأزرار وإرسال النماذج
import { icon, cat, catName, colorName, statusLabel, ITEM_STATUS, CATS, COLORS } from './constants.js';
import { t, tp, tAr, LANG, setLang } from './i18n.js';
import { $, esc, today, relDay, pill, sha, genCode, makeRef, compress, dataUrlToBlob, matchScore, toast, LS, isBuilding, roomWord, makeBlur, publicTitle, showTitle, isoDay } from './utils.js';
import { loadStats, exportCsv } from './stats.js';
import { S, curOffice, item, full, modes, homeRoute, setOffice, write, authErr, getPhoto, cachePhoto, MATCH_MIN, ACTIVE, refreshCounts, loadExtraItems, loadClaimHistory, loadAdminCounts } from './state.js';
import * as wf from './workflow.js';
import { auth, dbx, GoogleAuthProvider, signInWithPopup, signInWithRedirect, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification } from './firebase.js';
import { go, back, renderAll, openSheet, closeSheet, hydrate, renderNav, tabEntry, safeAvatar } from './ui.js';
import { updateBrowse } from './views/visitor.js';
import { updateStaff, staffItems, claimChecks, keepLeft } from './views/staff.js';
import { FORM, subsPicker, pubPhoto, person, themePicker } from './views/common.js';
import { setTheme } from './theme.js';
import { notifySupported, notifyOn, notifyDenied, toggleNotify, emailUser, emailFinder } from './notify.js';
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
  if (sens && (FORM.photo || FORM.hadPhoto)){ clearPhoto(form); toast(t('a.photoRemoved')); }
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
  } catch { toast(t('a.photoFail')); }
}

/* ---------- الذكاء الاصطناعي ---------- */
async function aiFill(){
  const btn = $('#ai-btn'), st = $('#ai-status'); if (!FORM.blob || !btn) return;
  btn.disabled = true; st.innerHTML = `<span class="spin" style="width:14px;height:14px"></span> ${t('a.aiAnalyzing')}`;
  try {
    const r = await analyzePhoto(FORM.blob);
    const f = btn.closest('form');
    // لا نضع ناتج الذكاء الاصطناعي في querySelector إلا إن كان من معرّفات التصنيفات والألوان المعروفة
    if (CATS.some(c => c.id === r?.cat) && f.querySelector(`input[name=cat][value="${r.cat}"]`)){ f.querySelector(`input[name=cat][value="${r.cat}"]`).checked = true; onCatChange(f, r.cat, r.sub); }
    if (COLORS.some(c => c.id === r?.color)){ const cc = f.querySelector(`input[name=color][value="${r.color}"]`); if (cc) cc.checked = true; }
    if (r?.title) f.querySelector('[name=title]').value = String(r.title).slice(0, 80);
    if (r?.desc) f.querySelector('[name=desc]').value = String(r.desc).slice(0, 600);
    st.innerHTML = `${icon('check')} ${t('a.aiFilled')}`;
  } catch (e){ console.warn(e); st.textContent = aiErrMsg(e); }
  finally { btn.disabled = !FORM.blob; }
}
async function aiMatch(reportId){
  const r = S.myReports.find(x => x.id === reportId); const st = $('#ai-' + reportId); if (!r) return;
  const pool = S.items.filter(i => i.status === 'available' || i.status === 'reserved')
    .map(i => ({i, s: matchScore(r, i)})).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.i);
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
    const matches = await rankMatches(r, pool, images, imgIds);
    const ok = await write(() => dbx.update('reports/' + r.id, {ai: {at: Date.now(), matches}}), t(matches.length ? 'a.aiRanked' : 'a.aiNoMatch'));
    if (!ok && st?.isConnected) st.textContent = '';
  } catch (e){ console.warn(e); if (st?.isConnected) st.textContent = aiErrMsg(e); }
}

/* ---------- إرسال النماذج ---------- */
async function submitForm(form){
  const kind = form.dataset.form; const fd = new FormData(form); formErr(form, '');
  const val = k => String(fd.get(k) || '').trim();
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
        await dbx.set('users/' + cred.user.uid, {name, email, photo: '', lastSeen: Date.now()}, {merge: true}).catch(() => {});
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
        const rows = sampleItems(id, office.code);
        const b2 = dbx.batch(); rows.forEach(s => b2.set(dbx.ref('items/' + s.id), s.data)); await b2.commit();
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
    const i = item(form.dataset.id);
    // المتاح والمحجوز يقبلان الطلب (المحجوز: طلب منافس يراجعه المكتب قبل التسليم)
    if (!i || !ACTIVE.includes(i.status)) return formErr(form, t('cl.unavailable'));
    if (!S.verified) return formErr(form, t('a.verifyFirst'));
    if (val('proof').length < 15) return formErr(form, t('a.proofShort'));
    if (!fd.get('pledge')) return formErr(form, t('a.needPledge'));
    // طلب واحد فقط لكل مستخدم على كل غرض: رقم الطلب ثابت = رقم الغرض_رقم المستخدم
    const id = `${i.id}_${S.uid}`;
    const dup = t('cl.already');
    if (S.myClaims.some(c => c.id === id)) return formErr(form, dup);
    busy(form, true);
    if (await dbx.get('claims/' + id).catch(() => null)){ busy(form, false); return formErr(form, dup); }
    const code = genCode(); const codeHash = await sha(id + ':' + code);
    LS.set('codes', {...LS.get('codes', {}), [id]: code});
    await dbx.set('users/' + S.uid + '/private/codes', {codes: {[id]: code}}, {merge: true}).catch(e => console.warn(e));
    try {
      await dbx.set('claims/' + id, {itemId: i.id, officeId: i.officeId, uid: S.uid, proof: val('proof').slice(0, 1200),
        color: val('color'), brand: val('brand').slice(0, 40), lostSpot: val('spot'), bldg, room, lostDate: val('lostDate'),
        ...(val('reportId') ? {reportId: val('reportId').slice(0, 100)} : {}),
        status: 'pending', codeHash, createdAt: Date.now()});
    } catch (e){
      console.warn(e); busy(form, false);
      return formErr(form, String(e?.code || '').includes('permission-denied')
        ? t('a.claimDenied')
        : t('a.claimFail'));
    }
    busy(form, false); toast(t('a.claimSent')); S.hist = []; go('mine', {}, false);
    return;
  }

  if (kind === 'report' || kind === 'item'){
    const catId = val('cat');
    if (!catId) return formErr(form, t('a.needCat'));
    if (!val('title')) return formErr(form, t('a.needTitle'));
    const sens = cat(catId).sensitive;
    busy(form, true);

    if (kind === 'report'){
      if (!S.verified){ busy(form, false); return formErr(form, t('a.verifyFirst')); }
      const id = dbx.newId('reports');
      const withPhoto = !!FORM.photo && !sens;
      const ok = await write(() => dbx.set('reports/' + id, {officeId: S.officeId, uid: S.uid, cat: catId, sub: val('sub'), color: val('color'),
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
    // المستند العام: لا لون ولا وصف ولا مبنى ولا قاعة ولا موضع حفظ (القواعد ترفضها)
    const data = {
      officeId, ref: existing?.ref || makeRef(curOffice()),
      cat: catId, sub: val('sub'), title: publicTitle(catId, val('sub')), spot: val('spot'),
      foundDate: val('foundDate') || today(), photo: redo ? false : photo,
      status: existing?.status || 'available', createdBy: existing?.createdBy || S.uid, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
      sample: !!existing?.sample,
    };
    if (fromReport) data.fromReport = fromReport;   // ربط الغرض بالبلاغ الذي قُبل
    if (fromFound) data.fromFound = fromFound;      // ربط الغرض بإشعار التسليم
    // التعديل يعيد كتابة المستند كاملاً: نحافظ على الحقول التي لا يعرضها النموذج
    for (const k of ['fromReport', 'fromFound', 'reservedFor', 'returnedAt', 'disposal', 'disposedAt']) if (existing?.[k] !== undefined) data[k] = existing[k];
    // التفاصيل السرية: لموظفي المكتب فقط
    const secret = {officeId, title: val('title'), color: val('color'), brand: val('brand').slice(0, 40), desc: val('desc'), bldg, room, storage: val('storage')};
    for (const k of ['handoverNote', 'disposalNote']) if (existing?.[k]) secret[k] = existing[k];
    // حذف الصورة عند الحاجة يسبق حفظ الغرض
    if (removing){
      await dbx.del('itemPhotos/' + id).catch(e => console.warn(e));
      if (existing.photo !== true) await dbx.del('itemPhotosPrivate/' + id).catch(e => console.warn(e));
      cachePhoto(id, null); cachePhoto('p_' + id, null);
    }
    // الترتيب: items أولاً (القواعد تتحقق من مكتبه)، ثم itemSecrets والصور
    const ok = await write(() => dbx.set('items/' + id, data), existing ? t('a.itemUpdated') : t('a.itemSaved', {ref: data.ref}));
    if (ok) await write(() => dbx.set('itemSecrets/' + id, secret));
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
        if (saved) await write(() => dbx.update('items/' + id, {photo: mode}));
      }
    }
    busy(form, false);
    if (!ok) return;
    // قيد في سجل الحيازة، ومعه ترشيح الغرض لصاحب البلاغ أو تأكيد استلام إشعار التسليم (batch واحد)
    const linked = await write(() => wf.itemSaved({...data, id}, {created: !existing, fromReport, fromFound}),
      fromReport ? t('a.reportAccepted') : fromFound ? t('hi.receivedToast') : '');
    // بريد اختياري (EmailJS): لصاحب البلاغ بأن المكتب رشّح له غرضاً، وللواجد بأن المكتب استلم ما وجده
    if (linked && fromReport) emailUser(S.reports.find(r => r.id === fromReport)?.uid, 'pick', {ref: data.ref});
    if (linked && fromFound) emailUser(S.found.find(f => f.id === fromFound)?.uid, 'received', {ref: data.ref});
    if (existing){ back(); return; }
    // المطابقة على جهة الموظف تشمل التفاصيل السرية
    const matches = S.reports.filter(r => r.status === 'open' && r.id !== fromReport && matchScore(r, {...data, ...secret, id}) >= MATCH_MIN);
    S.hist = []; S.staffTab = fromReport || fromFound ? 'reports' : 'items'; go('staff', {}, false);
    if (matches.length) openSheet(`<h2>${icon('bell')} ${t('a.matchesTitle', {reports: tp('n.matchReports', matches.length)})}</h2>
      <div class="list">${matches.map(r => `<div class="box"><b>${esc(r.title)}</b><span class="meta">${esc(catName(r.cat))} · ${esc(colorName(r.color))} · ${t('st.lostOn', {date: relDay(r.lostDate)})}</span>${r.desc ? `<div class="proof">${esc(r.desc)}</div>` : ''}</div>`).join('')}</div>
      <p class="muted">${t('a.matchesHint')}</p>
      <div class="btn-row"><button class="btn" data-act="pickAll" data-i="${esc(id)}" data-rs="${esc(matches.map(r => r.id).join(','))}">${icon('check')}${t('a.pickAll')}</button><button class="btn ghost" data-act="closeSheet">${t('a.later')}</button></div>`);
    return;
  }

  if (kind === 'join'){
    const offices = fd.getAll('offices').map(String);
    if (!offices.length) return formErr(form, t('a.needOffice'));
    if (!val('note')) return formErr(form, t('a.needNote'));
    busy(form, true);
    const ok = await write(() => dbx.set('staffRequests/' + S.uid, {offices, note: val('note').slice(0, 120), status: 'pending', createdAt: Date.now()}), t('a.reqSent'));
    busy(form, false); if (ok) go('office', {}, false);
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
      spots: val('spots').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40),
      active: old ? old.active !== false : true, createdAt: old?.createdAt || Date.now()};
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
    const c = S.claims.find(x => x.id === form.dataset.id); const code = val('code').replace(/\D/g, '');
    if (!c) return;
    if (code.length !== 6) return formErr(form, t('a.code6'));
    if (await sha(c.id + ':' + code) !== c.codeHash) return formErr(form, t('a.codeWrong'));
    busy(form, true);
    // التسليم فقط للطلب الذي حُجز له الغرض، وتُغلق بقية طلباته في العملية نفسها
    let res = null; const it = item(c.itemId);   // قبل التسليم: الغرض المُسلَّم يخرج من قائمة النشطة
    const ok = await write(async () => { res = await wf.verifyHandover(c); }, t('a.handedOver'));
    busy(form, false); if (!ok) return;
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
        if (['done', 'rejected', 'expired', 'cancelled'].includes(c.status)) await dbx.update('claims/' + c.id, {uid: 'deleted', proof: '', color: '', brand: '', lostSpot: '', bldg: '', room: '', lostDate: '', ...(c.answer ? {answer: ''} : {}), anonymizedAt: Date.now()});
        else if (c.status === 'pending') await dbx.del('claims/' + c.id);
      }
      // إشعارات التسليم: المستلَم يبقى سجلاً للمكتب بلا بيانات صاحبه، والبقية تُحذف
      const found = await dbx.list('foundReports', [['uid', '==', user.uid]]);
      for (const f of found){
        if (f.status === 'received') await dbx.update('foundReports/' + f.id, {uid: 'deleted', note: ''});
        else await dbx.del('foundReports/' + f.id);
      }
      await dbx.del('users/' + user.uid + '/private/codes');
      await dbx.del('staffRequests/' + user.uid).catch(() => {});
      await dbx.del('users/' + user.uid);
      // 4) حذف الحساب نفسه من Firebase Authentication
      await deleteUser(user);
    } catch (e){
      console.warn(e); busy(form, false);
      return formErr(form, String(e?.code || '').includes('permission-denied') ? t('a.delDenied') : t('a.delFail'));
    }
    LS.set('codes', {}); LS.set('seen', []); LS.set('mode', 'visitor');
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
    const ok = await write(() => dbx.set('foundReports/' + id, {officeId: S.officeId, uid: S.uid, cat: catId, sub: val('sub'), spot: val('spot'), bldg, room,
      foundDate: val('foundDate') || today(), note: val('note').slice(0, 500), status: 'pending', createdAt: Date.now()}), t('hi.sent'));
    busy(form, false); if (ok){ S.hist = []; go('mine', {focus: id}, false); }
    return;
  }
  // سؤال تحقق يرسله الموظف لصاحب طلب قيد المراجعة
  if (kind === 'ask'){
    const c = S.claims.find(x => x.id === form.dataset.id); if (!c) return;
    busy(form, true);
    const ok = await write(() => wf.askQuestion(c, val('question')), t('qa.sent'));
    busy(form, false); if (ok){ closeSheet(); emailUser(c.uid, 'question', {ref: item(c.itemId)?.ref || ''}); }
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
    busy(form, false); if (ok){ closeSheet(); emailUser(c.uid, 'rejected', {ref: item(c.itemId)?.ref || '', note: val('note') || '—'}); } return;
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

const ACT = {
  nav(el){
    const r = el.dataset.r, tab = el.dataset.tab;
    if (r === 'staff' && tab){ S.staffTab = tab; if (S.route.name === 'staff'){ updateStaff(); renderNav(); window.scrollTo(0, 0); return; } }
    if (r === 'admin' && tab) S.adminTab = tab;
    const fromNav = !!el.closest('#nav, .top-links, .brand');
    if (fromNav) S.hist = [];
    go(r, {}, !fromNav);
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
  account(){
    openSheet(`<div class="person" style="gap:12px">${safeAvatar(S.me?.photo) ? `<img src="${esc(S.me.photo)}" alt="" referrerpolicy="no-referrer" style="width:44px;height:44px">` : ''}<div><b>${esc(S.me?.name || '')}</b><div class="meta" dir="ltr">${esc(S.me?.email || '')}</div></div></div>
      <div class="list">
        <button class="opt" data-act="nav" data-r="mine">${icon('inbox')}${t('acc.mine')}</button>
        <button class="opt" data-act="lang" lang="${t('lang.otherCode')}">${icon('globe')}${t('foot.lang')}</button>
        ${notifySupported() ? `<button class="opt" data-act="notify" aria-pressed="${notifyOn()}">${icon('bell')}<span class="grow">${t('nt.label')}</span><span class="pill ${notifyOn() ? 'ok' : 'mute'}">${t(notifyOn() ? 'nt.on' : 'nt.off')}</span></button>
          ${notifyDenied() ? `<p class="hint">${t('nt.deniedHint')}</p>` : ''}` : ''}
        <div class="opt-row"><span class="label">${icon('contrast')}${t('th.label')}</span>${themePicker()}</div>
        <button class="opt" data-act="signOut">${icon('x')}${t('acc.signOut')}</button>
        <button class="opt" data-act="nav" data-r="privacy">${icon('lock')}${t('acc.privacy')}</button>
        <button class="opt" data-act="deleteAccount" style="color:var(--bad)">${icon('trash')}${t('acc.delete')}</button>
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
    catch { openSheet(`<h2>${icon('share')} ${t('share.link')}</h2><input class="input" dir="ltr" readonly value="${esc(url)}" onfocus="this.select()"><button class="btn ghost" data-act="closeSheet">${t('c.close')}</button>`); }
  },
  async signOut(){ closeSheet(); S.mode = 'visitor'; LS.set('mode', 'visitor'); S.hist = []; S.route = {name: 'home', params: {}}; await signOut(auth); toast(t('a.signedOut')); },
  pickOffice(){ go('pick'); },
  // المظهر: يُطبَّق فوراً ويُحدَّث الزر المختار دون إعادة رسم
  theme(el){
    setTheme(el.dataset.v);
    el.parentElement.querySelectorAll('button').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  },
  // إشعارات المتصفح: تفعيل أو إيقاف
  async notify(el){
    const r = await toggleNotify();
    toast(t('nt.t.' + r));
    if (S.sheet) ACT.account();   // نعيد رسم نافذة الحساب بالحالة الجديدة
  },
  // تبديل اللغة: يُحفظ على الجهاز، وفي users.lang لمن سجّل دخوله (يتبعه على أجهزته الأخرى)
  lang(){
    closeSheet();
    setLang(LANG === 'ar' ? 'en' : 'ar');
    if (auth) auth.languageCode = LANG;   // رسائل Firebase (توثيق البريد، استعادة كلمة المرور) بنفس اللغة
    if (S.uid) dbx.set('users/' + S.uid, {lang: LANG}, {merge: true}).catch(e => console.warn(e));
    renderAll(); window.scrollTo(0, 0);
  },
  setOffice(el){ setOffice(el.dataset.id); },
  mode(el){ const m = el.dataset.v; if (!modes().includes(m)) return; S.mode = m; LS.set('mode', m); S.hist = []; go(homeRoute(), {}, false); },
  openItem(el){ go('item', {id: el.dataset.id}); },
  goClaim(el){ if (!needLogin()) go('claim', {id: el.dataset.id}); },
  fcat(el){ S.filter.cat = el.dataset.id; updateBrowse(); },
  catGo(el){ S.filter.cat = el.dataset.id; S.filter.q = ''; S.filter.status = 'available'; go('browse'); },
  fstatus(el){ S.filter.status = el.dataset.v; updateBrowse(); },
  sTab(el){ S.staffTab = el.dataset.v; updateStaff(); renderNav(); },
  closeSheet(){ closeSheet(); },
  copy(el){ const v = el.dataset.v; navigator.clipboard?.writeText(v).then(() => toast(t('a.copied')), () => toast(v)); },
  removePhoto(el){ clearPhoto(el.closest('form')); },
  aiFill(){ if (aiReady()) aiFill(); },
  aiMatch(el){ if (aiReady()) aiMatch(el.dataset.id); },
  closeReport(el){ write(() => dbx.update('reports/' + el.dataset.id, {status: 'closed', closedAt: Date.now()}), t('a.reportClosed')); },
  delReport(el){
    confirmSheet(t('a.delReportQ'), t('a.delReportBody'), t('a.delReportBtn'), async () => {
      const r = S.reports.find(x => x.id === el.dataset.id);
      if (r?.photo) await write(() => dbx.del('reportPhotos/' + r.id));
      await write(() => dbx.del('reports/' + el.dataset.id), t('a.reportDeleted'));
    });
  },
  editItem(el){ go('add', {id: el.dataset.id}); },
  // تغيير الحالة يدوياً: متاح، أو سُلّم مباشرة (بملاحظة تسليم)، أو مؤرشف. «محجوز» يأتي من قبول طلب فقط
  itemStatus(el){
    const i = item(el.dataset.id); if (!i) return;
    const opts = ['available', 'returned', 'archived'];
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
    const i = item(c.itemId);
    if (!i){ toast(t('it.gone')); return; }
    const o = S.offices.find(x => x.id === i.officeId);
    const go2 = async () => { if (await write(() => wf.approveClaim(c), t('a.approved'))) emailUser(c.uid, 'approved', {ref: i.ref, date: isoDay(Date.now() + wf.pickupDays(o) * 864e5)}); };
    // تطابق ضعيف: أقل من 2 من 3 في جدول المقارنة
    const {hits} = claimChecks(c, full(i));
    if (hits < 2) return confirmSheet(t('a.weakQ'), t('a.weakBody', {n: hits}), t('a.weakBtn'), go2, false);
    go2();
  },
  release(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return;
    confirmSheet(t('a.reopenQ'), t('a.releaseBody'), t('st.release'),
      () => write(() => wf.releaseReservation(c), t('a.released')), false);
  },
  // التصرّف في الأغراض التي تجاوزت مدة الحفظ (إجراء جماعي)
  dispose(){
    const over = S.items.filter(i => i.status === 'available' && keepLeft(i) < 0).map(full);
    if (!over.length) return toast(t('a.noneOver'));
    openSheet(`<h2>${icon('clock')} ${t('a.disposeTitle', {items: tp('n.itemGen', over.length)})}</h2>
      <form data-form="dispose" novalidate>
        <div class="list">${over.map(i => `<label class="check"><input type="checkbox" name="ids" value="${esc(i.id)}" checked><span><b>${esc(i.ref)}</b> ${esc(showTitle(i))} <span class="muted">· ${relDay(i.foundDate)}</span></span></label>`).join('')}</div>
        <div class="field"><span class="label">${t('a.method')}</span>
          ${Object.keys(wf.DISPOSAL).map(k => `<label class="check"><input type="radio" name="method" value="${k}"><span>${t('disposal.' + k)}</span></label>`).join('')}</div>
        <div class="field"><label for="dp-note">${t('a.noteStaff')}</label><input id="dp-note" name="note" class="input" maxlength="300" placeholder="${t('a.disposePh')}"></div>
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('a.disposeBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
      </form>`);
  },
  claimHist(){ loadClaimHistory(); },
  adminRefresh(){ loadAdminCounts(true); },
  // تعبئة طلب الاستلام من بلاغ المستخدم المفتوح
  useReport(el){
    const r = S.myReports.find(x => x.id === el.dataset.id); const f = el.closest('form'); if (!r || !f) return;
    const cc = f.querySelector(`input[name=color][value="${COLORS.some(c => c.id === r.color) ? r.color : ''}"]`); if (cc) cc.checked = true;
    const sp = f.querySelector('[name=spot]'); if (sp && [...sp.options].some(o => o.value === r.spot)){ sp.value = r.spot; onSpotChange(f, r.spot); }
    if (r.bldg) f.querySelector('[name=bldg]').value = r.bldg;
    if (r.room) f.querySelector('[name=room]').value = r.room;
    if (r.lostDate){ const d = f.querySelector('[name=lostDate]'); d.value = r.lostDate; const h = d.parentElement.querySelector('.date-hint'); if (h) h.hidden = true; }
    if (r.desc) f.querySelector('[name=proof]').value = r.desc;
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
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return; const i = item(c.itemId);
    const sugs = [...(i ? t('qa.sug.' + i.cat).split('|') : []), t('qa.sugAny')].filter(Boolean);
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
  verify(el){
    const c = S.claims.find(x => x.id === el.dataset.id); if (!c) return; const i = item(c.itemId);
    openSheet(`<h2>${icon('shield')} ${t('a.handTitle', {ref: i ? esc(i.ref) : ''})}</h2>
      <p class="muted">${t('a.askCode', {who: person(c.uid)})}</p>
      <div class="note warn">${icon('idcard')}<span>${t('a.matchId')}</span></div>
      <form data-form="verify" data-id="${esc(c.id)}" novalidate>
        <input name="code" class="input code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="${t('mine.code')}">
        <div class="form-err" hidden></div>
        <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('a.verifyBtn')}</button><button type="button" class="btn ghost" data-act="closeSheet">${t('c.cancel')}</button></div>
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
  statsRefresh(el){ loadStats(el.dataset.id, true); },
  async exportCsv(el){ el.disabled = true; try { await exportCsv(el.dataset.id); } finally { el.disabled = false; } },
  // إشعار التسليم: الموظف يستلم الغرض (نموذج الغرض معبّأ)، أو يغلق الإشعار إن لم يصل الغرض
  async receiveFound(el){
    const f = S.found.find(x => x.id === el.dataset.id); if (!f) return;
    const done = S.items.find(i => i.fromFound === f.id);
    if (done){ if (await write(() => wf.itemSaved(done, {fromFound: f.id}), t('hi.receivedToast'))) emailUser(f.uid, 'received', {ref: done.ref}); return; }
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
      emailUser(S.reports.find(r => r.id === el.dataset.r)?.uid, 'pick', {ref: item(el.dataset.i)?.ref || ''});
  },
  async pickAll(el){
    const rs = el.dataset.rs.split(',').filter(Boolean); closeSheet();
    for (const r of rs) if (await write(() => dbx.update('reports/' + r, {staffPick: el.dataset.i, pickedAt: Date.now()})))
      emailUser(S.reports.find(x => x.id === r)?.uid, 'pick', {ref: item(el.dataset.i)?.ref || ''});
    toast(t('a.pickedAll'));
  },
  newOffice(){ go('officeForm', {}); },
  editOffice(el){ go('officeForm', {id: el.dataset.id}); },
  async toggleOffice(el){ const o = S.offices.find(x => x.id === el.dataset.id); if (o) await write(() => dbx.update('offices/' + o.id, {active: o.active === false})); },
  async approveReq(el){
    const r = S.staffReqs.find(x => x.id === el.dataset.id); if (!r) return;
    const cur = S.staffList.find(s => s.id === r.id);
    const offices = [...new Set([...(cur?.offices || []), ...(r.offices || [])])];
    const ok = await write(() => dbx.set('staff/' + r.id, {offices, note: r.note || '', approvedAt: Date.now(), approvedBy: S.uid}));
    if (ok) await write(() => dbx.update('staffRequests/' + r.id, {status: 'approved', decidedAt: Date.now()}), t('a.granted'));
  },
  async rejectReq(el){ await write(() => dbx.update('staffRequests/' + el.dataset.id, {status: 'rejected', decidedAt: Date.now()}), t('a.reqRejected')); },
  revoke(el){ confirmSheet(t('a.revokeQ'), t('a.revokeBody'), t('a.revokeBtn'), () => write(() => dbx.del('staff/' + el.dataset.id), t('a.revoked'))); },
  async delSamples(){
    // تُجلب الأمثلة عند الطلب فقط (لا اشتراك دائم في كل الأغراض)
    const s = await dbx.list('items', [['sample', '==', true]]).catch(() => []);
    if (!s.length) return toast(t('a.noSamples'));
    confirmSheet(t('a.delSamplesQ', {items: tp('n.sampleGen', s.length)}), t('a.delSamplesBody'), t('a.delSamplesBtn'), async () => {
      for (const i of s){ await delItemParts(i); await dbx.del('items/' + i.id).catch(e => console.warn(e)); }
      S.counts.samples = 0; toast(t('a.samplesDeleted')); renderAll();
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
    if (t.id === 'sstatus'){
      S.staffStatus = t.value; $('#s-body').innerHTML = staffItems(); hydrate();
      // المُسلَّم والمؤرشف والمُتصرَّف فيه تُجلب عند اختيار الفلتر فقط
      if (t.value !== 'active') loadExtraItems(t.value);
    }
    if (t.id === 'photo-in') onPhoto(t);
    // تلميح خانة التاريخ الاختيارية يظهر فقط وهي فارغة
    if (t.type === 'date'){ const h = t.parentElement.querySelector('.date-hint'); if (h) h.hidden = !!t.value; }
    if (t.name === 'spot' && t.closest('form')) onSpotChange(t.closest('form'), t.value);
    if (t.name === 'cat' && t.closest('form')) onCatChange(t.closest('form'), t.value, '');
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
  app.addEventListener('focusout', e => { if (e.target.matches?.('[data-tip-v]')) hideTip(); });
  // التمرير يخفي تلميح المؤشر، ويُبقي تلميح العنصر المُركَّز عليه (مع إعادة تحديد مكانه)
  window.addEventListener('scroll', () => { const a = document.activeElement; if (a?.matches?.('[data-tip-v]')) showTip(a); else hideTip(); }, {passive: true});
}
