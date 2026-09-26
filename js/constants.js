// الثوابت: الأيقونات، التصنيفات، الألوان، أنواع المنشآت، الحالات
// لإضافة تصنيف جديد عدّل مصفوفة CATS بالأسفل.

/* ---------- icons ---------- */
export const P = {
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
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  building:'<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20"/><path d="M8 7h4M8 11h4M8 15h4"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.7 2.6 3 5.2"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m12 8 1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2L12 8Z"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  shield:'<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  tag:'<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  sample:'<path d="M4 4h16v16H4z" stroke-dasharray="3 3"/>',
};
export const icon = (n, cls='') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||P.box}</svg>`;
export const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><path d="M9 6h17.5L35 14.5V33a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="var(--primary)"/><circle cx="27.5" cy="12.5" r="2.6" fill="var(--bg)"/><circle cx="18" cy="21" r="5.6" fill="none" stroke="var(--primary-ink)" stroke-width="2.4"/><path d="m22.2 25.2 4.3 4.3" stroke="var(--primary-ink)" stroke-width="2.6" stroke-linecap="round"/><path d="M27.5 12.5C30 7 33 4.5 37 4" fill="none" stroke="var(--tag-line)" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/* ---------- reference data ---------- */
export const CATS = [
  {id:'ids', name:'بطاقات ووثائق', icon:'idcard', sensitive:true, subs:['هوية وطنية','هوية مقيم','بطاقة متدرب','رخصة قيادة','بطاقة بنكية','جواز سفر','وثيقة أخرى']},
  {id:'wallets', name:'محافظ', icon:'wallet', subs:['محفظة رجالية','محفظة نسائية','حافظة بطاقات','محفظة جوال']},
  {id:'phones', name:'جوالات وأجهزة', icon:'phone', subs:['جوال','جهاز لوحي','لابتوب','ساعة ذكية']},
  {id:'acc', name:'ملحقات إلكترونية', icon:'plug', subs:['سماعات','شاحن','كيبل','باور بانك','فلاش USB','آلة حاسبة']},
  {id:'keys', name:'مفاتيح', icon:'key', subs:['مفتاح سيارة','مفاتيح منزل','ميدالية','بطاقة دخول']},
  {id:'jewelry', name:'مجوهرات وساعات', icon:'ring', subs:['خاتم','سلسال','أسورة','ساعة يد','أقراط']},
  {id:'glasses', name:'نظارات', icon:'glasses', subs:['نظارة طبية','نظارة شمسية','علبة نظارة']},
  {id:'bags', name:'حقائب', icon:'bag', subs:['حقيبة ظهر','حقيبة لابتوب','حقيبة يد','حقيبة رياضية']},
  {id:'study', name:'كتب وأدوات دراسية', icon:'book', subs:['كتاب','دفتر','ملف أوراق','مقلمة','أدوات هندسية']},
  {id:'clothes', name:'ملابس', icon:'shirt', subs:['شماغ أو غترة','عباية','جاكيت','قبعة','حذاء']},
  {id:'tools', name:'عُدد وأدوات ورش', icon:'wrench', subs:['عدة يدوية','جهاز قياس','خوذة سلامة','نظارة سلامة','قفازات']},
  {id:'bottles', name:'قوارير ومطارات', icon:'bottle', subs:['قارورة ماء','مطارة قهوة','علبة طعام']},
  {id:'other', name:'أخرى', icon:'box', subs:[]},
];
export const COLORS = [
  {id:'black',name:'أسود',hex:'#1c1c1c',alt:'اسود سوداء سودا'},
  {id:'white',name:'أبيض',hex:'#f7f7f5',alt:'ابيض بيضاء بيضا'},
  {id:'gray',name:'رمادي',hex:'#8a8f8e',alt:'رمادي رماديه رصاصي'},
  {id:'silver',name:'فضي',hex:'#c9ccd0',alt:'فضي فضيه'},
  {id:'gold',name:'ذهبي',hex:'#c9a13b',alt:'ذهبي ذهبيه'},
  {id:'brown',name:'بني',hex:'#7a4e2d',alt:'بني بنيه جلد'},
  {id:'beige',name:'بيج',hex:'#d8c3a0',alt:'بيج'},
  {id:'red',name:'أحمر',hex:'#c0392b',alt:'احمر حمراء'},
  {id:'pink',name:'وردي',hex:'#e48fb0',alt:'وردي زهري'},
  {id:'orange',name:'برتقالي',hex:'#e67e22',alt:'برتقالي'},
  {id:'yellow',name:'أصفر',hex:'#f1c40f',alt:'اصفر صفراء'},
  {id:'green',name:'أخضر',hex:'#2e8b57',alt:'اخضر خضراء'},
  {id:'blue',name:'أزرق',hex:'#2f74c0',alt:'ازرق زرقاء'},
  {id:'navy',name:'كحلي',hex:'#1f2f56',alt:'كحلي'},
  {id:'purple',name:'بنفسجي',hex:'#7d4fa8',alt:'بنفسجي موف'},
  {id:'multi',name:'متعدد',hex:'conic-gradient(#c0392b,#f1c40f,#2e8b57,#2f74c0,#7d4fa8,#c0392b)',alt:'ملون متعدد'},
];
export const OFFICE_TYPES = [
  {id:'college',name:'كلية',icon:'college'},
  {id:'university',name:'جامعة',icon:'college'},
  {id:'school',name:'مدرسة / معهد',icon:'school'},
  {id:'airport',name:'مطار',icon:'airport'},
  {id:'mall',name:'مجمع تجاري',icon:'mall'},
  {id:'hospital',name:'مستشفى',icon:'hospital'},
  {id:'other',name:'منشأة أخرى',icon:'pin'},
];
export const ITEM_STATUS = {
  available:{l:'متاح للاستلام',c:'ok'},
  reserved:{l:'محجوز بانتظار صاحبه',c:'warn'},
  returned:{l:'سُلّم لصاحبه',c:'info'},
  archived:{l:'مؤرشف',c:'mute'},
};
export const CLAIM_STATUS = {
  pending:{l:'قيد المراجعة',c:'warn'},
  approved:{l:'جاهز للاستلام',c:'ok'},
  done:{l:'تم الاستلام',c:'info'},
  rejected:{l:'لم يُقبل',c:'bad'},
};
export const REPORT_STATUS = { open:{l:'بلاغ مفتوح',c:'warn'}, closed:{l:'مغلق',c:'mute'} };
export const MODE_LABEL = {visitor:'زائر', staff:'موظف المكتب', admin:'الإدارة'};

export const cat = id => CATS.find(c => c.id === id) || CATS[CATS.length-1];
export const catName = id => cat(id).name;
export const color = id => COLORS.find(c => c.id === id);
export const colorName = id => color(id)?.name || '';
export const otype = id => OFFICE_TYPES.find(t => t.id === id) || OFFICE_TYPES[OFFICE_TYPES.length-1];

