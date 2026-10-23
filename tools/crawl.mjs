// H41: زاحف الأخطاء البرمجية (للمطوّر فقط؛ لا يحمّله التطبيق). Playwright + بديل Firebase التجريبي (tools/a11y-stubs).
// يفتح كل صفحة بكل دور (زائر، صاحب طلب، حساب جديد، بريد غير موثّق، موظف، مالك، مدير) وبكل لغة، ثم يستكشف الحالات:
// يضغط كل زر (data-act) في الصفحة، ثم كل زر في النافذة أو التبويب الذي فتحه (حتى 3 ضغطات متتالية بالعربية و2 بالإنجليزية)،
// ويملأ كل نموذج يظهر ويرسله كما يفعل المستخدم (خطوة بخطوة بزر «التالي»، ثم زر الإرسال)، ثم يعيد كل ما كتب في القاعدة:
//   - والكتابة مرفوضة (deny): لا خطأ برمجي، ورسالة الرفض لا «تعذّر الحفظ» العامة، وزر الإرسال لا يبقى معطّلاً
//   - مع ضغطتين سريعتين على «إرسال» وشبكة بطيئة (slow): لا تتكرر الكتابة (بلاغان أو إشعاران بدل واحد)
// والنموذج المعبّأ فيه صورة صغيرة في أول خانة صورة (الضغط والتمويه وحفظ الصور)
// يفشل عند:
//   - خطأ في الصفحة (pageerror) أو وعد مرفوض بلا معالجة (unhandledrejection) أو console.error
//   - خطأ برمجي ابتلعه catch (TypeError/ReferenceError… في console.warn): كان يظهر للمستخدم «تعذّر الحفظ» فقط
//   - نص مفقود من القاموس ([i18n] missing) أو متغير لم يُعبّأ ({name}) أو undefined/NaN/[object Object]/Invalid Date ظاهر
//   - رسالة فشل عامة (err.save…) والكتابة غير مرفوضة، أو صفحة عالقة على «جارٍ التحميل»
//   - زر يبقى معطّلاً بعد فشل الحفظ، أو كتابة تتكرر بضغطتين سريعتين
// ويحفظ كل كتابة (op، مسار، حقول) في tools/.crawl-writes.json لفحص توافقها مع القواعد (npm run writes).
// التشغيل: cd tools && npm run crawl
//   CRAWL_LANG=ar (لغة واحدة)، CRAWL_ONLY=claim (مسارات تطابق التعبير)، CRAWL_DEPTH=1، CRAWL_WORKERS=4، CRAWL_LOG=1 (كل حالة)،
//   CRAWL_TZ=Pacific/Kiritimati (منطقة زمنية للجهاز بعيدة عن الرياض: التواريخ والتحقق من «تاريخ مستقبلي» بتوقيت الرياض دائماً)،
//   CRAWL_NOTES=1 (ما تعذّر على الزاحف نفسه، مثل نموذج لم يتجاوز خطوته)، CRAWL_CASE=… (تتبّع حالة واحدة، انظر أدناه)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stub = f => fs.readFileSync(path.join(root, 'tools/a11y-stubs', f), 'utf8');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(0);
const PORT = server.address().port;
// وقت الخادم (serverTimestamp) في البديل التجريبي = Date.now()؛ هنا نضيف إليه نصف ملّي ثانية ليُعرف في الكتابات المحفوظة
// (writes.mjs يفحص أن الحقل الذي تشترط القواعد أنه رقم لا يُكتب بوقت الخادم، والعكس)
const FS_STUB = stub('firestore.js').replace('export const serverTimestamp = () => Date.now();', 'export const serverTimestamp = () => Date.now() + 0.5;');
if (!FS_STUB.includes('Date.now() + 0.5')) throw new Error('crawl: serverTimestamp في البديل التجريبي تغيّر؛ حدّث FS_STUB');

/* ---------- بيانات مثال تغطي الحالات: كل حالة غرض وطلب وبلاغ وإشعار، ومباشر ومجمّع، وقديم وجديد ---------- */
const now = Date.now(), h = 36e5, day = 864e5, O = 'tc-ahsa', O2 = 'apt-x';
const ds = n => new Date(now + 3 * h - n * day).toISOString().slice(0, 10);   // تاريخ الرياض قبل n يوم
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
const item = (id, cat, sub, x = {}) => ({officeId: O, ref: 'TCA-' + id.toUpperCase(), cat, sub, title: sub, foundDate: ds(2), photo: false, status: 'available', createdBy: 'staffA',
  createdAt: now - 2 * h, updatedAt: now - h, sample: false, keepUntil: now + 80 * day, public: cat !== 'cash', ...x});
const secret = (x = {}) => ({officeId: O, title: 'تفاصيل', color: 'black', brand: 'Apple', desc: 'غلاف أحمر عليه ملصق 2024', spot: 'المكتبة', bldg: '', room: '', storage: 'الخزانة 1', ...x});
const claim = (no, itemId, uid, x = {}) => ({itemId, officeId: O, uid, no: 'REQ-' + no, proof: 'غلاف أحمر عليه ملصق قطة', color: 'black', brand: 'Apple',
  lostSpot: 'المكتبة', bldg: '', room: '', lostDate: ds(3), claimantName: 'زيد علي', idLast4: '1234', details: {}, status: 'pending', createdAt: now - 5 * h, ...x});
