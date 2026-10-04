// الثوابت: الأيقونات، التصنيفات، الألوان، أنواع المنشآت، الحالات
// لإضافة تصنيف جديد عدّل مصفوفة CATS بالأسفل (مع اسمه الإنجليزي en وأنواعه subsEn).
import { isEn } from './i18n.js';

/* ---------- icons ---------- */
export const P = {
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.7 5.7 3.7 9s-1.2 6.3-3.7 9c-2.5-2.7-3.7-5.7-3.7-9S9.5 5.7 12 3Z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  idcard:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.6-1.3 1.5-2 2.5-2s1.9.7 2.5 2M14 10h4M14 13h3"/>',
  wallet:'<path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"/><path d="M4 7l11-3v3M16 13h2"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  plug:'<path d="M9 3v4M15 3v4M7 7h10v3a5 5 0 0 1-10 0V7Z"/><path d="M12 15v6"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/>',
  ring:'<circle cx="12" cy="14" r="6"/><path d="m9 5 3-2 3 2-3 3-3-3Z"/>',
  glasses:'<circle cx="7" cy="14" r="3.5"/><circle cx="17" cy="14" r="3.5"/><path d="M10.5 14h3M3.5 13 5 7M20.5 13 19 7"/>',
  bag:'<path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9Z"/><path d="M9 5V4a3 3 0 0 1 6 0v1M9 14h6v3H9z"/>',
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3"/>',
  shirt:'<path d="m8 3-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z"/>',
  wrench:'<path d="M15 4a5 5 0 0 0-4.6 6.9L4 17.3 6.7 20l6.4-6.4A5 5 0 0 0 20 9l-3 3-3-1-1-3 3-3a5 5 0 0 0-1-1Z"/>',
  bottle:'<path d="M10 2h4v3l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7.5L10 5V2Z"/><path d="M8.5 11h7"/>',
  box:'<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
  grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  college:'<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v5"/>',
  school:'<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6M4 21h16"/>',
  airport:'<path d="M10.5 3.5c0-1 .7-1.5 1.5-1.5s1.5.5 1.5 1.5V9l7 4v2l-7-2v5l2 1.5V21l-3.5-1-3.5 1v-1.5L10.5 18v-5l-7 2v-2l7-4V3.5Z"/>',
  mall:'<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  hospital:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  back:'<path d="m9 6 6 6-6 6"/>',
  fwd:'<path d="m15 6-6 6 6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  inbox:'<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8Z"/>',
  dots:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  building:'<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20"/><path d="M8 7h4M8 11h4M8 15h4"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.7 2.6 3 5.2"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m12 8 1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2L12 8Z"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  shield:'<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share:'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  tag:'<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  question:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.2.9-1.2 1.7v.4M12 16.8h.01"/>',
  qr:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18v2M20 14v2"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  print:'<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  contrast:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  sample:'<path d="M4 4h16v16H4z" stroke-dasharray="3 3"/>',
  cash:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  alert:'<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
};
// أسهم الاتجاه (رجوع/تقدّم) تنقلب في الإنجليزية (من اليسار لليمين) عبر الصنف dir في CSS
const DIR_ICONS = new Set(['back', 'fwd']);
export const icon = (n, cls='') => `<svg class="i ${DIR_ICONS.has(n) ? 'dir ' : ''}${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||P.box}</svg>`;
export const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><path d="M9 6h17.5L35 14.5V33a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="var(--primary)"/><circle cx="27.5" cy="12.5" r="2.6" fill="var(--bg)"/><circle cx="18" cy="21" r="5.6" fill="none" stroke="var(--primary-ink)" stroke-width="2.4"/><path d="m22.2 25.2 4.3 4.3" stroke="var(--primary-ink)" stroke-width="2.6" stroke-linecap="round"/><path d="M27.5 12.5C30 7 33 4.5 37 4" fill="none" stroke="var(--tag-line)" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/* ---------- reference data ---------- */
// name وsubs: القيم العربية المخزّنة (لا تتغيّر). en وsubsEn: للعرض بالإنجليزية فقط، بنفس الترتيب.
// أسئلة التصنيف (المرحلتان D وE): كل سؤال يُسأل في مكانين، ويضع جدول المقارنة الإجابتين جنباً إلى جنب:
//   الموظف يسجّل الإجابة سراً عند إضافة الغرض (itemSecrets.details)، وصاحب الطلب يُسأل السؤال نفسه (claims.details)،
//   وبلاغ المفقود يحفظها أيضاً (reports.details) لتعبئة الطلب منه لاحقاً.
// claim: {fields, req, details, hint}
//   fields: أيٌّ من 'color' و'brand' يظهر · req: الإجبارية منها في طلب الاستلام
//   details: [{k, type, req, opts, as}]
//     type: 'num' أرقام · 'approx' رقم تقريبي · 'last4' أربعة أرقام · 'text' نص قصير · 'pick' اختيار من opts (يُحفظ معرّف الخيار)
//     req: 'both' إجباري للموظف ولصاحب الطلب · 'staff' للموظف فقط · 'claim' لصاحب الطلب فقط (نموذج البلاغ: كلها اختيارية)
//     as: حقل موجود في الطلب يقارَن به بدل سؤال جديد (claimantName، idLast4)، فلا يُسأل صاحب الطلب مرتين
//   hint: مفتاح تلميح خانة الإثبات الحرة (cl.h.<id>)
// staffCheck: مفتاح نصيحة الموظف (sc.<id>). التسميات في القاموسين: df.<k> وdf.<k>.ph، وdf.<cat>.<k> تتقدم عليها،
//   وخيارات pick: df.<k>.<opt>، وتسمية اللون الخاصة: df.<cat>.color
// retentionDays: مدة حفظ خاصة بالتصنيف، تُطبَّق إن كانت أقصر من مدة المكتب. disposal: طريقة التصرّف المقترحة.
// publicName/publicEn: الاسم في الإعلان العام بدل اسم النوع (النقود: «مبلغ مالي» دون المبلغ)
const CB = ['color', 'brand'];
const q = (k, type = 'text', req = '', x = {}) => ({k, type, req, ...x});
/* v7: تقوية إثبات الملكية */
// الأغراض الثمينة: للتسليم المباشر والحذف بصلاحية الإدارة فقط (H14: القبول بموظف واحد لكل التصنيفات).
// نفس القائمة highValue() في firestore.rules — عدّلهما معاً
export const HIGH_VALUE = ['cash', 'phones', 'jewelry', 'ids', 'wallets'];
// فحوص التسليم حسب التصنيف (مفاتيح نصوص في القاموسين ho.*): يعلّمها الموظف كلها قبل «تحقق وسلّم»، وتُحفظ مفاتيحها في السجل
const HANDOVER = {
  // «افتح الجهاز» أو «طابق IMEI» بديلان، فهما مربع واحد (كل المربعات إلزامية)
  phones: ['ho.phones.unlock'],
  ids: ['ho.ids.face', 'ho.ids.name'],
  cash: ['ho.cash.amount'],
  keys: ['ho.keys.try'],
  wallets: ['ho.wallets.inside'],
};
export const handoverChecks = catId => HANDOVER[catId] || ['ho.generic'];
export const isHighValue = catId => HIGH_VALUE.includes(catId);
// حدود «الصيد» (نفسها في القواعد): 3 طلبات جارية، وطلب واحد لكل تصنيف كل 24 ساعة
export const CLAIM_MAX_OPEN = 3, CLAIM_CAT_MS = 24 * 36e5;
/* H10: autoSuggest:false = لا اقتراح آلي «قد يكون لك» للزائر في هذا التصنيف: عنوانه العام عام (نقود، بطاقات…)
   أو ما يميّزه سري (المبلغ، آخر 4 أرقام، عدد المفاتيح). المطابقة فيه عند الموظف فقط بالتفاصيل السرية */
