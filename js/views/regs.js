/* H33: «سجل أغراضي» (belongings): الطالب يسجّل جهازه أو غرضه الثمين ورقمه التسلسلي قبل أن يضيع،
   كما في برامج تسجيل الممتلكات في الجامعات (مثل جامعة ميشيغان). وقت التسجيل وقت الخادم ولا يُعدَّل (القواعد v22)،
   فإن ضاع الغرض ثم طلب استلامه، يرى الموظف أنه مسجّل له قبل العثور عليه: أقوى دليل على الملكية.
   تُحمَّل هذه الوحدة عند فتح الصفحة فقط (lazy.js)، والتسجيل والحذف في actions.js (submitForm 'reg'، ACT.delReg) */
import { icon, CATS, cat, catName, subLabel, colorName, regCatOk, REG_MAX } from '../constants.js';
import { t } from '../i18n.js';
import { esc, colorDot } from '../utils.js';
import { S, ensureRegs, regAt } from '../state.js';
import { backBtn, loginPrompt, verifyPrompt, emptyBox, catPicker, colorPicker, whenLine } from './common.js';
import { loadingHtml } from '../lazy.js';

// التصنيفات التي تُسجَّل (لا نقود ولا وثائق رسمية: لا تُحفظ أرقام الهويات)
const REG_CATS = () => CATS.filter(c => regCatOk(c.id)).map(c => c.id);

const hero = (title, sub) => `<section class="hero"><div class="hero-kicker">${icon('shield')}${t('rg.kicker')}</div><h1 class="hero-title">${title}</h1>${sub ? `<p class="hero-sub">${sub}</p>` : ''}</section>`;

// أين أجد الرقم التسلسلي؟ (مطوية)
const whereSerial = () => `<details class="more-box rg-where"><summary>${icon('question')}<span>${t('rg.whereT')}</span>${icon('chev')}</summary>
  <div class="more-body"><ul class="rg-list">${[1, 2, 3, 4].map(n => `<li>${t('rg.where' + n)}</li>`).join('')}</ul></div></details>`;

function regCard(g){
  const facts = [
    g.sub ? [t('c.type'), esc(subLabel(g.sub))] : null,
    g.brand || g.model ? [t('rg.brandModel'), esc([g.brand, g.model].filter(Boolean).join(' · '))] : null,
    g.serial ? [t('rg.serial'), `<span dir="ltr">${esc(g.serial)}</span>`] : null,
    g.color ? [t('c.color'), `${colorDot(g.color)}${esc(colorName(g.color))}`] : null,
    g.mark ? [t('rg.mark'), esc(g.mark)] : null,
  ].filter(Boolean);
  return `<article class="box reg-card">
    <div class="reg-h">${icon(cat(g.cat).icon)}<div class="grow"><h3>${esc(g.title)}</h3><span class="meta">${esc(catName(g.cat))}</span></div></div>
    ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
    ${whenLine('rg.atLine', regAt(g))}
    <div class="btn-row"><button class="btn sm ghost" data-act="delReg" data-id="${esc(g.id)}" aria-label="${esc(t('rg.delOf', {title: g.title}))}">${icon('trash')}${t('rg.del')}</button></div>
  </article>`;
}

export function vRegs(){
  if (!S.uid) return `<div class="wrap" data-view="regs">${hero(t('rg.title'), t('rg.sub'))}${loginPrompt(t('rg.login'))}</div>`;
  ensureRegs();
  if (!S.regsLoaded) return `<div class="wrap" data-view="regs">${hero(t('rg.title'), t('rg.sub'))}${loadingHtml()}</div>`;
  const list = S.myRegs || [];
  const add = `<button class="btn" data-act="nav" data-r="regAdd">${icon('plus')}${t('rg.add')}</button>`;
  return `<div class="wrap" data-view="regs">${hero(t('rg.title'), t('rg.sub'))}
    <section class="panel rg-why" aria-labelledby="rg-why-h"><h2 id="rg-why-h">${t('rg.whyT')}</h2>
      <ol class="rg-list">${[1, 2, 3].map(n => `<li>${t('rg.why' + n)}</li>`).join('')}</ol></section>
    ${list.length ? `<div class="sec-head"><h2>${t('rg.listT')}</h2></div><div class="list">${list.map(regCard).join('')}</div><div class="btn-row">${add}</div>`
      : emptyBox('shield', t('rg.empty'), t('rg.emptySub'), add)}
    ${whereSerial()}
  </div>`;
}

export function vRegForm(){
  if (!S.uid) return `<div class="wrap" data-view="regAdd">${backBtn()}${loginPrompt(t('rg.login'))}</div>`;
  if (!S.verified) return `<div class="wrap" data-view="regAdd">${backBtn()}${verifyPrompt(t('rg.verifyWhat'))}</div>`;
  return `<div class="wrap narrow" data-view="regAdd">${backBtn()}${hero(t('rg.addTitle'), t('rg.addSub'))}
    <form data-form="reg" class="panel" novalidate>
      <div class="form-err" hidden></div>
      <div class="field"><span class="label">${t('c.category')}</span>${catPicker('', REG_CATS())}</div>
      <div class="field" id="subs-field" hidden><span class="label">${t('c.type')}</span><div id="subs"></div></div>
      <div class="field"><label for="rg-title">${t('rg.name')}</label><input id="rg-title" name="title" class="input" required maxlength="${REG_MAX.title}" autocomplete="off" placeholder="${t('rg.namePh')}"></div>
      <div class="two">
        <div class="field"><label for="rg-brand">${t('if.brand')} <span class="hint">${t('c.optional')}</span></label><input id="rg-brand" name="brand" class="input" maxlength="${REG_MAX.brand}" autocomplete="off"></div>
        <div class="field"><label for="rg-model">${t('df.model')} <span class="hint">${t('c.optional')}</span></label><input id="rg-model" name="model" class="input" maxlength="${REG_MAX.model}" autocomplete="off" placeholder="${t('df.model.ph')}"></div>
      </div>
      <div class="field uniq"><label for="rg-serial">${t('rg.serial')}</label><input id="rg-serial" name="serial" class="input" dir="ltr" maxlength="${REG_MAX.serial}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="rg-serial-h">
        <span class="hint" id="rg-serial-h">${icon('shield')}<span>${t('rg.serialHint')}</span></span></div>
      <div class="field"><label for="rg-mark">${t('rg.mark')}</label><input id="rg-mark" name="mark" class="input" maxlength="${REG_MAX.mark}" autocomplete="off" placeholder="${t('rg.markPh')}"></div>
      <div class="field"><span class="label">${t('c.color')} <span class="hint">${t('c.optional')}</span></span>${colorPicker('', true)}</div>
      ${whereSerial()}
      <div class="note">${icon('lock')}<span>${t('rg.private')}</span></div>
      <div class="note info">${icon('info')}<span>${t('rg.noEdit')}</span></div>
      <div class="btn-row"><button class="btn" type="submit">${icon('check')}${t('rg.save')}</button></div>
    </form>
  </div>`;
}