const G1 = `g_zed_wallets_${now - 30 * h}`, G2 = `g_amy_cash_${now - 20 * h}`, G3 = `g_zed_keys_${now - 40 * day}`;
const found = (code, x = {}) => ({officeId: O, uid: 'amy', cat: 'bags', sub: 'حقيبة ظهر', spot: 'الكافتيريا', foundDate: ds(0), note: 'حقيبة', code, status: 'pending', createdAt: now - 2 * h, ...x});
const DB = {
  'config/app': {ownerUid: 'owner', appName: 'مفقودك', createdAt: 1}, 'admins/owner': {role: 'owner'}, 'admins/adm2': {role: 'admin', addedAt: now - 9 * day, addedBy: 'owner'},
  'offices/tc-ahsa': {name: 'الكلية التقنية بالأحساء', short: 'تقنية الأحساء', nameEn: 'Technical College in Al-Ahsa', shortEn: 'TC Al-Ahsa', type: 'college', city: 'الأحساء', cityEn: 'Al-Ahsa',
    place: 'المبنى الإداري', placeEn: 'Admin building', hours: 'الأحد – الخميس، 7:30 ص – 2:30 م', hoursEn: 'Sun–Thu 7:30 am – 2:30 pm', phone: '0135000000',
    retentionDays: 90, pickupDays: 7, reviewDays: 2, spots: ['المكتبة', 'الكافتيريا', 'معامل الحاسب'], spotsEn: ['Library', 'Cafeteria', 'Computer labs'], active: true, createdAt: 1, code: 'TCA'},
  'offices/apt-x': {name: 'مطار تجريبي', short: 'المطار', type: 'airport', city: 'الدمام', place: 'الصالة 1', hours: '24 ساعة', phone: '0130000000', retentionDays: 60, pickupDays: 5, spots: ['الصالة'], active: true, createdAt: 2, code: 'APX'},
  'staff/staffA': {offices: [O], approvedAt: now - 30 * day, approvedBy: 'owner'},
  'users/zed': {name: 'زيد علي', lang: 'ar'}, 'users/amy': {name: 'أمل'}, 'users/staffA': {name: 'موظف المكتب'}, 'users/owner': {name: 'المالك'}, 'users/adm2': {name: 'مدير'},
  'users/zed/private/codes': {codes: {i2_zed: 'K7M3TX9P'}}, 'users/zed/private/profile': {email: 'zed@example.com'},
  'staffInvites/new@example.com': {offices: [O], createdBy: 'owner', createdAt: now - day},
  'items/i1': item('i1', 'phones', 'جوال', {photo: 'clear', pubColor: 'black'}), 'itemSecrets/i1': secret({details: {serial: 'ABCD', model: 'iPhone 13', sim: 'stc'}}),
  'itemPhotos/i1': {data: IMG}, 'itemPhotosPrivate/i1': {officeId: O, data: IMG},
  'items/i2': item('i2', 'bags', 'حقيبة ظهر', {status: 'reserved', reservedFor: 'i2_zed', photo: 'blur'}), 'itemSecrets/i2': secret({color: 'navy', brand: '', details: {inside: 'دفتر رياضيات'}}),
  'itemPhotos/i2': {data: IMG}, 'itemPhotosPrivate/i2': {officeId: O, data: IMG},
  'items/i3': item('i3', 'phones', 'جوال', {status: 'returned', returnedAt: now - day, fromFound: 'f0'}), 'itemSecrets/i3': secret({handoverNote: 'استلمه: زيد علي — آخر 4: 1234'}),
  'items/i4': item('i4', 'wallets', 'محفظة رجالية', {createdAt: now - 3 * day}), 'itemSecrets/i4': secret({color: 'brown', brand: '', details: {cardLast4: '4321', cardName: 'زيد علي'}}),
  'items/i5': item('i5', 'cash', 'نقود ورقية', {title: 'مبلغ مالي'}), 'itemSecrets/i5': secret({color: '', brand: '', details: {amount: '500', denoms: '5 × 100'}}),
  'items/i6': item('i6', 'keys', 'مفتاح سيارة'), 'itemSecrets/i6': secret({color: '', brand: '', details: {keyCount: '2', carBrand: 'تويوتا'}}),
  'items/i7': item('i7', 'ids', 'بطاقة متدرب'), 'itemSecrets/i7': secret({color: '', brand: '', details: {docName: 'زيد علي', docLast4: '1234'}}),
  'items/i8': item('i8', 'jewelry', 'خاتم', {foundDate: ds(100), createdAt: now - 100 * day, keepUntil: now - 10 * day}), 'itemSecrets/i8': secret({color: 'gold', details: {engraving: 'زيد 2020'}}),
  'items/i9': item('i9', 'study', 'دفتر', {status: 'archived'}), 'itemSecrets/i9': secret(),
  'items/i10': item('i10', 'clothes', 'جاكيت', {status: 'disposed', disposal: 'donated', disposedAt: now - day}), 'itemSecrets/i10': secret({disposalNote: 'جمعية خيرية'}),
  'items/i11': item('i11', 'bottles', 'قارورة ماء', {createdAt: now - 5 * day}), 'itemSecrets/i11': secret(),
  // غرض قديم: بلا public ولا keepUntil، ومكانه في الحقل العام (قبل E5)
  'items/i12': (({public: _, keepUntil: __, ...x}) => ({...x, spot: 'الكافتيريا'}))(item('i12', 'glasses', 'نظارة طبية', {createdAt: now - 20 * day})), 'itemSecrets/i12': secret({spot: ''}),
  'items/i13': item('i13', 'acc', 'سماعات', {createdAt: now - 30 * h, sample: true}), 'itemSecrets/i13': secret({details: {serial: 'X9Q2'}}),
  'items/ia': {...item('ia', 'bags', 'حقيبة يد'), officeId: O2, ref: 'APX-IA'}, 'itemSecrets/ia': {...secret(), officeId: O2},
  'claims/i1_zed': claim('7K3M', 'i1', 'zed', {question: 'ما خلفية الشاشة؟', askedAt: now - 3 * h, askedBy: 'staffA', answer: 'صورة قطة', answeredAt: now - 2 * h, proofs: 1, reportId: 'r1',
    details: {serial: 'ABCD', sim: 'stc'}, reg: {id: 'g1', at: now - 10 * day, cat: 'phones', title: 'جوال الدراسة', brand: 'Apple', model: 'iPhone 13', serial: 'ABCD', color: 'black', mark: 'ملصق قطة'}}),
  'claimProofs/i1_zed_0': {claimId: 'i1_zed', officeId: O, uid: 'zed', data: IMG, createdAt: now - 5 * h},
  'claims/i1_amy': claim('9AMY', 'i1', 'amy', {claimantName: 'أمل', idLast4: '9876', proof: 'جوال أسود فيه ملصق', createdAt: now - 4 * h}),
  'claims/i2_zed': claim('9QWE', 'i2', 'zed', {status: 'approved', decidedAt: now - 2 * h, decidedBy: 'staffA', pickupBy: now + 6 * day, delegate: {name: 'سالم خالد', last4: '5678', at: now - h}}),
  'claims/i3_zed': claim('4PRX', 'i3', 'zed', {status: 'done', decidedAt: now - 2 * day, decidedBy: 'staffA', doneAt: now - day, doneBy: 'staffA', handoverNote: 'استلمه: زيد علي — آخر 4: 1234'}),
  'claims/i6_amy': claim('6AMY', 'i6', 'amy', {status: 'rejected', note: 'الوصف لا يطابق', decidedAt: now - day, decidedBy: 'staffA'}),
  'claims/i9_zed': claim('9ZED', 'i9', 'zed', {status: 'expired', note: 'انتهت مهلة الاستلام', decidedAt: now - 2 * day, decidedBy: 'staffA'}),
  'claims/i10_amy': claim('10AM', 'i10', 'amy', {status: 'cancelled', note: 'انتهت مدة الحفظ', decidedAt: now - day, decidedBy: 'staffA'}),
  'claims/i8_zed': claim('8ZED', 'i8', 'zed', {status: 'cancelled', cancelledAt: now - 3 * h}),
  'claims/gone_zed': claim('GONE', 'gone', 'zed', {createdAt: now - 6 * h}),
  [`claims/${G1}`]: claim('G1ZD', '', 'zed', {grouped: true, cat: 'wallets', color: 'brown', brand: '', details: {cardLast4: '4321'}, createdAt: now - 30 * h}),
  [`claimLinks/${G1}`]: {officeId: O, itemId: 'i4', by: 'staffA', at: now - 20 * h},
  [`claims/${G2}`]: claim('G2AM', '', 'amy', {grouped: true, cat: 'cash', color: '', brand: '', details: {amount: '500', holder: 'envelope'}, claimantName: 'أمل', idLast4: '9876', createdAt: now - 20 * h}),
  [`claims/${G3}`]: claim('G3ZD', '', 'zed', {grouped: true, cat: 'keys', color: '', brand: '', details: {keyCount: '3'}, createdAt: now - 40 * day}),
  'claimQuota/zed': {open: ['i1_zed', 'i2_zed', G1], lastByCat: {phones: now - 5 * h}}, 'rate/zed': {at: now - h, n: 3, w: now - 5 * h},
  'reports/r1': {officeId: O, uid: 'zed', cat: 'phones', sub: 'جوال', color: 'black', title: 'جوالي الأسود', desc: 'غلاف أحمر عليه ملصق قطة', spot: 'المكتبة', bldg: '', room: '', lostDate: ds(3),
    photo: true, status: 'open', createdAt: now - 3 * day, contentAt: now - 3 * day, staffPick: 'i1', pickedAt: now - h, details: {sim: 'stc', model: 'iPhone 13'}, rejected: ['i13'],
    ai: {at: now - 2 * h, matches: [{id: 'i1', score: 80, reason: 'اللون والنوع'}]}},
  'reportPhotos/r1': {data: IMG},
  'reports/r2': {officeId: O, uid: 'zed', cat: 'bags', sub: 'حقيبة ظهر', title: 'حقيبة زرقاء', status: 'open', lostDate: ds(70), createdAt: now - 70 * day, spot: 'معامل الحاسب', bldg: '3', room: '105'},
  'reports/r3': {officeId: O, uid: 'zed', cat: 'glasses', title: 'نظارتي', status: 'closed', closedReason: 'self', closedAt: now - day, createdAt: now - 5 * day},
  'reports/r4': {officeId: O, uid: 'amy', cat: 'clothes', sub: 'جاكيت', color: 'navy', title: 'جاكيت كحلي', status: 'open', lostDate: ds(1), createdAt: now - day},
  'reports/r5': {officeId: O, uid: 'zed', cat: 'cash', title: 'مبلغ', status: 'open', lostDate: ds(2), createdAt: now - 2 * day, details: {amount: '300'}},
  'foundReports/f0': found('K7M3TX', {uid: 'zed', cat: 'phones', sub: 'جوال', spot: 'المكتبة', foundDate: ds(3), note: 'وجدته على الطاولة', status: 'received', itemId: 'i3', receivedAt: now - 2 * day, receivedBy: 'staffA', createdAt: now - 3 * day}),
  'foundReports/f1': found('P4RX7C', {uid: 'zed', note: 'حقيبة سوداء', createdAt: now - h}),
  'foundReports/f2': found('W9TE3H', {uid: 'zed', cat: 'keys', sub: '', foundDate: ds(4), status: 'cancelled', cancelledAt: now - 3 * day, createdAt: now - 4 * day}),
  'foundReports/f3': found('A2B3C4'), 'foundReports/f4': found('D5E6F7'), 'foundReports/f5': found('G8H9J2'), 'foundReports/f6': found('K3L4M5'), 'foundReports/f7': found('N6P7Q8'),
  'belongings/g1': {uid: 'zed', cat: 'phones', sub: 'جوال', title: 'جوال الدراسة', brand: 'Apple', model: 'iPhone 13', serial: 'ABCD', color: 'black', mark: 'ملصق قطة', at: now - 10 * day},
  'logs/l1': {officeId: O, itemId: 'i1', claimId: '', reportId: '', action: 'create', by: 'staffA', at: now - 2 * h, note: 'ms:42000'},
  'logs/l2': {officeId: O, itemId: 'i2', claimId: 'i2_zed', reportId: '', action: 'approve', by: 'staffA', at: now - 2 * h, note: ''},
  'logs/l3': {officeId: O, itemId: '', claimId: '', reportId: '', action: 'perm:grant', by: 'owner', at: now - 30 * day, note: 'staffA'},
  'logs/l4': {officeId: O, itemId: 'i3', claimId: 'i3_zed', reportId: '', action: 'handover', by: 'staffA', at: now - day, note: '', checks: ['ho.id']},
  'publicStats/tc-ahsa': {month: ds(0).slice(0, 7), monthReceived: 3, monthReturned: 1, totalReceived: 40, totalReturned: 28, returnRate: 70, avgDays: 3.5, avgRating: 4.5, ratings: 12, updatedAt: now},
};
const USERS = {
  visitor: [null, 'visitor'],
  claimant: [{uid: 'zed', displayName: 'زيد علي', email: 'zed@example.com', providerData: [{providerId: 'password'}]}, 'visitor'],
  fresh: [{uid: 'neo', displayName: 'Neo', email: 'neo@example.com', providerData: [{providerId: 'google.com'}]}, 'visitor'],
  unverified: [{uid: 'unv', displayName: 'Unv', email: 'unv@example.com', emailVerified: false, providerData: [{providerId: 'password'}]}, 'visitor'],
  staff: [{uid: 'staffA', displayName: 'موظف المكتب', email: 's@example.com'}, 'staff'],
  owner: [{uid: 'owner', displayName: 'المالك', email: 'o@example.com'}, 'admin'],
  admin: [{uid: 'adm2', displayName: 'مدير', email: 'a@example.com'}, 'admin'],
};
// الصفحات: [مسار، معاملات، الأدوار]
const V = ['visitor', 'claimant'];
const PAGES = [
  ['home', {}, ['visitor', 'claimant', 'fresh', 'unverified', 'staff', 'owner']], ['browse', {}, V], ['item', {id: 'i1'}, ['visitor', 'claimant', 'staff']], ['item', {id: 'i2'}, ['claimant', 'staff']],
  ['item', {id: 'i3'}, ['claimant', 'staff']], ['item', {id: 'i8'}, ['staff', 'owner']], ['item', {id: 'i9'}, ['staff']], ['item', {id: 'i10'}, ['staff']], ['item', {id: 'i12'}, ['staff']],
  ['item', {id: 'i4'}, ['visitor']], ['item', {id: 'i5'}, ['staff', 'owner']], ['item', {id: 'i13'}, ['staff']],
  ['office', {}, ['visitor']], ['privacy', {}, ['visitor']], ['service', {}, ['visitor']], ['service', {id: 'claim'}, ['visitor']], ['numbers', {}, ['visitor']], ['a11y', {}, ['visitor']],
  ['login', {}, ['visitor']], ['login', {mode: 'signup'}, ['visitor']], ['found', {}, V], ['handin', {}, ['visitor', 'claimant', 'unverified']], ['report', {}, ['visitor', 'claimant', 'unverified']],
  ['report', {id: 'r1'}, ['claimant']], ['claim', {id: 'i1'}, ['claimant', 'fresh', 'unverified']], ['claim', {id: 'i1', report: 'r1'}, ['claimant']], ['claim', {id: 'i6'}, ['claimant']],
  ['gclaim', {cat: 'wallets'}, ['claimant', 'fresh']], ['gclaim', {cat: 'cash'}, ['fresh']],
  ['mine', {}, ['claimant', 'fresh']], ['regs', {}, ['claimant', 'fresh']], ['regAdd', {}, ['claimant']], ['receipt', {id: 'i3_zed'}, ['claimant', 'staff']], ['thanks', {id: 'f0'}, ['claimant']],
  ['done', {kind: 'claim', id: 'i1_zed', no: 'REQ-7K3M', title: 'جوال', cat: 'phones', officeId: O, at: now}, ['claimant']],
  ['done', {kind: 'handin', id: 'f1', code: 'P4RX7C', cat: 'bags', officeId: O, at: now}, ['claimant']],
  ['staff', {tab: 'items'}, ['staff', 'owner']], ['staff', {tab: 'claims'}, ['staff', 'owner']], ['staff', {tab: 'reports'}, ['staff']],
  ['add', {}, ['staff']], ['add', {id: 'i1'}, ['staff']], ['add', {id: 'i4'}, ['staff']], ['add', {fromReport: 'r4'}, ['staff']], ['add', {fromFound: 'f1'}, ['staff']],
  ['stats', {office: O}, ['staff']], ['labels', {ids: ['i1', 'i2']}, ['staff']], ['poster', {office: O}, ['staff']],
  ['admin', {}, ['owner', 'admin']], ['officeForm', {id: O}, ['owner']], ['officeForm', {}, ['owner']], ['audit', {office: O}, ['owner']],
];
// أزرار لا تُضغط: الطباعة وتثبيت المتصفح تفتحان نوافذ النظام
const SKIP = new Set(['print', 'install']);
// رسائل الفشل العامة: تعني استثناءً غير متوقع حين لا تُرفض الكتابة
const GENERIC = ['err.save', 'err.invalid', 'a.claimFail', 'a.setupFail', 'a.loginFail', 'a.delFail', 'bk.fail', 'err.load', 'auth.fail'];