export const autoSuggestOk = id => cat(id).autoSuggest !== false;
/* H11: groupPublic:true = أغراض لا يميّز بينها عنوانها العام (نقود، بطاقات، محافظ، مفاتيح): تظهر للزائر بطاقة مجمّعة واحدة
   لكل تصنيف، ويطلبها بالوصف (طلب مجمّع بلا اختيار غرض)، ويربطها الموظف بالغرض الصحيح.
   GROUP_CATS = groupCats() في firestore.rules (عدّلهما معاً) */
export const isGrouped = id => !!CATS.find(c => c.id === id)?.groupPublic;
export const GROUP_CATS = ['ids', 'cash', 'wallets', 'keys'];
/* H16: hiddenPublic:true (النقود فقط) = لا تظهر للزائر بأي شكل: لا قائمة ولا بحث ولا بطاقة مجمّعة ولا عدّاد ولا رابط.
   صاحبها يقدّم بلاغاً بالتفاصيل (طلب مجمّع بالوصف، H11)، والموظف يطابقه مع المبالغ المسجّلة.
   كل غرض يُكتب فيه public = !isHiddenCat(cat)، والزائر يستعلم بـ public == true فقط.
   HIDDEN_CATS = hiddenCats() في firestore.rules (عدّلهما معاً) */
