// الإحصاءات والتصدير (للموظف والإدارة): تُحسب عند فتح صفحتها فقط، من كل أغراض المكتب (قراءة لكل غرض).
// لا اشتراك دائم، حفاظاً على حصة القراءة اليومية في الخطة المجانية.
import { dbx } from './firebase.js';
import { S, touch } from './state.js';
import { catName, subLabel, statusLabel, ITEM_STATUS, oName, keepDaysOf } from './constants.js';
import { t, locale } from './i18n.js';
import { dayNum, daysAgo, isoDay, spotName, today, toast, disposalLabel } from './utils.js';

const loading = new Set();
// كل أغراض المكتب بكل حالاتها (مرة واحدة، و«تحديث» يعيد الجلب)
export async function loadStats(officeId, force = false){
  if (!officeId || loading.has(officeId) || (S.stats[officeId] && !force)) return;
  loading.add(officeId);
  try {
    const [items, reports] = await Promise.all([dbx.list('items', [['officeId', '==', officeId]]), dbx.list('reports', [['officeId', '==', officeId]]).catch(() => [])]);
    S.stats[officeId] = {items, reports, at: Date.now()};
  } catch (e){ console.warn(e); S.stats[officeId] = {items: [], reports: [], at: Date.now(), error: true}; }
  finally { loading.delete(officeId); touch(); }
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
  const now = new Date(), months = [];
  for (let k = 5; k >= 0; k--){ const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push({key: isoDay(d.getTime()).slice(0, 7), date: d, found: 0, ret: 0}); }
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
export const monthName = d => { try { return new Intl.DateTimeFormat(locale(), {month: 'short'}).format(d); } catch { return String(d.getMonth() + 1); } };

/* ---------- تصدير CSV (يفتح في Excel بالعربية) ---------- */
// خلية آمنة: علامات الاقتباس، ومنع تنفيذ الصيغ في Excel (قيمة تبدأ بـ = أو + أو - أو @)
const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
export async function exportCsv(officeId){
  await loadStats(officeId);
  const items = S.stats[officeId]?.items || [];
  if (!items.length){ toast(t('sx.csvEmpty')); return; }
  // الحقول العامة فقط: لا تفاصيل سرية في ملف قد يُرسل خارج المكتب
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