const LANGS = (process.env.CRAWL_LANG || 'ar,en').split(',');
const ONLY = process.env.CRAWL_ONLY ? new RegExp(process.env.CRAWL_ONLY) : null;
const DEPTH = {ar: Number(process.env.CRAWL_DEPTH) || 3, en: Math.min(2, Number(process.env.CRAWL_DEPTH) || 2)};
const WORKERS = Number(process.env.CRAWL_WORKERS) || 4;
const LOG = !!process.env.CRAWL_LOG;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const fails = new Map(), WRITES = new Map(), EXPLORED = new Set(), notes = new Map();
let cases = 0;
const fail = (where, msg) => { const k = msg.replace(/\d{6,}/g, '#').replace(/\bn[a-z0-9]{8}\b/g, '#'); if (!fails.has(k)) fails.set(k, where); };
const note = (where, msg) => { if (!notes.has(msg)) notes.set(msg, where); };
const gone = e => /context was destroyed|navigat|Target page, context or browser has been closed|frame was detached/i.test(String(e?.message || e));

async function open(c){
  const [user, mode] = USERS[c.role];
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true, ...(c.tz ? {timezoneId: c.tz} : {})});
  // أي طلب خارجي آخر يُقطع (لا شبكة في الاختبار). يُسجَّل أولاً لأن Playwright يجرّب آخر مسار مُسجَّل أولاً
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.route(/firebase-app\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeApp = () => ({});'}));
  await ctx.route(/firebase-auth\.js/, r => r.fulfill({contentType: 'text/javascript', body: stub('auth.js')}));
  await ctx.route(/firebase-firestore\.js/, r => r.fulfill({contentType: 'text/javascript', body: FS_STUB}));
  await ctx.route(/firebase-app-check\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const initializeAppCheck = () => ({}); export class ReCaptchaEnterpriseProvider {}'}));
  await ctx.route(/firebase-ai\.js/, r => r.fulfill({contentType: 'text/javascript', body: 'export const getAI = () => ({}); export const getGenerativeModel = () => ({}); export class GoogleAIBackend {}'}));
  await ctx.addInitScript(`window.__errs = []; window.__FAKE = ${JSON.stringify({db: DB, reads: [], writes: [], user})};
    addEventListener('unhandledrejection', e => window.__errs.push('unhandledrejection: ' + String(e.reason?.stack || e.reason?.message || e.reason).split('\\n').slice(0, 3).join(' | ')));
    localStorage.setItem('mfq:office', '"${O}"'); localStorage.setItem('mfq:lang', '"${c.lang}"'); localStorage.setItem('mfq:mode', '"${mode}"');
    window.print = () => {};`);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => {
    const s = m.text();
    if (m.type() === 'error' && !/Failed to load resource|favicon|ERR_FAILED|net::/.test(s)) errs.push('console.error: ' + s.slice(0, 300));
    // خطأ برمجي ابتلعه catch ثم console.warn(e)، أو نص مفقود من القاموس
    if (m.type() === 'warning' && (/\b(TypeError|ReferenceError|RangeError|SyntaxError|URIError)\b|is not a function|Cannot read prop|is not defined|is not iterable|Cannot set prop|Maximum call stack/.test(s) || s.includes('[i18n] missing'))) errs.push('console.warn: ' + s.split('\n').slice(0, 3).join(' | ').slice(0, 300));
  });
  await p.goto(`http://localhost:${PORT}/`);
  await settle(p, 500);
  await p.evaluate(async ([r, pr]) => { (await import('./js/ui.js')).go(r, pr); }, [c.route, c.params]).catch(e => errs.push('go: ' + String(e.message || e).split('\n')[0]));
  await settle(p);
  await p.evaluate(async () => { const m = await import('./js/i18n.js'); window.__T = k => m.t(k); }).catch(() => {});
  return {p, ctx, errs};
}
// انتظار هدوء الصفحة: الوحدات المؤجلة (lazy) تُحمّل، ثم كل <details> مفتوح (يُفحص المحتوى المطوي أيضاً)
async function settle(p, ms = 350){
  await p.waitForTimeout(ms);
  await p.waitForFunction(() => !document.querySelector('#main .loading, #sheet .loading'), null, {timeout: 4000}).catch(() => {});
  await p.waitForTimeout(120);
  await p.evaluate(() => document.querySelectorAll('#main details, #sheet details').forEach(d => { d.open = true; })).catch(() => {});
}
// ما يستطيع المستخدم ضغطه الآن: النافذة إن كانت مفتوحة (تحجب ما خلفها)، وإلا الصفحة كلها
const SCAN = async () => {
  const sh = document.querySelector('#sheet');
  const scope = sh && !sh.hidden && sh.innerHTML.trim() ? sh : document.querySelector('#app');
  const shown = e => { if (e.closest('[hidden]')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const key = e => e.dataset.act + '?' + Object.entries(e.dataset).filter(([k]) => k !== 'act' && k !== 'loaded').sort().map(([k, v]) => k + '=' + v).join('&');
  const region = e => e.closest('#hdr, #nav') ? 'chrome' : e.closest('#sheet') ? 'sheet' : 'main';
  const seen = {};
  const list = [...scope.querySelectorAll('[data-act]')].filter(e => shown(e) && !e.disabled).map(e => {
    const k = key(e); seen[k] = (seen[k] || 0) + 1;
    return {k, n: seen[k] - 1, act: e.dataset.act, region: region(e), text: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)};
  });
  const forms = [...scope.querySelectorAll('form[data-form]')].filter(shown).map(f => ({kind: f.dataset.form, k: Object.entries(f.dataset).filter(([k]) => k !== 'step').sort().map(([k, v]) => k + '=' + v).join('&'), region: region(f)}));
  // الصفحة الحالية (المسار ومعاملاته، والتبويبان الحاليان في لوحة الموظف والإدارة): الزر نفسه في الصفحة نفسها يُضغط مرة واحدة
  // مهما كان الطريق إليها (من الرئيسية أو من الشريط السفلي…)
  let page = '';
  try { const st = (await import('./js/state.js')).S; page = st.route.name + JSON.stringify(st.route.params || {}) + (st.route.name === 'staff' ? '|' + st.staffTab + JSON.stringify(st.staffSub || {}) : st.route.name === 'admin' ? '|' + st.adminTab : ''); } catch {}
  return {sheet: scope.id === 'sheet', list, forms, page};
};
const scan = p => p.evaluate(SCAN);
const clickT = (p, t) => p.evaluate(t => {
  const sh = document.querySelector('#sheet');
  const scope = sh && !sh.hidden && sh.innerHTML.trim() ? sh : document.querySelector('#app');
  const key = e => e.dataset.act + '?' + Object.entries(e.dataset).filter(([k]) => k !== 'act' && k !== 'loaded').sort().map(([k, v]) => k + '=' + v).join('&');
  const m = [...scope.querySelectorAll('[data-act]')].filter(e => !e.closest('[hidden]') && key(e) === t.k)[t.n];
  if (!m) return 'missing';
  if (m.disabled) return 'disabled';
  m.click(); return 'ok';
}, t).catch(e => gone(e) ? 'reloaded' : 'error: ' + String(e.message).split('\n')[0]);
// تعبئة نموذج بقيم معقولة كما يكتبها المستخدم (كل الخطوات). يُعرف النموذج بخصائصه data-* عدا الخطوة الحالية (data-step تتغير)
const FILL = async ([fk, mode]) => {
  const sh = document.querySelector('#sheet');
  const scope = sh && !sh.hidden && sh.innerHTML.trim() ? sh : document;
  const f = [...scope.querySelectorAll('form[data-form]')].find(x => Object.entries(x.dataset).filter(([k]) => k !== 'step').sort().map(([k, v]) => k + '=' + v).join('&') === fk);
  if (!f) return 'no-form';
  const today = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const ev = (el, n) => el.dispatchEvent(new Event(n, {bubbles: true}));
  const set = (el, v) => { el.focus?.(); el.value = v; ev(el, 'input'); ev(el, 'change'); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (mode !== 'empty'){
    // التصنيف أولاً: يرسم أسئلته وخاناته، ثم النوع
    for (const n of ['cat', 'sub']){
      const rs = [...f.querySelectorAll(`input[type=radio][name=${n}]`)];
      if (rs.length && !rs.some(r => r.checked)){ const r = rs.find(x => x.value === 'phones') || rs.find(x => x.value); if (r){ r.checked = true; ev(r, 'change'); ev(r, 'input'); await wait(80); } }
    }
    const VAL = {email: f.dataset.form === 'invite' ? 'new2@example.com' : 'zed@example.com', password: 'Passw0rd!xyz', q: 'جوال', phone: '0135000001', spots: 'المكتبة\nالكافتيريا', spotsEn: 'Library\nCafeteria',
      claimDomains: '', dlast4: '5678', dname: 'سالم خالد', last4: '1234', idLast4: '1234', rlast4: '1234', amount: '500', bldg: '3', room: '105', d_serial: '356938035643809', d_cardLast4: '4321', d_docLast4: '1234'};
    const groups = new Set();
    for (const el of f.querySelectorAll('input, textarea, select')){
      if (el.disabled || el.readOnly || ['hidden', 'file', 'submit', 'button'].includes(el.type)) continue;
      const n = el.name || el.id || '';
      if (el.type === 'radio'){
        if (groups.has(n)) continue; groups.add(n);
        const all = [...f.querySelectorAll(`input[type=radio][name="${CSS.escape(n)}"]`)];
        if (!all.some(x => x.checked)){ const c = all.find(x => x.value) || all[0]; if (c){ c.checked = true; ev(c, 'change'); } }
        continue;
      }
      if (el.type === 'checkbox'){ if (!el.checked && el.name !== 'override' && el.id !== 'l-remember'){ el.checked = true; ev(el, 'change'); } continue; }
      if (el.tagName === 'SELECT'){ if (!el.value){ const o = [...el.options].find(x => x.value); if (o) set(el, o.value); } continue; }
      if (el.value) continue;
      let v = VAL[n];
      if (v == null){
        if (n === 'code') v = el.classList.contains('code-input') ? 'K7M3TX9P' : el.classList.contains('code-in') ? 'P4RX7C' : 'TCB';
        else if (el.type === 'email') v = 'zed@example.com';
        else if (el.type === 'date') v = today;
        else if (el.type === 'number') v = el.min || '5';
        else if (el.classList.contains('num-in') || el.inputMode === 'numeric') v = /last4/i.test(n) ? '1234' : '5';
        else if (el.tagName === 'TEXTAREA') v = 'وصف تجريبي طويل بما يكفي للنموذج 2024';
        else v = 'نص تجريبي';
      }
      if (el.maxLength > 0) v = v.slice(0, el.maxLength);
      set(el, v);
    }
    // صورة صغيرة في أول خانة صورة ظاهرة: ضغط الصورة وتمويهها وحفظها تُختبر أيضاً (صورة البلاغ والغرض وصورة الإثبات)
    const fileIn = [...f.querySelectorAll('input[type=file]')].find(x => !x.disabled && !x.closest('[hidden]'));
    if (fileIn){
      const c = document.createElement('canvas'); c.width = 48; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 48, 32); g.fillStyle = '#36c'; g.fillRect(8, 8, 20, 12);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); dt.items.add(new File([blob], 'photo.png', {type: 'image/png'}));
      fileIn.files = dt.files; ev(fileIn, 'change'); await wait(700);
    }
    await wait(50);
  }
  return 'ok';
};
const fill = (p, fk, mode) => p.evaluate(FILL, [fk, mode]).catch(e => gone(e) ? 'reloaded' : 'error: ' + String(e.message).split('\n')[0]);
// الإرسال كما يفعله المستخدم: «التالي» حتى الخطوة الأخيرة، ثم ضغط زر الإرسال (مرتين بسرعة في اختبار الضغط المزدوج)
const SUBMIT = async ([fk, twice]) => {
  const sh = document.querySelector('#sheet');
  const scope = sh && !sh.hidden && sh.innerHTML.trim() ? sh : document;
  const f = [...scope.querySelectorAll('form[data-form]')].find(x => Object.entries(x.dataset).filter(([k]) => k !== 'step').sort().map(([k, v]) => k + '=' + v).join('&') === fk);
  if (!f) return 'no-form';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; f.dataset.steps && Number(f.dataset.step || 1) < Number(f.dataset.steps) && i < 5; i++){
    const st = f.dataset.step; const nx = [...f.querySelectorAll('[data-act=stepNext]')].find(b => !b.closest('[hidden]'));
    if (!nx) return 'no-next'; nx.click(); await wait(150);
    if (f.dataset.step === st) return 'step-blocked:' + st + ':' + (f.querySelector('.form-err')?.textContent || '').trim().slice(0, 80);
  }
  const b = [...f.querySelectorAll('button[type=submit]')].find(x => !x.closest('[hidden]'));
  if (!b) return 'no-submit';
  if (b.disabled) return 'disabled';
  b.click(); if (twice){ await wait(40); b.click(); }
  return 'ok';
};
const submit = (p, fk, twice) => p.evaluate(SUBMIT, [fk, twice]).catch(e => gone(e) ? 'reloaded' : 'error: ' + String(e.message).split('\n')[0]);
// فحص ما يظهر بعد كل خطوة
async function check(p, errs, where, {deny = false} = {}){
  const r = await p.evaluate(([GENERIC]) => {
    const vis = e => e && !e.closest('[hidden]') && e.getBoundingClientRect().width > 0;
    const text = ['#main', '#sheet', '#hdr', '#nav'].map(s => document.querySelector(s)).filter(vis).map(e => e.innerText).join('\n');
    const toast = document.querySelector('#toast')?.textContent || '';
    const errTxt = [...document.querySelectorAll('.form-err')].filter(vis).map(e => e.textContent).join(' ');
    const stuck = !!document.querySelector('#main > .loading');
    return {bad: [...new Set((text + '\n' + toast).match(/\{[a-zA-Z]\w*\}|\bundefined\b|\bNaN\b|\[object \w+\]|Invalid Date|\bnull\b/g) || [])],
      errs: (window.__errs || []).splice(0), toast, stuck,
      generic: GENERIC.map(k => [k, window.__T?.(k)]).filter(([, s]) => s && (toast.includes(s) || errTxt.includes(s))).map(([k]) => k)};
  }, [GENERIC]).catch(e => gone(e) ? {bad: [], errs: [], toast: '', generic: []} : {bad: [], errs: ['evaluate: ' + String(e.message).split('\n')[0]], toast: '', generic: []});
  for (const e of [...errs.splice(0), ...r.errs]) fail(where, e);
  for (const b of r.bad) fail(where, `يظهر للمستخدم «${b}»`);
  if (r.stuck) fail(where, 'الصفحة عالقة على «جارٍ التحميل»');
  for (const k of r.generic) if (!deny || k === 'err.save') fail(where, `رسالة فشل عامة (${k})${deny ? ' والكتابة مرفوضة (المتوقع err.denied أو رسالة خاصة)' : ' والكتابة غير مرفوضة'}: «${r.toast.slice(0, 80)}»`);
  return r;
}
const writesOf = p => p.evaluate(() => (window.__FAKE?.writes || []).length).catch(() => 0);
const newWrites = (p, from) => p.evaluate(n => (window.__FAKE?.writes || []).slice(n), from).catch(() => []);
const record = (c, ws) => { for (const [op, pth, d] of ws){ const col = pth.split('/').filter((_, i) => i % 2 === 0).join('/');
  const sig = `${op} ${col} ${d ? Object.keys(d).sort().join(',') : ''}`; if (!WRITES.has(sig)) WRITES.set(sig, {op, path: pth, col, data: d, role: c.role, where: label(c)}); } };