export const isHiddenCat = id => !!CATS.find(c => c.id === id)?.hiddenPublic;
export const HIDDEN_CATS = ['cash'];
export const pubFlag = catId => !isHiddenCat(catId);
// المطابقة عند الموظف: الأيام بعد تاريخ الفقد، وهامش المبلغ، والمهلة قبل إغلاق الطلب المجمّع دون مطابقة
export const GROUP_DAYS = 14, AMOUNT_TOL = 0.1, GROUP_EXPIRE_DAYS = 30;
// كلمات عامة لا تُعدّ «كلمة مميزة» عند مقارنة عنوان البلاغ ووصفه بالعنوان العام للغرض (بعد التطبيع: بلا همزات وتاء مربوطة)
export const SUGG_STOP = new Set(['في', 'من', 'على', 'الى', 'عن', 'مع', 'فيه', 'فيها', 'لون', 'اللون', 'لونها', 'لونه', 'نوع', 'غرض', 'شي', 'شيء',
  'صغير', 'صغيره', 'كبير', 'كبيره', 'جديد', 'جديده', 'قديم', 'قديمه', 'فقدت', 'ضاع', 'ضاعت', 'ضايع', 'لي', 'حقي', 'حقتي', 'داخل', 'عليه', 'عليها',
  'the', 'a', 'an', 'my', 'of', 'in', 'with', 'and', 'lost', 'small', 'big', 'new', 'old', 'colour', 'color']);
