// الإحصاءات والتصدير (للموظف والإدارة): تُحسب عند فتح صفحتها فقط، من كل أغراض المكتب (قراءة لكل غرض).
// لا اشتراك دائم، حفاظاً على حصة القراءة اليومية في الخطة المجانية.
import { dbx } from './firebase.js';
import { S, touch } from './state.js';
import { catName, subLabel, statusLabel, ITEM_STATUS, oName, keepDaysOf } from './constants.js';
import { t, locale } from './i18n.js';
import { dayNum, daysAgo, isoDay, spotName, today, toast, disposalLabel, TZ } from './utils.js';

const loading = new Set();
// كل أغراض المكتب بكل حالاتها (مرة واحدة، و«تحديث» يعيد الجلب)
export async function loadStats(officeId, force = false){
  if (!officeId || loading.has(officeId) || (S.stats[officeId] && !force)) return;
  loading.add(officeId);
  try {
    const [items, reports, secrets, done, pub] = await Promise.all([dbx.list('items', [['officeId', '==', officeId]]), dbx.list('reports', [['officeId', '==', officeId]]).catch(() => []),
      dbx.list('itemSecrets', [['officeId', '==', officeId]]).catch(() => []),
      // الطلبات المكتملة: للتقييم فقط (مساواة فقط، فلا فهرس مركّب)
      dbx.list('claims', [['officeId', '==', officeId], ['status', '==', 'done']]).catch(() => []),
      dbx.get('publicStats/' + officeId).catch(() => null)]);
    // مكان العثور سري (المرحلة E5): نأخذه من itemSecrets، ونضم spot فقط (لا شيء غيره من التفاصيل السرية)
    const spotOf = Object.fromEntries(secrets.filter(x => x.spot !== undefined).map(x => [x.id, x.spot]));
    // من الطلبات نحتفظ بالتقييم فقط (لا بيانات أصحابها)
    const ratings = done.filter(c => Number.isInteger(c.rating) && c.rating >= 1 && c.rating <= 5).map(c => ({rating: c.rating, note: c.ratingNote || '', at: c.ratedAt || 0}));
    S.stats[officeId] = {items: items.map(i => i.id in spotOf ? {...i, spot: spotOf[i.id]} : i), reports, ratings, at: Date.now()};
    publishPublic(officeId, pub);
  } catch (e){ console.warn(e); S.stats[officeId] = {items: [], reports: [], ratings: [], at: Date.now(), error: true}; }
  finally { loading.delete(officeId); touch(); }
}

// الرضا: المتوسط (منزلة عشرية واحدة)، والعدد، والتوزيع 1–5، وآخر 10 تعليقات
export function ratingStats(ratings = []){
  const n = ratings.length, dist = [1, 2, 3, 4, 5].map(k => ({k, n: ratings.filter(r => r.rating === k).length}));
  return {n, avg: n ? Math.round(10 * ratings.reduce((a, r) => a + r.rating, 0) / n) / 10 : null, dist,
    notes: ratings.filter(r => r.note.trim()).sort((a, b) => b.at - a.at).slice(0, 10)};
}

/* مؤشرات المكتب للزوار (publicStats/{officeId}): أرقام مجمّعة فقط، يكتبها جهاز الموظف عند فتح الإحصاءات
   إذا تغيّرت الأرقام أو مضى يوم على آخر تحديث. الزائر يقرأ وثيقة واحدة في صفحة «مؤشرات المكتب» */
async function publishPublic(officeId, old){
  const data = S.stats[officeId]; const office = S.offices.find(o => o.id === officeId); if (!data || !office) return;
  const s = computeStats(data.items, office, data.reports), r = ratingStats(data.ratings), m = s.months[s.months.length - 1];
  const next = {month: m?.key || today().slice(0, 7), monthReceived: m?.found || 0, monthReturned: m?.ret || 0,
    totalReceived: s.total, totalReturned: s.returned, returnRate: s.rate ?? 0, avgDays: s.avgDays ?? 0,
    avgRating: r.avg ?? 0, ratings: r.n};
  const same = old && Object.keys(next).every(k => old[k] === next[k]);
  if (same && Date.now() - (old.updatedAt || 0) < 864e5) return;
  try { await dbx.set('publicStats/' + officeId, {...next, updatedAt: Date.now()}); S.pubStats[officeId] = {...next, updatedAt: Date.now()}; }
  catch (e){ console.warn('[publicStats]', e?.code || e); }
}
// للزائر: وثيقة المؤشرات (قراءة واحدة عند فتح الصفحة)
export async function loadPublicStats(officeId){
  if (!officeId || officeId in S.pubStats) return;
  S.pubStats[officeId] = 'loading';
  try { S.pubStats[officeId] = await dbx.get('publicStats/' + officeId); } catch (e){ console.warn(e); S.pubStats[officeId] = null; }
  touch();
}