const label = c => `${c.role}/${c.lang}${c.tz ? '/' + c.tz : ''}/${c.route}${Object.keys(c.params).length ? JSON.stringify(c.params) : ''}` +
  c.steps.map(t => ` ← ${t.act}${t.text ? ' «' + t.text + '»' : ''}`).join('') + (c.form ? ` ← نموذج ${c.form.kind}${c.mode === 'empty' ? ' (فارغ)' : ''}` : '') +
  (c.variant ? ` — ${({deny: 'الكتابة مرفوضة', double: 'ضغطتان سريعتان وشبكة بطيئة'})[c.variant]}` : '');

/* ---------- الحالات ---------- */
const QUEUE = [];
for (const lang of LANGS) for (const [route, params, roles] of PAGES) for (const role of roles){
  if (ONLY && !ONLY.test(route)) continue;
  QUEUE.push({lang, role, route, params, steps: [], ...(process.env.CRAWL_TZ ? {tz: process.env.CRAWL_TZ} : {})});
}
/* تتبّع حالة واحدة لفهم مشكلة: CRAWL_CASE='owner/ar/home/openItem,approve' (الدور/اللغة/المسار/الأزرار بالترتيب)،
   ومعاملات المسار في CRAWL_PARAMS='{"id":"i1"}'. يطبع بعد كل ضغطة: المسار، والإشعار، وبداية محتوى الصفحة والنافذة، والأخطاء */