export const CATS = [
  {id:'ids', autoSuggest:false, groupPublic:true, name:'بطاقات ووثائق', en:'Cards & documents', icon:'idcard', sensitive:true, subs:['هوية وطنية','هوية مقيم','بطاقة متدرب','رخصة قيادة','بطاقة بنكية','جواز سفر','وثيقة أخرى'], subsEn:['National ID','Resident ID (Iqama)','Trainee card','Driving licence','Bank card','Passport','Other document'],
    claim:{fields: [], details: [q('docName', 'text', 'staff', {as: 'claimantName'}), q('docLast4', 'last4', 'staff', {as: 'idLast4'}), q('issuer')], hint: 'cl.h.ids'},
    staffCheck: 'sc.ids', retentionDays: 30, disposal: 'authority'},
  {id:'cash', autoSuggest:false, groupPublic:true, hiddenPublic:true, name:'نقود', en:'Cash', icon:'cash', sensitive:true, publicName:'مبلغ مالي', publicEn:'Sum of money', subs:['نقود ورقية','عملات','ظرف نقود'], subsEn:['Banknotes','Coins','Envelope of money'],
    claim:{fields: [], details: [q('amount', 'num', 'both'), q('denoms'), q('holder', 'pick', '', {opts: ['envelope', 'wallet', 'clip', 'none']})], hint: 'cl.h.cash'}, staffCheck: 'sc.cash'},
  {id:'wallets', autoSuggest:false, groupPublic:true, name:'محافظ', en:'Wallets', icon:'wallet', subs:['محفظة رجالية','محفظة نسائية','حافظة بطاقات','محفظة جوال'], subsEn:["Men's wallet","Women's wallet",'Card holder','Phone wallet'],
    claim:{fields: CB, details: [q('cardName'), q('cashInside', 'approx')], hint: 'cl.h.wallets'}},
  {id:'phones', autoSuggest:false, name:'جوالات وأجهزة', en:'Phones & devices', icon:'phone', subs:['جوال','جهاز لوحي','لابتوب','ساعة ذكية'], subsEn:['Phone','Tablet','Laptop','Smartwatch'],
    claim:{fields: CB, req: ['brand'], details: [q('model'), q('lockscreen')], hint: 'cl.h.phones'}, staffCheck: 'sc.phones'},
  {id:'acc', name:'ملحقات إلكترونية', en:'Electronic accessories', icon:'plug', subs:['سماعات','شاحن','كيبل','باور بانك','فلاش USB','آلة حاسبة'], subsEn:['Headphones','Charger','Cable','Power bank','USB flash drive','Calculator'],
    claim:{fields: CB, details: [q('mark')], hint: 'cl.h.acc'}},
  {id:'keys', autoSuggest:false, groupPublic:true, name:'مفاتيح', en:'Keys', icon:'key', subs:['مفتاح سيارة','مفاتيح منزل','ميدالية','بطاقة دخول'], subsEn:['Car key','House keys','Keyring','Access card'],
    claim:{fields: [], details: [q('keyCount', 'num', 'both'), q('keyring'), q('carBrand')], hint: 'cl.h.keys'}},
  {id:'jewelry', autoSuggest:false, name:'مجوهرات وساعات', en:'Jewellery & watches', icon:'ring', subs:['خاتم','سلسال','أسورة','ساعة يد','أقراط'], subsEn:['Ring','Necklace','Bracelet','Wristwatch','Earrings'],
    claim:{fields: CB, details: [q('engraving'), q('size')], hint: 'cl.h.jewelry'}},
  {id:'glasses', name:'نظارات', en:'Glasses', icon:'glasses', subs:['نظارة طبية','نظارة شمسية','علبة نظارة'], subsEn:['Prescription glasses','Sunglasses','Glasses case'],
    claim:{fields: CB, details: [q('caseDesc')], hint: 'cl.h.glasses'}},
  {id:'bags', name:'حقائب', en:'Bags', icon:'bag', subs:['حقيبة ظهر','حقيبة لابتوب','حقيبة يد','حقيبة رياضية'], subsEn:['Backpack','Laptop bag','Handbag','Sports bag'],
    claim:{fields: CB, details: [q('inside', 'text', 'claim')], hint: 'cl.h.bags'}},
  {id:'study', name:'كتب وأدوات دراسية', en:'Books & study supplies', icon:'book', subs:['كتاب','دفتر','ملف أوراق','مقلمة','أدوات هندسية'], subsEn:['Book','Notebook','Document folder','Pencil case','Geometry set'],
    claim:{fields: [], details: [q('bookName'), q('nameOn'), q('inside')], hint: 'cl.h.study'}},
  {id:'clothes', name:'ملابس', en:'Clothing', icon:'shirt', subs:['شماغ أو غترة','عباية','جاكيت','قبعة','حذاء'], subsEn:['Shemagh or ghutra','Abaya','Jacket','Cap','Shoes'],
    claim:{fields: CB, details: [q('size'), q('mark')], hint: 'cl.h.clothes'}},
  {id:'tools', name:'عُدد وأدوات ورش', en:'Workshop tools', icon:'wrench', subs:['عدة يدوية','جهاز قياس','خوذة سلامة','نظارة سلامة','قفازات'], subsEn:['Hand tools','Measuring device','Safety helmet','Safety glasses','Gloves'],
    claim:{fields: CB, details: [q('mark')], hint: 'cl.h.tools'}},
  {id:'bottles', name:'قوارير وحافظات', en:'Bottles & flasks', icon:'bottle', subs:['قارورة ماء','حافظة قهوة (ترمس)','علبة طعام'], subsEn:['Water bottle','Coffee flask (thermos)','Food container'], retentionDays: 14,
    claim:{fields: CB, details: [q('mark')], hint: 'cl.h.bottles'}},
  {id:'other', name:'أخرى', en:'Other', icon:'box', subs:[], subsEn:[]},
];
// مفاتيح أسئلة التصنيف المسموحة: نفس قائمة detailKeys() في firestore.rules حرفياً (عدّلهما معاً)
export const DETAIL_KEYS = ['amount', 'denoms', 'holder', 'docName', 'docLast4', 'issuer', 'cardName', 'cashInside', 'model', 'lockscreen',
  'mark', 'keyCount', 'keyring', 'carBrand', 'engraving', 'size', 'caseDesc', 'inside', 'bookName', 'nameOn'];
