// نقل الأغراض القديمة (مرة واحدة): التفاصيل السرية كانت في items المقروءة للجميع، ومكانها الآن itemSecrets
// يعمل تلقائياً عند فتح لوحة الموظف، ولكل مكتب مرة واحدة في الجلسة.
// المرحلة E5: مكان العثور (spot) سري أيضاً، وينقله migrateSpots لكل غرض محمّل (النشطة، وما جُلب بفلتر الحالة).
import { dbx, deleteField } from './firebase.js';
import { S, isStaffHere, cachePhoto } from './state.js';
import { pubFlag } from './constants.js';
import { LS } from './utils.js';
import { makeBlur, publicTitle, toast } from './utils.js';
import { t, tp } from './i18n.js';

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
          desc: i.desc || '', spot: i.spot || '', bldg: i.bldg || '', room: i.room || '', storage: i.storage || ''});
      } catch (e){
        console.warn(e);
        // القواعد القديمة ما زالت منشورة: نتوقف تماماً ولا نحذف شيئاً
        if (String(e?.code || '').includes('permission-denied')){ done.delete(office); denied = office; toast(t('migrate.publishRules')); return; }
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
      // 3) إعادة كتابة المستند العام كاملاً (دون merge) حتى تُحذف الحقول القديمة منه (ومنها spot، صار في itemSecrets)
      const pub = {officeId: i.officeId, ref: i.ref, cat: i.cat, sub: i.sub || '', title: publicTitle(i.cat, i.sub),
        foundDate: i.foundDate, photo, status: i.status || 'available', createdBy: i.createdBy || '', createdAt: i.createdAt || Date.now(),
        updatedAt: Date.now(), sample: !!i.sample, public: pubFlag(i.cat)};
      for (const k of ['fromReport', 'fromFound', 'reservedFor', 'returnedAt', 'disposal', 'disposedAt', 'createdFrom']) if (i[k] !== undefined) pub[k] = i[k];
      try { await dbx.set('items/' + i.id, pub); n++; } catch (e){ console.warn(e); }
    }
    if (n) toast(t('migrate.done', {items: tp('n.itemGen', n)}));
  } finally { running = false; }
}

/* المرحلة E5: نقل مكان العثور من المستند العام إلى itemSecrets لكل غرض محمّل ما زال فيه spot عام.
   batch واحد لكل غرض: itemSecrets بـ merge {officeId, spot}، وitems بـ update {spot: deleteField()}.
   لا نعيد كتابة المستند العام كاملاً (الخطوة 3 أعلاه) حتى لا تسقط حقول أحدث مثل fromFound وdisposal. */
const spotDone = new Set(); let spotRunning = false, spotDenied = false;
export function allowSpotRetry(){ spotDenied = false; }
const hasPublicSpot = i => Object.prototype.hasOwnProperty.call(i, 'spot');
export async function migrateSpots(){
  if (spotRunning || spotDenied || !isStaffHere()) return;
  const office = S.officeId;
  const todo = [...S.items, ...Object.values(S.extraItems).flat()]
    .filter(i => i.officeId === office && hasPublicSpot(i) && !legacy(i) && !spotDone.has(i.id));
  if (!todo.length) return;
  spotRunning = true; let n = 0;
  try {
    for (const i of todo){
      spotDone.add(i.id);
      const b = dbx.batch();
      b.set(dbx.ref('itemSecrets/' + i.id), {officeId: i.officeId, spot: S.secrets[i.id]?.spot ?? String(i.spot ?? '')}, {merge: true});
      b.update(dbx.ref('items/' + i.id), {spot: deleteField(), public: pubFlag(i.cat)});   // H16: public مع النقل
      try { await b.commit(); n++; }
      catch (e){
        console.warn(e); spotDone.delete(i.id);
        // القواعد الجديدة لم تُنشر بعد: نتوقف ونعيد المحاولة عند فتح اللوحة من جديد
        if (String(e?.code || '').includes('permission-denied')){ spotDenied = true; toast(t('migrate.publishRules')); return; }
      }
    }
    if (n) toast(t('migrate.spots', {items: tp('n.item', n)}));
  } finally { spotRunning = false; }
}

/* H16: كل غرض فيه public (true للعادي، false للنقود)، والزائر يستعلم بـ public == true فقط.
   الأغراض القديمة بلا الحقل لا تظهر للزائر حتى يُضاف: عند فتح لوحة الموظف نقرأ أغراض المكتب كلها مرة واحدة
   (لكل جهاز ومكتب: LS pubMig:<office>) ونضيف public لما ينقصه، 100 غرض في كل batch.
   الغرض الذي ما زالت فيه حقول سرية قديمة (أو spot) يتركه هذا الترحيل لـ migrateItems/migrateSpots (يضيفان public معه).
   يعمل قبل نشر قواعد v11 وبعده (القواعد القديمة لا تمنع الحقل)، فالأفضل: افتح لوحة الموظف ثم انشر القواعد */
let pubRunning = false;
const OLD_KEYS = ['color', 'brand', 'desc', 'bldg', 'room', 'storage', 'details', 'spot'];
export async function migratePublic(){
  const office = S.officeId, key = 'pubMig:' + office;
  if (pubRunning || !isStaffHere() || !office || LS.get(key, false)) return;
  pubRunning = true;
  try {
    const all = await dbx.list('items', [['officeId', '==', office]]);
    const todo = all.filter(i => i.public !== pubFlag(i.cat) && i.photo !== true && !OLD_KEYS.some(k => k in i));
    let failed = 0;
    for (let k = 0; k < todo.length; k += 100){
      const part = todo.slice(k, k + 100), b = dbx.batch();
      part.forEach(i => b.update(dbx.ref('items/' + i.id), {public: pubFlag(i.cat)}));
      try { await b.commit(); }
      catch (e){
        console.warn(e);
        // غرض واحد مرفوض يفشل الـ batch كله: نعيد المحاولة غرضاً غرضاً
        for (const i of part){ try { await dbx.update('items/' + i.id, {public: pubFlag(i.cat)}); } catch (e2){ console.warn(e2); failed++; } }
      }
    }
    if (!failed) LS.set(key, true);
  } catch (e){ console.warn(e); }
  finally { pubRunning = false; }
}