if (process.env.CRAWL_CASE){
  const [role, lang, route, acts = ''] = process.env.CRAWL_CASE.split('/');
  const c = {role, lang, route, params: JSON.parse(process.env.CRAWL_PARAMS || '{}'), steps: []};
  const {p, ctx, errs} = await open(c);
  const dump = async tag => console.log(`\n== ${tag}\n`, await p.evaluate(() => JSON.stringify({hash: location.hash, toast: document.querySelector('#toast')?.textContent,
    main: document.querySelector('#main')?.innerText.slice(0, 700), sheet: document.querySelector('#sheet')?.hidden ? '' : document.querySelector('#sheet')?.innerText.slice(0, 500),
    errs: window.__errs}, null, 1)).catch(e => e.message), '\n', errs.splice(0),
    '\n  الأزرار:', (await scan(p).catch(() => ({list: []}))).list.map(x => `${x.act}${x.text ? '«' + x.text + '»' : ''}`).join('، '),
    '\n  الكتابات:', JSON.stringify(await p.evaluate(() => window.__FAKE.writes.map(w => w[0] + ' ' + w[1]))));
  await dump('فتح الصفحة');
  for (const a of acts.split(',').filter(Boolean)){
    const [act, txt] = a.split(':');
    const t = (await scan(p)).list.find(x => x.act === act && (!txt || x.text.includes(txt)));
    if (!t){ console.log('لا يوجد زر', a); break; }
    console.log('ضغط', t.act, t.text, await clickT(p, t)); await settle(p, 500); await dump(a);
  }
  await ctx.close(); await browser.close(); server.close(); process.exit(0);
}
// يُضاف كل زر وكل نموذج مرة واحدة لكل دور ولغة وصفحة حالية (أزرار الشريط العلوي والسفلي مرة واحدة لكل الصفحات)
const fresh = (c, page, region, k) => { const id = `${c.role}|${c.lang}|${region === 'chrome' ? '' : page || c.route + JSON.stringify(c.params)}|${region}|${k}`; if (EXPLORED.has(id)) return false; EXPLORED.add(id); return true; };
// معرّف عشوائي (n + 8 أحرف في البديل) أو فيه وقت (g_<uid>_<cat>_<ms>) = الوثيقة «نفسها» في المقارنة
const norm = w => w[0] + ' ' + w[1].replace(/\/n[a-z0-9]{8}$/, '/*').replace(/\d{6,}/g, '#');