// أسئلة التصنيف كاملة (الافتراضي: اللون والماركة، وتلميح عام)
export const claimOf = id => ({fields: CB, req: [], details: [], hint: 'cl.proofHint', ...(cat(id).claim || {})});
// هل في طلب الاستلام سؤال إجباري؟ (عندها تصبح خانة الإثبات الحرة اختيارية: «تفاصيل أخرى تثبت أنه لك»)
export const claimHasRequired = id => { const c = claimOf(id); return c.req.length > 0 || c.details.some(d => d.as || d.req === 'both' || d.req === 'claim'); };
// قيمة إجابة كما تُحفظ: الأرقام الهندية إلى لاتينية، والرقمية أرقام فقط، والنص حتى 80 حرفاً، والاختيار من القائمة فقط
// G1: الأرقام العربية-الهندية (٠-٩) والفارسية (۰-۹) إلى لاتينية (تُصدَّر أيضاً من utils.js)
export const latinDigits = s => String(s ?? '').replace(/[\u0660-\u0669\u06F0-\u06F9]/g, c => String(c.charCodeAt(0) & 0xF));
export function detailValue(d, v){
  v = latinDigits(v).trim();
  if (d.type === 'num' || d.type === 'approx') return v.replace(/\D/g, '').slice(0, 9);
  if (d.type === 'last4') return v.replace(/\D/g, '').slice(0, 4);
  if (d.type === 'pick') return (d.opts || []).includes(v) ? v : '';
  return v.slice(0, 80);
}
// مدة الحفظ الفعلية للغرض: مدة التصنيف إن كانت أقصر من مدة المكتب
export const keepDaysOf = (catId, office) => { const o = Number(office?.retentionDays) || 90, c = cat(catId).retentionDays; return c && c < o ? c : o; };
/* v14 (H19): نهاية مدة الحفظ بالمللي ثانية = يوم العثور (منتصف الليل UTC) + أيام الحفظ. تُكتب في الغرض عند إنشائه (keepUntil)،
   والقواعد تتحقق منها (keepOk: نفس retentionDays لـ ids وbottles هناك) ولا يغيّرها إلا المدير.
   قبلها لا يؤرشف الموظف الغرض ولا يتصرّف فيه */
