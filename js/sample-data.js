// بيانات توضيحية تُضاف عند الإعداد الأول (اختياري). كل عنصر مُعلّم بـ sample: true
import { today, dayNum } from './utils.js';

const daysBack = n => { const d = new Date((dayNum(today()) - n) * 864e5); return d.toISOString().slice(0, 10); };

export function sampleItems(officeId, code = 'TCA'){
  const now = Date.now();
  const rows = [
    ['TCA-7K3M', 'acc', 'سماعات', 'white', 'سماعات لاسلكية بيضاء', 'سماعات لاسلكية داخل علبة شحن بيضاء، على العلبة ملصق صغير.', 'القاعات الدراسية', 1, 'الخزانة 1 — الرف أ'],
    ['TCA-4PRX', 'wallets', 'محفظة رجالية', 'brown', 'محفظة جلد بنية', 'محفظة جلد بنية قابلة للطي، بداخلها بطاقات.', 'الكافتيريا', 2, 'الخزنة الصغيرة'],
    ['TCA-9HWT', 'keys', 'مفتاح سيارة', 'black', 'مفتاح سيارة تويوتا', 'مفتاح سيارة بريموت أسود مع ميدالية جلدية.', 'المواقف', 3, 'الخزانة 1 — الرف ب'],
    ['TCA-3CFN', 'ids', 'بطاقة متدرب', '', 'بطاقة متدرب', 'بطاقة متدرب يبدأ اسم صاحبها بحرف الميم.', 'المكتبة', 1, 'الخزنة الصغيرة'],
    ['TCA-6DYE', 'acc', 'آلة حاسبة', 'gray', 'آلة حاسبة علمية', 'آلة حاسبة علمية بغطاء منزلق.', 'الورش التدريبية', 4, 'الخزانة 2 — الرف أ'],
    ['TCA-2MUV', 'tools', 'جهاز قياس', 'yellow', 'جهاز ملتيميتر أصفر', 'جهاز قياس كهربائي (ملتيميتر) مع أسلاك الفحص.', 'الورش التدريبية', 7, 'الخزانة 2 — الرف ب'],
    ['TCA-8TAK', 'glasses', 'نظارة شمسية', 'black', 'نظارة شمسية سوداء', 'نظارة شمسية بإطار أسود داخل علبة قماشية.', 'المسجد', 9, 'الخزانة 1 — الرف ج'],
    ['TCA-5RJP', 'bottles', 'قارورة ماء', 'blue', 'قارورة ماء زرقاء', 'قارورة ماء معدنية زرقاء عليها ملصقات.', 'الملاعب والصالة الرياضية', 11, 'الرف السفلي'],
    ['TCA-XE4W', 'acc', 'فلاش USB', 'silver', 'فلاش USB فضي', 'ذاكرة فلاش معدنية فضية بحلقة مفاتيح.', 'معامل الحاسب', 15, 'الخزانة 1 — الرف أ', 'returned'],
  ];
  return rows.map(([ref, cat, sub, color, title, desc, spot, ago, storage, status], k) => ({
    id: 'demo-' + String(k + 1).padStart(2, '0'),
    data: {
      officeId, ref: ref.replace('TCA', code), cat, sub, color, title, desc, spot, foundDate: daysBack(ago), storage,
      photo: false, status: status || 'available', createdBy: 'sample', createdAt: now - k * 1000, updatedAt: now - k * 1000, sample: true,
      ...(status === 'returned' ? {returnedAt: now} : {}),
    },
  }));
}