async function runCase(c){
  const where = label(c);
  if (LOG) console.log('…', where);
  const {p, ctx, errs} = await open(c);
  try {
    await check(p, errs, where);
    const last = c.steps.length - 1;
    for (const [i, t] of c.steps.entries()){
      const before = await writesOf(p);
      const denyNow = c.variant === 'deny' && !c.form && i === last;
      if (denyNow) await p.evaluate(() => { window.__FAKE.deny = '.*'; });
      const r = await clickT(p, t);
      if (r === 'missing' || r === 'disabled'){ note(where, `الزر غير موجود عند الإعادة (${r})`); return; }
      if (r.startsWith('error')){ fail(where, 'الزاحف: ' + r); return; }
      await settle(p, r === 'reloaded' ? 900 : 400);
      await check(p, errs, where, {deny: denyNow});
      const ws = await newWrites(p, before);
      if (!c.variant) record(c, ws);
      if (!c.variant && !c.form && i === last && ws.length) QUEUE.push({...c, variant: 'deny'});
      if (denyNow){
        const still = await p.evaluate(t => { const key = e => e.dataset.act + '?' + Object.entries(e.dataset).filter(([k]) => k !== 'act' && k !== 'loaded').sort().map(([k, v]) => k + '=' + v).join('&');
          const m = [...document.querySelectorAll('[data-act]')].filter(e => !e.closest('[hidden]') && key(e) === t.k)[t.n]; return !!(m && m.disabled); }, t).catch(() => false);
        if (still) fail(where, 'الزر بقي معطّلاً بعد فشل الحفظ (لا يستطيع المستخدم إعادة المحاولة)');
      }
    }
    if (c.form){
      const r = await fill(p, c.form.k, c.mode);
      if (r !== 'ok'){ note(where, 'تعذّرت التعبئة: ' + r); return; }
      const before = await writesOf(p);
      if (c.variant === 'deny') await p.evaluate(() => { window.__FAKE.deny = '.*'; });
      if (c.variant === 'double') await p.evaluate(() => { window.__FAKE.slow = 250; });
      const s = await submit(p, c.form.k, c.variant === 'double');
      if (s !== 'ok' && s !== 'reloaded'){ if (c.mode !== 'empty') note(where, 'تعذّر الإرسال: ' + s); return; }
      await settle(p, c.variant === 'double' ? 2600 : 1100);
      await check(p, errs, where, {deny: c.variant === 'deny'});
      const ws = await newWrites(p, before);
      if (!c.variant) record(c, ws);
      if (!c.variant && c.mode === 'fill' && ws.length){
        QUEUE.push({...c, variant: 'deny'});
        QUEUE.push({...c, variant: 'double', single: ws.map(norm)});
      }
      if (c.variant === 'deny'){
        const stuck = await p.evaluate(fk => { const f = [...document.querySelectorAll('form[data-form]')].find(x => Object.entries(x.dataset).filter(([k]) => k !== 'step').sort().map(([k, v]) => k + '=' + v).join('&') === fk);
          const b = f && [...f.querySelectorAll('button[type=submit]')].find(x => !x.closest('[hidden]')); return !!(b && b.disabled); }, c.form.k).catch(() => false);
        if (stuck) fail(where, 'زر الإرسال بقي معطّلاً بعد فشل الحفظ (لا يستطيع المستخدم إعادة المحاولة)');
      }
      if (c.variant === 'double'){
        const cnt = a => a.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
        const a = cnt(c.single), b = cnt(ws.map(norm));
        const extra = Object.entries(b).filter(([k, n]) => n > (a[k] || 0)).map(([k, n]) => `${k} ×${n}`);
        if (extra.length) fail(where, `الضغط المزدوج يكرر الكتابة: ${extra.slice(0, 4).join('، ')}`);
      }
      return;
    }
    if (c.variant || c.steps.length >= DEPTH[c.lang]) return;
    // استكشاف ما ظهر بعد آخر ضغطة: أزرار ونماذج جديدة
    const s = await scan(p).catch(() => null); if (!s) return;
    // ثلاثة على الأكثر من الأزرار المتشابهة التي يختلف رقمها فقط (بطاقات الأغراض والطلبات)؛ أما المختلفة في وجهتها
    // (تبويبات الشريط السفلي data-tab، والأوضاع data-v…) فكلها
    const per = {};
    for (const t of s.list){
      if (SKIP.has(t.act) || (s.sheet && t.act === 'closeSheet')) continue;
      const ck = t.k.replace(/(^|[?&])id=[^&]*/g, '$1');
      per[ck] = (per[ck] || 0) + 1; if (per[ck] > 3) continue;
      if (!fresh(c, s.page, t.region, t.k + '#' + t.n)) continue;
      QUEUE.push({...c, steps: [...c.steps, t]});
    }
    for (const f of s.forms){
      if (!fresh(c, s.page, f.region, 'form:' + f.k)) continue;
      for (const mode of ['empty', 'fill']) QUEUE.push({...c, form: f, mode});
    }
  } catch (e){ if (!gone(e)) fail(where, 'الزاحف: ' + String(e.message || e).split('\n')[0]); }
  finally { cases++; if (cases % 100 === 0) console.log(`… ${cases} حالة، ${QUEUE.length} في الانتظار، ${fails.size} مشكلة`); await ctx.close().catch(() => {}); }
}
const t0 = Date.now();
let active = 0;
await Promise.all(Array.from({length: WORKERS}, async () => {
  for (;;){
    const c = QUEUE.shift();
    if (!c){ if (!active) return; await new Promise(r => setTimeout(r, 200)); continue; }
    active++; try { await runCase(c); } finally { active--; }
  }
}));
await browser.close(); server.close();
fs.writeFileSync(path.join(root, 'tools/.crawl-writes.json'), JSON.stringify([...WRITES.values()], null, 1));
const secs = Math.round((Date.now() - t0) / 1000);
if (notes.size && process.env.CRAWL_NOTES){ console.log(`ℹ ${notes.size} ملاحظة (ليست أخطاء):`); for (const [m, w] of notes) console.log(`  · ${w}: ${m}`); }
if (fails.size){
  console.log(`✘ ${fails.size} مشكلة في ${cases} حالة (${secs} ث):`);
  for (const [msg, where] of fails) console.log(`- ${where}\n    ${msg}`);
  process.exit(1);
}
const acts = new Set([...EXPLORED].map(k => k.split('|').pop()).filter(k => !k.startsWith('form:')).map(k => k.split('?')[0]));
const forms = new Set([...EXPLORED].map(k => k.split('|').pop()).filter(k => k.startsWith('form:')).map(k => (k.match(/form=(\w+)/) || [])[1]));
console.log(`✔ الزاحف: ${cases} حالة (${secs} ث) بلا أخطاء: ${acts.size} نوعاً من الأزرار و${forms.size} نموذجاً، و${WRITES.size} شكل كتابة محفوظ لفحص القواعد.`);