export const keepUntilOf = (catId, office, foundDate) => {
  const d = Date.parse(String(foundDate || '') + 'T00:00:00Z');
  return Number.isFinite(d) ? d + keepDaysOf(catId, office) * 864e5 : 0;
};
// alt/altEn: كلمات إضافية للبحث باللغتين
export const COLORS = [
  {id:'black',name:'أسود',en:'Black',hex:'#1c1c1c',alt:'اسود سوداء سودا',altEn:'black dark'},
  {id:'white',name:'أبيض',en:'White',hex:'#f7f7f5',alt:'ابيض بيضاء بيضا',altEn:'white'},
  {id:'gray',name:'رمادي',en:'Grey',hex:'#8a8f8e',alt:'رمادي رماديه رصاصي',altEn:'grey gray'},
  {id:'silver',name:'فضي',en:'Silver',hex:'#c9ccd0',alt:'فضي فضيه',altEn:'silver'},
  {id:'gold',name:'ذهبي',en:'Gold',hex:'#c9a13b',alt:'ذهبي ذهبيه',altEn:'gold golden'},
  {id:'brown',name:'بني',en:'Brown',hex:'#7a4e2d',alt:'بني بنيه جلد',altEn:'brown leather'},
  {id:'beige',name:'بيج',en:'Beige',hex:'#d8c3a0',alt:'بيج',altEn:'beige'},
  {id:'red',name:'أحمر',en:'Red',hex:'#c0392b',alt:'احمر حمراء',altEn:'red'},
  {id:'pink',name:'وردي',en:'Pink',hex:'#e48fb0',alt:'وردي زهري',altEn:'pink'},
  {id:'orange',name:'برتقالي',en:'Orange',hex:'#e67e22',alt:'برتقالي',altEn:'orange'},
  {id:'yellow',name:'أصفر',en:'Yellow',hex:'#f1c40f',alt:'اصفر صفراء',altEn:'yellow'},
  {id:'green',name:'أخضر',en:'Green',hex:'#2e8b57',alt:'اخضر خضراء',altEn:'green'},
  {id:'blue',name:'أزرق',en:'Blue',hex:'#2f74c0',alt:'ازرق زرقاء',altEn:'blue'},
  {id:'navy',name:'كحلي',en:'Navy',hex:'#1f2f56',alt:'كحلي',altEn:'navy'},
  {id:'purple',name:'بنفسجي',en:'Purple',hex:'#7d4fa8',alt:'بنفسجي موف',altEn:'purple violet'},
  {id:'multi',name:'متعدد',en:'Multicolour',hex:'conic-gradient(#c0392b,#f1c40f,#2e8b57,#2f74c0,#7d4fa8,#c0392b)',alt:'ملون متعدد',altEn:'multicolour multicolor colourful'},
];
export const OFFICE_TYPES = [
  {id:'college',name:'كلية',en:'College',icon:'college'},
  {id:'university',name:'جامعة',en:'University',icon:'college'},
  {id:'school',name:'مدرسة / معهد',en:'School / institute',icon:'school'},
  {id:'airport',name:'مطار',en:'Airport',icon:'airport'},
  {id:'mall',name:'مجمع تجاري',en:'Shopping mall',icon:'mall'},
  {id:'hospital',name:'مستشفى',en:'Hospital',icon:'hospital'},
  {id:'other',name:'منشأة أخرى',en:'Other facility',icon:'pin'},
];
// l: الاسم العربي، en: الإنجليزي. اعرضها عبر statusLabel()
export const ITEM_STATUS = {
  available:{l:'متاح للاستلام',en:'Available',c:'ok'},
  reserved:{l:'محجوز بانتظار صاحبه',en:'Reserved',c:'warn'},
  returned:{l:'سُلّم لصاحبه',en:'Returned to owner',c:'info'},
  archived:{l:'مؤرشف',en:'Archived',c:'mute'},
  disposed:{l:'انتهت مدة حفظه',en:'Retention period ended',c:'mute'},
};
export const CLAIM_STATUS = {
  pending:{l:'قيد المراجعة',en:'Under review',c:'warn'},
  approved:{l:'جاهز للاستلام',en:'Ready to collect',c:'ok'},
  done:{l:'تم الاستلام',en:'Collected',c:'info'},
  rejected:{l:'لم يُقبل',en:'Not accepted',c:'bad'},
  expired:{l:'انتهى',en:'Ended',c:'mute'},   // H20: قد ينتهي لسبب غير المهلة (الغرض لم يعد متاحاً، أو لا مطابقة)
  cancelled:{l:'أُلغي',en:'Cancelled',c:'mute'},
};
// إشعار التسليم (foundReports) كما يراه الواجد: returned محسوبة من حالة الغرض المرتبط
export const FOUND_STATUS = {
  pending:{l:'بانتظار تسليمه للمكتب',en:'Awaiting hand-in',c:'warn'}, received:{l:'استلمه المكتب',en:'Received by office',c:'info'},
  returned:{l:'عاد لصاحبه',en:'Back with its owner',c:'ok'}, cancelled:{l:'مُلغى',en:'Cancelled',c:'mute'},
  yours:{l:'أصبح لك',en:'Now yours',c:'ok'},   // انتهت مدة حفظه فأُعيد لمن وجده (disposal: finder)
};
export const REPORT_STATUS = { open:{l:'بلاغ مفتوح',en:'Open report',c:'warn'}, closed:{l:'مغلق',en:'Closed',c:'mute'} };
export const MODE_LABEL = {visitor:{l:'زائر',en:'Visitor'}, staff:{l:'موظف المكتب',en:'Office staff'}, admin:{l:'الإدارة',en:'Admin'}};
export const statusLabel = e => e ? (isEn() ? e.en : e.l) : '';