// الأرقام: نسبة الإعادة = المُسلَّم ÷ (المتاح + المحجوز + المُسلَّم + المُتصرَّف فيه)، مثل جدول الإدارة. الأمثلة لا تُحسب
export function computeStats(items, office, reports = []){
  const real = items.filter(i => !i.sample);
  const n = st => real.filter(i => i.status === st).length;
  const returned = real.filter(i => i.status === 'returned');
  const base = n('available') + n('reserved') + returned.length + n('disposed');
  const days = returned.filter(i => i.returnedAt && i.foundDate).map(i => Math.max(0, Math.round(i.returnedAt / 864e5 - dayNum(i.foundDate))));
  // حسب التصنيف: الأكثر أولاً، وما بعد السابع يُجمع في «أخرى»
  const byCat = Object.values(real.reduce((m, i) => { const k = i.cat || 'other'; (m[k] ||= {id: k, n: 0, ret: 0}).n++; if (i.status === 'returned') m[k].ret++; return m; }, {}))
    .sort((a, b) => b.n - a.n);
  const cats = byCat.length > 8 ? [...byCat.slice(0, 7), byCat.slice(7).reduce((o, c) => ({...o, n: o.n + c.n, ret: o.ret + c.ret}), {id: '_rest', n: 0, ret: 0})] : byCat;
  // آخر 6 أشهر: ما وُجد (بتاريخ العثور) وما أُعيد (بتاريخ الإعادة)
  // الشهر الحالي بتوقيت الرياض، ومنتصف كل شهر بتوقيت غرينتش حتى لا ينزلق الشهر مع منطقة الجهاز
  const [cy, cm] = today().split('-').map(Number), months = [];
  for (let k = 5; k >= 0; k--){ const d = new Date(Date.UTC(cy, cm - 1 - k, 15)); months.push({key: isoDay(d.getTime()).slice(0, 7), date: d, found: 0, ret: 0}); }
  const mi = Object.fromEntries(months.map((m, x) => [m.key, x]));
  for (const i of real){
    const f = mi[String(i.foundDate || '').slice(0, 7)]; if (f !== undefined) months[f].found++;
    const r = i.status === 'returned' && i.returnedAt ? mi[isoDay(i.returnedAt).slice(0, 7)] : undefined; if (r !== undefined) months[r].ret++;
  }
  // أكثر أماكن العثور
  const spots = Object.entries(real.reduce((m, i) => { const k = i.spot || ''; m[k] = (m[k] || 0) + 1; return m; }, {}))
    .map(([s, c]) => ({s, n: c})).sort((a, b) => b.n - a.n).slice(0, 5);
  return {
    total: real.length, returned: returned.length, held: n('available') + n('reserved'), disposed: n('disposed'),
    over: real.filter(i => i.status === 'available' && daysAgo(i.foundDate) > keepDaysOf(i.cat, office)).length,   // مدة التصنيف إن كانت أقصر
    rate: base ? Math.round(100 * returned.length / base) : null,
    avgDays: days.length ? Math.round(10 * days.reduce((a, b) => a + b, 0) / days.length) / 10 : null,
    cats, months, spots,
    // أكثر أماكن الفقد (من بلاغات المفقودين)
    // البلاغات المغلقة حسب السبب: أرجع المكتب الغرض، أو وجده صاحبه بنفسه، أو قديمة بلا سبب (قبل المرحلة E)
    closed: ['office', 'self', 'none'].map(k => ({k, n: reports.filter(r => r.status === 'closed' && (r.closedReason || 'none') === k).length})),
    lost: Object.entries(reports.reduce((m, r) => { const k = r.spot || ''; m[k] = (m[k] || 0) + 1; return m; }, {})).map(([s, c]) => ({s, n: c})).sort((a, b) => b.n - a.n).slice(0, 5),
  };
}
export const monthName = d => { try { return new Intl.DateTimeFormat(locale(), {month: 'short', timeZone: TZ}).format(d); } catch { return String(d.getUTCMonth() + 1); } };

/* ---------- تصدير CSV (يفتح في Excel بالعربية) ---------- */
// خلية آمنة: علامات الاقتباس، ومنع تنفيذ الصيغ في Excel (قيمة تبدأ بـ = أو + أو - أو @)
const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
export async function exportCsv(officeId){
  await loadStats(officeId);
  const items = S.stats[officeId]?.items || [];
  if (!items.length){ toast(t('sx.csvEmpty')); return; }
  // الحقول العامة فقط: لا تفاصيل سرية في ملف قد يُرسل خارج المكتب، باستثناء مكان العثور (من itemSecrets، للإحصاء)
  const office = S.offices.find(o => o.id === officeId);
  const cols = ['ref', 'category', 'type', 'place', 'foundDate', 'status', 'returnedDate', 'disposal', 'createdAt', 'sample'];
  const rows = items.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(i => [
    i.ref, catName(i.cat), subLabel(i.sub), spotName(i.spot, officeId), i.foundDate,
    statusLabel(ITEM_STATUS[i.status]) || i.status, isoDay(i.returnedAt), i.disposal ? disposalLabel(i.disposal) : '',
    isoDay(i.createdAt), i.sample ? t('c.sample') : '']);
  const csv = '\uFEFF' + [cols.map(c => t('csv.' + c)), ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = `mafqoodak-${(office?.code || officeId).toLowerCase()}-${today()}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t('sx.csvDone', {name: oName(office) || officeId}));
}
