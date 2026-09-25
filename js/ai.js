// الذكاء الاصطناعي (اختياري) عبر Firebase AI Logic و Gemini
// يعمل فقط إذا كانت SETTINGS.enableAI = true في js/config.js
import { SETTINGS } from './config.js';
import { app } from './firebase.js';
import { CATS, COLORS, catName, colorName } from './constants.js';

export const aiReady = () => !!(SETTINGS.enableAI && app);

let modelPromise = null;
function model(){
  if (!modelPromise){
    modelPromise = import('https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js').then(m => {
      const ai = m.getAI(app, {backend: new m.GoogleAIBackend()});
      return m.getGenerativeModel(ai, {model: SETTINGS.aiModel, generationConfig: {responseMimeType: 'application/json'}});
    });
    modelPromise.catch(() => { modelPromise = null; });
  }
  return modelPromise;
}
function blobToPart(blob){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({inlineData: {data: String(r.result).split(',')[1], mimeType: blob.type || 'image/jpeg'}});
    r.onerror = rej; r.readAsDataURL(blob);
  });
}
function parseJson(t){
  t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); }
  catch { const m = t.match(/[[{][\s\S]*[\]}]/); if (m) return JSON.parse(m[0]); throw new Error('invalid json'); }
}
async function askJson(prompt, blobs = []){
  const m = await model();
  const parts = [prompt, ...(await Promise.all(blobs.map(blobToPart)))];
  const res = await m.generateContent(parts);
  return parseJson(res.response.text());
}
export function aiErrMsg(e){
  const s = String(e?.message || e || '');
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(s)) return 'تجاوزت حد الاستخدام المجاني للذكاء الاصطناعي اليوم. حاول لاحقاً.';
  if (/not.*enabled|403|PERMISSION|has not been used|api-not-enabled/i.test(s)) return 'الذكاء الاصطناعي غير مفعّل في Firebase. راجع خطوة AI Logic في ملف README.';
  if (/not found|404|model/i.test(s)) return 'اسم النموذج غير صحيح. عدّل aiModel في js/config.js.';
  return 'تعذّر الاتصال بالذكاء الاصطناعي. حاول مرة أخرى.';
}

/* يتعرّف على الغرض من صورته ويقترح التصنيف واللون والاسم والوصف */
export function analyzePhoto(blob){
  const prompt = `You help a lost-and-found office in Saudi Arabia catalogue a found item from its photo.
Identify the main object in the photo. Reply with ONLY one JSON object:
{"cat":"<category id>","sub":"<one subcategory exactly as written below, or empty>","color":"<color id>","title":"<short Arabic name, 2-5 words>","desc":"<one Arabic sentence: brand if visible, material, shape, notable marks>"}
Categories (id: name [subcategories]):
${CATS.map(c => `${c.id}: ${c.name} [${c.subs.join('، ')}]`).join('\n')}
Color ids: ${COLORS.map(c => `${c.id}=${c.name}`).join(', ')}
Never transcribe personal names, ID numbers, card numbers or phone numbers even if visible.`;
  return askJson(prompt, [blob]);
}

/* يرتّب المفقودات المرشحة حسب احتمال تطابقها مع البلاغ */
export async function rankMatches(r, pool, images = [], imgIds = []){
  const lines = pool.map(i => `${i.id} | ${catName(i.cat)}${i.sub ? ' / ' + i.sub : ''} | ${colorName(i.color)} | ${i.title} | ${i.desc || ''} | found at: ${i.spot || '?'} on ${i.foundDate}`).join('\n');
  const prompt = `You match a lost-item report against items held by a lost-and-found office.
LOST REPORT (written by the owner):
category: ${catName(r.cat)}${r.sub ? ' / ' + r.sub : ''}; color: ${colorName(r.color) || '?'}; title: ${r.title}; description: ${r.desc || '-'}; lost at: ${r.spot || '?'} on ${r.lostDate || '?'}
FOUND ITEMS (id | category | color | title | description | where/when found):
${lines}
${images.length ? `IMAGES: image 1 is the owner's photo of the lost item.${imgIds.length ? ' Images 2..' + (imgIds.length + 1) + ' are photos of found items with ids, in order: ' + imgIds.join(', ') + '.' : ''} Compare colour, shape, type and marks.` : ''}
Consider type, colour, brand, distinctive details, place, and that an item cannot be found before it was lost.
Reply with ONLY a JSON array (best first, at most 5) of {"id":"<found item id>","score":<0-100>,"reason":"<short Arabic reason, max 15 words>"}. Include only items with a real chance of being the same object. Reply [] if none.`;
  const out = await askJson(prompt, images);
  const ids = new Set(pool.map(i => i.id));
  return (Array.isArray(out) ? out : []).filter(m => m && ids.has(String(m.id))).slice(0, 5)
    .map(m => ({id: String(m.id), score: Math.max(0, Math.min(100, Number(m.score) || 0)), reason: String(m.reason || '').slice(0, 160)}));
}