// أسماء أنواع قديمة غيّرناها: القيمة المخزّنة في المستندات القديمة ← الاسم الحالي (للعرض والبحث والمطابقة)
// «مطارة» كانت تُقرأ «مطار» في منصة ستخدم المطارات
export const LEGACY_SUBS = {'مطارة قهوة': 'حافظة قهوة (ترمس)'};
export const subName = s => LEGACY_SUBS[s] || s || '';
export const cat = id => CATS.find(c => c.id === id) || CATS[CATS.length-1];
export const catName = id => isEn() ? cat(id).en : cat(id).name;
// النوع للعرض: القيمة العربية المخزّنة ← اسمها بالإنجليزية إن كانت اللغة إنجليزية
export function subLabel(s){
  const v = subName(s); if (!isEn() || !v) return v;
  for (const c of CATS){ const k = c.subs.indexOf(v); if (k >= 0) return c.subsEn[k] || v; }
  return v;
}
// كل أسماء التصنيف والنوع واللون باللغتين (للبحث: كلمة إنجليزية تجد الأغراض العربية)
export function searchWords(catId, s, colorId){
  const c = cat(catId), v = subName(s), k = c.subs.indexOf(v), col = color(colorId);
  return [c.name, c.en, v, k >= 0 ? c.subsEn[k] : '', col?.name, col?.en, col?.alt, col?.altEn].filter(Boolean).join(' ');
}
export const color = id => COLORS.find(c => c.id === id);
export const colorName = id => { const c = color(id); return c ? (isEn() ? c.en : c.name) : ''; };
export const otype = id => OFFICE_TYPES.find(t => t.id === id) || OFFICE_TYPES[OFFICE_TYPES.length-1];
export const otypeName = id => isEn() ? otype(id).en : otype(id).name;
// بيانات المكتب بلغة الواجهة: الحقول الإنجليزية اختيارية، وإن غابت يُعرض النص العربي
export const oName = o => (isEn() && o?.nameEn) || o?.name || '';
export const oShort = o => (isEn() && (o?.shortEn || o?.nameEn)) || o?.short || o?.name || '';
export const oPlace = o => (isEn() && o?.placeEn) || o?.place || '';
export const oHours = o => (isEn() && o?.hoursEn) || o?.hours || '';
export const oCity = o => (isEn() && o?.cityEn) || o?.city || '';
/* هوية الجهة (H15): شعار الكلية وألوان المؤسسة العامة للتدريب التقني والمهني، بإذن من إدارة الكلية.
   تظهر في مكتب الكلية التقنية بالأحساء فقط (المفتاح = معرّف المكتب)؛ أي مكتب آخر (مطار، مجمع…) يبقى بهوية مفقودك وحدها.
   id: يوضع على <html data-brand="…"> فتتغير الألوان في css/styles.css
   logo/logoWhite: الشعار الأفقي الرسمي (ملوّن للخلفية الفاتحة، وأبيض بأوراقه الملونة للداكنة) · mark/markWhite: النجمة وحدها
   (للترويسة، حيث النص أصغر من أن يُقرأ). الملفات داخل المستودع (icons/college) لا روابط خارجية، لأن CSP لا يسمح إلا بـ 'self'
   links: روابط الكلية المفيدة للمتدرب (نصوصها في القاموس: br.link.<k>) */
