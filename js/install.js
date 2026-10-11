// H25: تثبيت المنصة على الجهاز (PWA)
// المتصفح يُطلق beforeinstallprompt حين يمكن تثبيت الموقع (Chrome وEdge وSamsung Internet في أندرويد والكمبيوتر):
// نحتفظ بالحدث (main.js) ونعرض زر «تثبيت» في الوقت المناسب: بطاقة في «طلباتي» لمن لديه طلب أو بلاغ، وسطر في نافذة الحساب.
// Safari في الآيفون لا يُطلق الحدث: نعرض خطوات «إضافة إلى الشاشة الرئيسية» بدل الزر.
// لا شيء يُرسل إلى الخادم: الاختيار («لاحقاً» أو «ثُبّتت») محفوظ في هذا الجهاز فقط (localStorage عبر LS)
import { LS } from './utils.js';

let evt = null;
const OFF_DAYS = 60;   // «لاحقاً» يخفي البطاقة 60 يوماً (السطر في نافذة الحساب يبقى)

export const standalone = () => {
  try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; }
};
// Safari في الآيفون أو الآيباد (الآيباد الحديث يعرّف نفسه «Macintosh» مع شاشة لمس). لا المتصفحات داخل التطبيقات (إنستغرام…)
const iosSafari = () => {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok/.test(ua);
};
// 'prompt' = زر تثبيت حقيقي، 'ios' = خطوات Safari، '' = مثبّتة أو المتصفح لا يدعم التثبيت
export function installMode(){
  if (standalone() || LS.get('installed', 0)) return '';
  if (evt) return 'prompt';
  return iosSafari() ? 'ios' : '';
}
export const installSnoozed = () => Date.now() - Number(LS.get('installOff', 0) || 0) < OFF_DAYS * 864e5;
export const snoozeInstall = () => LS.set('installOff', Date.now());
export function setInstallEvt(e){ evt = e; }
export function markInstalled(){ evt = null; LS.set('installed', 1); }
// نافذة التثبيت من المتصفح (مرة واحدة لكل حدث): 'accepted' أو 'dismissed' أو '' عند الفشل
export async function promptInstall(){
  if (!evt) return '';
  const e = evt; evt = null;
  try { await e.prompt(); const r = await e.userChoice; return r?.outcome || ''; } catch { return ''; }
}
