// ============================================================
//  إعدادات مفقودك — هذا هو الملف الوحيد الذي يجب تعديله للتشغيل
// ============================================================
//
// 1) من Firebase Console افتح: Project settings ← Your apps ← Web app
//    وانسخ القيم إلى firebaseConfig بالأسفل.
//    هذه القيم ليست سرية؛ الحماية الحقيقية في ملف firestore.rules.

export const firebaseConfig = {
  apiKey: "AIzaSyDXcxgX8E1glOqnAICuHu1o_dJHTQEPywo",
  authDomain: "mafqoodak-50269.firebaseapp.com",
  projectId: "mafqoodak-50269",
  storageBucket: "mafqoodak-50269.firebasestorage.app",
  messagingSenderId: "24213358856",
  appId: "1:24213358856:web:0af63853a50e2f791404bd",
};

// 2) إعدادات التطبيق
export const SETTINGS = {
  appName: 'مفقودك',

  // أقل نسبة تطابق (من 100) لاعتبار غرضٍ ما مطابقاً لبلاغ
  matchThreshold: 50,

  // الذكاء الاصطناعي (اختياري ومجاني على خطة Spark عبر Firebase AI Logic)
  // فعّله من Firebase Console ← AI Logic ← Get started ← Gemini Developer API
  // ثم غيّر القيمة إلى true
  enableAI: false,
  // اسم النموذج — راجع القائمة الحالية: https://firebase.google.com/docs/ai-logic/models
  aiModel: 'gemini-3.5-flash-lite',

  // بيانات أول موقع تُنشأ عند الإعداد الأول (يمكن تعديلها لاحقاً من لوحة الإدارة)
  firstOffice: {
    id: 'tc-ahsa',
    name: 'الكلية التقنية بالأحساء',
    short: 'تقنية الأحساء',
    type: 'college',
    city: 'الأحساء',
    code: 'TCA',
    place: 'المبنى الإداري',
    hours: 'الأحد – الخميس، 7:30 ص – 2:30 م',
    phone: '',
    retentionDays: 90,
    spots: ['البوابة الرئيسية', 'المبنى الإداري', 'القاعات الدراسية', 'معامل الحاسب', 'الورش التدريبية', 'المكتبة', 'المسجد', 'الكافتيريا', 'الملاعب والصالة الرياضية', 'المواقف'],
  },
};