export const BRANDS = {
  'tc-ahsa': {
    id: 'tvtc',
    themeColor: '#00343A',   // الأخضر المزرق الداكن في هوية المؤسسة (لون شريط المتصفح في الجوال)
    logo: 'icons/college/tvtc-logo.png', logoWhite: 'icons/college/tvtc-logo-white.png',
    mark: 'icons/college/tvtc-mark.png', markWhite: 'icons/college/tvtc-mark-white.png',
    // H21: أبعاد الملفات الحقيقية (عرض، ارتفاع) لحجز مكان الصورة قبل تحميلها؛ حدّثها إن تغيّر ملف شعار
    size: {'icons/college/tvtc-logo.png': [595, 150], 'icons/college/tvtc-logo-white.png': [604, 150], 'icons/college/tvtc-mark.png': [79, 96], 'icons/college/tvtc-mark-white.png': [81, 96]},
    site: 'https://tvtc.gov.sa/ar/Training-Units/Boys-Colleges/ALAHSATC/Pages/default.aspx',
    links: [
      {k: 'site', url: 'https://tvtc.gov.sa/ar/Training-Units/Boys-Colleges/ALAHSATC/Pages/default.aspx'},
      {k: 'rayat', url: 'https://tvtc.gov.sa/ar/Departments/tvtcdepartments/Rayat/pages/E-Services.aspx'},
      {k: 'lms', url: 'https://lms.elearning.edu.sa/'},
      {k: 'x', url: 'https://x.com/tvtc_g_alahsa'},
    ],
  },
};
export const brandOf = o => (o && BRANDS[o.id]) || null;
export function spotLabel(o, s){
  if (!isEn() || !s || !o) return s || '';
  const k = (o.spots || []).indexOf(s);
  return (k >= 0 && o.spotsEn?.[k]) || s;
}

/* ---------- بيانات نصية عربية للبحث والمطابقة (ليست نصوص واجهة) ---------- */
// كلمات شائعة لا تفيد البحث
export const STOP = new Set(['في','من','على','عن','مع','الى','او','و','لون','فيه','فيها','به','بها','هذا','هذه','لي','كان','تم','عند','قرب','جنب','داخل',
  'the','a','an','of','in','on','at','with','and','or','my','is','it','near']);
// توحيد الكتابة العربية: حذف التشكيل، والأرقام الهندية إلى لاتينية، وتوحيد الهمزات والتاء المربوطة
export function norm(s){
  return latinDigits(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function tokens(s){
  return norm(s).split(' ').map(t => {
    if (t.length > 4 && (t.startsWith('وال') || t.startsWith('بال'))) t = t.slice(3);
    else if (t.length > 3 && t.startsWith('ال')) t = t.slice(2);
    return t;
  }).filter(t => t.length > 1 && !STOP.has(t));
}
// الأماكن داخل مبنى (قاعات، معامل، ورش، المبنى الإداري): نطلب لها رقم المبنى ورقم القاعة
export const isBuilding = s => /قاع|معمل|معامل|ورش|مبنى|مباني/.test(s || '');
// نوع الغرفة حسب المكان (مفتاح في القاموس: room.lab / room.workshop / room.hall / room.office / room.room)
export const roomKind = s => /معمل|معامل/.test(s || '') ? 'lab' : /ورش/.test(s || '') ? 'workshop' : /قاع/.test(s || '') ? 'hall' : /إدار/.test(s || '') ? 'office' : 'room';
