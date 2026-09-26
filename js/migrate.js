// نقل الأغراض القديمة (مرة واحدة): التفاصيل السرية كانت في items المقروءة للجميع، ومكانها الآن itemSecrets
// يعمل تلقائياً عند فتح لوحة الموظف، ولكل مكتب مرة واحدة في الجلسة.
import { dbx } from './firebase.js';
import { S, isStaffHere, cachePhoto } from './state.js';
import { makeBlur, publicTitle, toast } from './utils.js';

const SECRET = ['color', 'brand', 'desc', 'bldg', 'room', 'storage'];
const done = new Set(); let running = false, denied = null;
// فتح لوحة الموظف من جديد يسمح بإعادة المحاولة بعد رفض القواعد القديمة
export function allowMigrationRetry(){ denied = null; }

// غرض قديم: فيه حقل سري، أو صورته بالقيمة القديمة true
const legacy = i => i.photo === true || SECRET.some(k => k in i);

export async function migrateItems(){
  const office = S.officeId;
  if (running || done.has(office) || denied === office || !isStaffHere() || !S.itemsLoaded) return;
  const old = S.items.filter(legacy);
  if (!old.length){ done.add(office); return; }
  running = true; done.add(office);   // نمنع التشغيل المزدوج في الجلسة نفسها
  let n = 0;
  try {
    for (const i of old){
      // 1) التفاصيل السرية في itemSecrets
      try {
        await dbx.set('itemSecrets/' + i.id, {officeId: i.officeId, title: i.title || '', color: i.color || '', brand: i.brand || '',
          desc: i.desc || '', bldg: i.bldg || '', room: i.room || '', storage: i.storage || ''});
      } catch (e){
        console.warn(e);
        // القواعد القديمة ما زالت منشورة: نتوقف تماماً ولا نحذف شيئاً
        if (String(e?.code || '').includes('permission-denied')){ done.delete(office); denied = office; toast('انشر قواعد Firestore الجديدة ثم أعد فتح لوحة الموظف.'); return; }
        continue;
      }
      // 2) الصورة: الأصل إلى itemPhotosPrivate، والعامة تصبح نسخة مموّهة
      let photo = ['clear', 'blur', 'none'].includes(i.photo) ? i.photo : false;
      if (i.photo === true){
        try {
          const d = (await dbx.get('itemPhotos/' + i.id))?.data;
          if (typeof d === 'string' && d.startsWith('data:image/')){
            await dbx.set('itemPhotosPrivate/' + i.id, {officeId: i.officeId, data: d});
            const blur = await makeBlur(d);
            await dbx.set('itemPhotos/' + i.id, {data: blur});
            cachePhoto('p_' + i.id, d); cachePhoto(i.id, blur);
            photo = 'blur';
          }
        } catch (e){ console.warn(e); continue; }   // لا ننتقل للخطوة 3 إن فشلت الصورة
      }
      // 3) إعادة كتابة المستند العام كاملاً (دون merge) حتى تُحذف الحقول القديمة منه
      const pub = {officeId: i.officeId, ref: i.ref, cat: i.cat, sub: i.sub || '', title: publicTitle(i.cat, i.sub), spot: i.spot || '',
        foundDate: i.foundDate, photo, status: i.status || 'available', createdBy: i.createdBy || '', createdAt: i.createdAt || Date.now(),
        updatedAt: Date.now(), sample: !!i.sample};
      for (const k of ['fromReport', 'reservedFor', 'returnedAt']) if (i[k] !== undefined) pub[k] = i[k];
      try { await dbx.set('items/' + i.id, pub); n++; } catch (e){ console.warn(e); }
    }
    if (n) toast(`نُقلت تفاصيل ${n} أغراض إلى الملف السري`);
  } finally { running = false; }
}
