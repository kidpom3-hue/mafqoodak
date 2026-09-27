// التنبيهات خارج شاشة التطبيق:
// 1) إشعارات المتصفح (يفعّلها المستخدم من نافذة الحساب): تصل والتطبيق مفتوح أو في الخلفية.
//    الإشعار والتطبيق مغلق تماماً يحتاج خادماً (Cloud Functions)، وهو خارج الخطة المجانية (انظر docs/ROADMAP.md).
// 2) البريد عبر EmailJS (اختياري، معطّل حتى تُكتب مفاتيحه في js/config.js): يرسله متصفح الموظف بعد قراره.
import { S, alertKeys, isStaffHere, answered } from './state.js';
import { dbx } from './firebase.js';
import { SETTINGS } from './config.js';
import { t, tIn, LANG } from './i18n.js';
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
function msgOf(k){
  const [type, , st] = k.split(':');
  return ({p: 'nt.pick', m: 'nt.match', q: 'nt.question', sc: 'nt.newClaim', sa: 'nt.answer', sf: 'nt.found'})[type]
    || (type === 'f' ? (st === 'ret' ? 'nt.foundReturned' : 'nt.foundReceived') : '')
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
export function checkNotify(){
  if (who !== S.uid){ who = S.uid; known.clear(); armedAt = Date.now() + 6000; }   // مهلة أولى: الموجود عند الفتح لا يُشعَر به
  if (!S.uid) return;
  const fresh = currentKeys().filter(k => !known.has(k));
  fresh.forEach(k => known.add(k));
  if (!fresh.length || Date.now() < armedAt || !notifyOn() || document.visibilityState === 'visible') return;
  const seen = new Set(LS.get('seen', []));
  fresh.filter(k => !seen.has(k)).slice(0, 3).forEach(k => show(t(msgOf(k)), k));
}

/* ---------- البريد عبر EmailJS (اختياري) ---------- */
export const emailReady = () => { const e = SETTINGS.emailjs || {}; return !!(e.publicKey && e.serviceId && e.templateId); };
// رسالة لمستخدم بلغته (من users.lang): العنوان والنص من القاموسين (em.<نوع>.s وem.<نوع>.b)
export async function emailUser(uid, kind, vars = {}){
  if (!emailReady() || !uid || uid === 'deleted') return;
  try {
    const u = await dbx.get('users/' + uid);   // الموظف يقرأ ملف صاحب الطلب (القواعد تسمح بذلك)
    if (!u?.email) return;
    const lang = u.lang === 'en' ? 'en' : 'ar', e = SETTINGS.emailjs;
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({service_id: e.serviceId, template_id: e.templateId, user_id: e.publicKey,
        // رابط التطبيق مكتوب في القالب نفسه على EmailJS (لا يُرسل من هنا)، حتى لا يستطيع أحد تغييره
        template_params: {to_email: u.email, to_name: u.name || '', subject: tIn(lang, `em.${kind}.s`, vars), message: tIn(lang, `em.${kind}.b`, vars), app_name: tIn(lang, 'app.name')}}),
    });
    if (!res.ok) console.warn('[emailjs]', res.status);
  } catch (err){ console.warn('[emailjs]', err); }
}
// من وجد الغرض (إشعار التسليم المرتبط به) يُبلَّغ حين يعود الغرض لصاحبه
export async function emailFinder(i){
  if (!emailReady() || !i?.fromFound) return;
  try { const f = await dbx.get('foundReports/' + i.fromFound); if (f?.uid) await emailUser(f.uid, 'returned', {ref: i.ref}); } catch (err){ console.warn(err); }
}
