// التنبيهات خارج شاشة التطبيق:
// 1) إشعارات المتصفح (يفعّلها المستخدم من نافذة الحساب): تصل والتطبيق مفتوح أو في الخلفية.
//    الإشعار والتطبيق مغلق تماماً يحتاج خادماً (Cloud Functions)، وهو خارج الخطة المجانية (انظر docs/ROADMAP.md).
// 2) البريد عبر EmailJS (اختياري، معطّل حتى تُكتب مفاتيحه في js/config.js): يرسله متصفح الموظف بعد قراره.
import { S, alertKeys, isStaffHere, answered, staffNew, unseenCount } from './state.js';
import { dbx } from './firebase.js';
import { SETTINGS } from './config.js';
import { t, LANG } from './i18n.js';
import { LS } from './utils.js';

/* ---------- إشعارات المتصفح ---------- */
export const notifySupported = () => 'Notification' in window;
export const notifyOn = () => notifySupported() && Notification.permission === 'granted' && LS.get('notify', false) === true;
export const notifyDenied = () => notifySupported() && Notification.permission === 'denied';

// تفعيل أو إيقاف (يطلب إذن المتصفح أول مرة)
export async function toggleNotify(){
  if (!notifySupported()) return 'unsupported';
  if (notifyOn()){ LS.set('notify', false); return 'off'; }
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p !== 'granted') return 'denied';
  LS.set('notify', true); show(t('nt.enabled'), 'enabled');
  return 'on';
}
async function show(body, tag){
  const opts = {body, tag, lang: LANG, dir: LANG === 'ar' ? 'rtl' : 'ltr', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png'};
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg){ await reg.showNotification(t('app.name'), opts); return; } } catch (e){ console.warn(e); }
  try { new Notification(t('app.name'), opts); } catch (e){ console.warn(e); }
}

// نص الإشعار لكل نوع تنبيه (مفاتيح alertKeys في state.js، ومفاتيح الموظف بالأسفل)
export function msgOf(k){
  const [type, , st] = k.split(':');
  return ({p: 'nt.pick', m: 'nt.match', q: 'nt.question', d: 'nt.pickupSoon', s: 'nt.stale', sc: 'nt.newClaim', sa: 'nt.answer', sf: 'nt.found'})[type]
    || (type === 'f' ? (st === 'ret' ? 'nt.foundReturned' : st === 'fin' ? 'nt.foundYours' : 'nt.foundReceived') : '')
    || (type === 'c' ? (st === 'approved' ? 'nt.approved' : st === 'rejected' ? 'nt.rejected' : 'nt.claimChanged') : 'nt.update');
}
function currentKeys(){
  const keys = S.uid ? alertKeys() : [];
  if (isStaffHere()){
    for (const c of S.claims){
      if (c.status !== 'pending' || c.uid === S.uid) continue;
      keys.push('sc:' + c.id);                                     // طلب استلام جديد
      if (answered(c)) keys.push(`sa:${c.id}:${c.answeredAt}`);    // إجابة عن سؤال التحقق
    }
    for (const f of S.found) keys.push('sf:' + f.id);              // إشعار تسليم من واجد
  }
  return keys;
}
// يُستدعى بعد كل تحديث للبيانات: ما ظهر من تنبيهات جديدة والتطبيق في الخلفية يصل إشعاراً
const known = new Set(); let who = null, armedAt = 0;
// H6: شارة أيقونة التطبيق والعدد في عنوان الصفحة = الجديد غير المقروء فقط (نفس أرقام الشريط السفلي)، لا عدد العناصر:
// للموظف أحداث «الاستلام» و«البلاغات» الجديدة، ولغيره تنبيهات «طلباتي» غير المقروءة
function staffBadge(){
  const n = isStaffHere() ? staffNew('claims') + staffNew('reports') : S.uid ? unseenCount() : 0;
  document.title = (n ? `(${n}) ` : '') + t('app.title');
  try { if (n) navigator.setAppBadge?.(n); else navigator.clearAppBadge?.(); } catch {}
}
export function checkNotify(){
  staffBadge();
  if (who !== S.uid){ who = S.uid; known.clear(); armedAt = Date.now() + 6000; }   // مهلة أولى: الموجود عند الفتح لا يُشعَر به
  if (!S.uid) return;
  const fresh = currentKeys().filter(k => !known.has(k));
  fresh.forEach(k => known.add(k));
  if (!fresh.length || Date.now() < armedAt || !notifyOn() || document.visibilityState === 'visible') return;
  const seen = new Set(LS.get('seen', []));
  fresh.filter(k => !seen.has(k)).slice(0, 3).forEach(k => show(t(msgOf(k)), k));
}

/* ---------- البريد عبر EmailJS (اختياري) ---------- */
// قالب ثابت لكل لغة (templateIdAr / templateIdEn)، وtemplateId القديم احتياطاً
const templateFor = (e, lang) => (lang === 'en' ? e.templateIdEn : e.templateIdAr) || e.templateId || e.templateIdAr || e.templateIdEn || '';
export const emailReady = () => { const e = SETTINGS.emailNotify || {}; return !!(e.enabled && e.publicKey && e.serviceId && templateFor(e, 'ar')); };
// رسالة عامة فقط بلغة المستلم (users.lang). نصها مكتوب في قالب EmailJS نفسه؛ التطبيق لا يرسل عنواناً ولا نصاً،
// حتى لا يستطيع أحد استخدام المفتاح العام (الموجود في مستودع عام) لإرسال نص يختاره. لا رقم غرض ولا سبب ولا أي تفصيل
export async function emailUser(uid){
  if (!emailReady() || !uid || uid === 'deleted') return;
  try {
    // H18: الاسم واللغة من users/{uid}، والبريد من users/{uid}/private/profile (تقرؤه الإدارة وصاحبه فقط؛
    // قرار موظف غير إداري لا يقرأ البريد فلا تُرسل له رسالة)
    const [u, p] = await Promise.all([dbx.get('users/' + uid), dbx.get(`users/${uid}/private/profile`).catch(() => null)]);
    if (!p?.email) return;
    const lang = u?.lang === 'en' ? 'en' : 'ar', e = SETTINGS.emailNotify;
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({service_id: e.serviceId, template_id: templateFor(e, lang), user_id: e.publicKey,
        // المتغيران الوحيدان: البريد والاسم. رابط التطبيق ونص الرسالة مكتوبان في القالب نفسه على EmailJS
        template_params: {to_email: p.email, to_name: u?.name || ''}}),
    });
    if (!res.ok) console.warn('[emailjs]', res.status);
  } catch (err){ console.warn('[emailjs]', err); }
}
// من وجد الغرض (إشعار التسليم المرتبط به) يُبلَّغ حين يعود الغرض لصاحبه
export async function emailFinder(i){
  if (!emailReady() || !i?.fromFound) return;
  try { const f = await dbx.get('foundReports/' + i.fromFound); if (f?.uid) await emailUser(f.uid); } catch (err){ console.warn(err); }
}
