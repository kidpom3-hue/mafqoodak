// صفحة الإحصاءات (للموظف والإدارة): أرقام رئيسية، ورسوم بسيطة لكلٍ منها جدول بديل، وتصدير CSV.
// الرسوم من HTML وCSS فقط: عمود واحد بلون واحد للتصنيفات والأماكن، ولونان مُتحقَّق منهما للأشهر مع مفتاح.
import { icon, catName, oName } from '../constants.js';
import { t, tp } from '../i18n.js';
import { esc, spotName } from '../utils.js';
import { S, staffOffices } from '../state.js';
import { backBtn, FB_LABEL, FB_REASONS } from './common.js';
import { loadStats, computeStats, monthName, ratingStats, addTimeStats } from '../stats.js';

// أعمدة أفقية (سلسلة واحدة): الطول يمثل العدد، والقيمة عند طرف العمود، والتلميح عند المرور أو التركيز
function hbars(rows){
  const max = Math.max(1, ...rows.map(r => r.n));
  return `<div class="hbars" role="list">${rows.map(r => `<div class="hb" role="listitem">
      <span class="hb-l">${esc(r.label)}</span>
      <span class="hb-track"><span class="hb-bar" style="inline-size:${Math.max(r.n ? 2 : 0, 100 * r.n / max)}%" tabindex="0" role="img" aria-label="${esc(r.label)}: ${esc(r.tip)}" data-tip-l="${esc(r.label)}" data-tip-v="${esc(r.tip)}"></span><b class="hb-v">${r.n}</b></span>
    </div>`).join('')}</div>`;
}
// جدول بديل لكل رسم (للقارئات الصوتية ولمن يريد الأرقام كلها)
const table = (head, rows) => `<details class="viz-table"><summary>${t('sx.table')}</summary>
  <div class="table-wrap"><table class="t"><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map((c, k) => k ? `<td class="n">${c}</td>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
// سقف مقرّب لمحور الأعمدة، ونصفه عدد صحيح دائماً: 2، 4، 6، 8، 10، ثم 20، 50، 100...
const nice = v => { if (v <= 10) return Math.max(2, Math.ceil(v / 2) * 2); const p = 10 ** Math.floor(Math.log10(v)); return [2, 5, 10].map(k => k * p).find(k => k >= v); };

// H25: «هل كانت هذه الصفحة مفيدة؟» جدول لكل صفحة: نعم، لا، نسبة الإفادة، وأكثر أسباب «لا» (بلا أعمدة: الأرقام في جدول يكفي)
function pageFeedback(list){
  const rows = (list || []).filter(x => FB_LABEL[x.page]).map(x => {
    const yes = +x.yes || 0, no = +x.no || 0, n = yes + no;
    const top = FB_REASONS.map(r => [r, +x[r] || 0]).filter(r => r[1]).sort((a, b) => b[1] - a[1])[0];
    return {label: t(FB_LABEL[x.page]), yes, no, n, pct: n ? Math.round(100 * yes / n) : 0, top: top ? `${t('fb.' + top[0])} (${top[1]})` : '—'};
  }).filter(r => r.n).sort((a, b) => a.pct - b.pct || b.n - a.n);
  if (!rows.length) return `<section class="panel viz"><div class="section-title">${t('fb.statsTitle')}</div><p class="muted">${t('fb.statsNone')}</p></section>`;
  return `<section class="panel viz"><h2 class="section-title">${t('fb.statsTitle')}</h2>
    <p class="hint">${t('fb.statsHint')}</p>
    <div class="table-wrap"><table class="t"><thead><tr>${[t('fb.sPage'), t('fb.yes'), t('fb.no'), t('fb.sPct'), t('fb.sTop')].map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r.label}</td><td class="n">${r.yes}</td><td class="n">${r.no}</td><td class="n"><span dir="ltr">${r.pct}%</span></td><td>${esc(r.top)}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}
// رضا المستفيدين: المتوسط والعدد، وتوزيع 1–5 بأعمدة من لون واحد مع جدول، وآخر 10 تعليقات
function satisfaction(list){
  const r = ratingStats(list || []);
  if (!r.n) return `<section class="panel viz"><div class="section-title">${t('sx.rating')}</div><p class="muted">${t('sx.noRatings')}</p></section>`;
  const rows = r.dist.slice().reverse().map(x => ({label: t('sx.starsN', {n: x.k}), n: x.n, tip: String(x.n)}));
  return `<figure class="panel viz"><figcaption class="section-title">${t('sx.rating')}</figcaption>
    <p class="kpi-line">${t('sx.ratingAvg', {avg: `<b>${r.avg}</b>`, n: tp('n.rating', r.n)})}</p>
    ${hbars(rows)}
    ${table([t('sx.stars'), t('sx.count')], rows.map(x => [x.label, x.n]))}
    ${r.notes.length ? `<div class="section-title">${t('sx.ratingNotes')}</div><ul class="rating-notes">${r.notes.map(x => `<li><span class="stars-sm" aria-label="${t('rt.aria', {n: x.rating})}">${'★'.repeat(x.rating)}</span> ${esc(x.note)}</li>`).join('')}</ul>` : ''}
  </figure>`;
}
export function vStats(){
  const id = S.route.params.office || S.officeId;
  const o = S.offices.find(x => x.id === id);
  if (!o || !staffOffices().includes(id)) return `<div class="wrap">${backBtn()}<div class="empty">${icon('lock')}<b>${t('sx.denied')}</b></div></div>`;
  const data = S.stats[id];
  if (!data) loadStats(id);
  const head = `${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('chart')}${t('sx.kicker')}</div><h1 class="hero-title">${esc(oName(o))}</h1><p class="hero-sub">${t('sx.sub')}</p></section>
    <div class="btn-row"><button class="btn sm" data-act="exportCsv" data-id="${esc(id)}">${icon('download')}${t('sx.csv')}</button>
      <button class="btn sm ghost" data-act="statsRefresh" data-id="${esc(id)}">${icon('swap')}${t('sx.refresh')}</button></div>`;
  if (!data) return `<div class="wrap" data-view="stats">${head}<div class="loading" aria-busy="true"><span class="spin"></span></div></div>`;
  const s = computeStats(data.items, o, data.reports || []);
  if (!s.total) return `<div class="wrap" data-view="stats">${head}<div class="empty">${icon('chart')}<b>${t('sx.empty')}</b><button class="btn soft" data-act="nav" data-r="add">${icon('plus')}${t('st.firstItem')}</button></div></div>`;
  // الأشهر: عمودان متجاوران لكل شهر (ما وُجد وما أُعيد) على محور واحد
  const top = nice(Math.max(...s.months.map(m => Math.max(m.found, m.ret))));
  const months = `<div class="cols" role="list">
      <div class="col-grid" aria-hidden="true"><span style="inset-block-start:0">${top}</span><span style="inset-block-start:50%">${top / 2}</span><span style="inset-block-start:100%">0</span></div>
      ${s.months.map(m => { const lb = monthName(m.date); return `<div class="col-g" role="listitem">
        <div class="col-bars">
          <span class="col s1" style="block-size:${100 * m.found / top}%" tabindex="0" role="img" aria-label="${esc(lb)} · ${t('sx.sFound')}: ${m.found}" data-tip-l="${esc(lb)} · ${t('sx.sFound')}" data-tip-v="${m.found}"></span>
          <span class="col s2" style="block-size:${100 * m.ret / top}%" tabindex="0" role="img" aria-label="${esc(lb)} · ${t('sx.sReturned')}: ${m.ret}" data-tip-l="${esc(lb)} · ${t('sx.sReturned')}" data-tip-v="${m.ret}"></span>
        </div><span class="col-x">${esc(lb)}</span></div>`; }).join('')}
    </div>
    <div class="legend"><span><i class="sw s1"></i>${t('sx.sFound')}</span><span><i class="sw s2"></i>${t('sx.sReturned')}</span></div>`;
  const add = addTimeStats(data.addTimes);   // H9: متوسط وقت إضافة غرض
  const catRows = s.cats.map(c => ({label: c.id === '_rest' ? t('sx.rest') : catName(c.id), n: c.n, ret: c.ret, tip: t('sx.tipCat', {n: c.n, ret: c.ret})}));
  const spotRows = s.spots.map(x => ({label: x.s ? spotName(x.s, id) : t('it.unknown'), n: x.n, tip: String(x.n)}));
  return `<div class="wrap" data-view="stats">${head}
    <div class="kpis">
      <div class="kpi hero-kpi"><span class="kpi-l">${t('sx.rate')}</span><b class="kpi-v">${s.rate === null ? '—' : s.rate + '%'}</b>
        ${s.rate === null ? '' : `<span class="meter" role="img" aria-label="${s.rate}%"><span style="inline-size:${s.rate}%"></span></span>`}
        <span class="kpi-h">${t('sx.rateHint')}</span></div>
      <div class="kpi"><span class="kpi-l">${t('sx.total')}</span><b class="kpi-v">${s.total}</b></div>
      <div class="kpi"><span class="kpi-l">${t('home.statReturned')}</span><b class="kpi-v">${s.returned}</b></div>
      <div class="kpi"><span class="kpi-l">${t('sx.avgDays')}</span><b class="kpi-v">${s.avgDays === null ? '—' : s.avgDays}</b><span class="kpi-h">${s.avgDays === null ? '' : t('sx.daysUnit')}</span></div>
      <div class="kpi"><span class="kpi-l">${t('sx.held')}</span><b class="kpi-v">${s.held}</b></div>
      <div class="kpi" id="kpi-add"><span class="kpi-l">${t('sx.addTime')}</span><b class="kpi-v">${add.avg === null ? '—' : add.avg}</b><span class="kpi-h">${add.avg === null ? t('sx.addNone') : `${t('sx.secUnit')} · ${tp('n.addCount', add.n)}`}</span></div>
      ${s.over ? `<div class="kpi warn"><span class="kpi-l">${icon('clock')}${t('st.overKeep')}</span><b class="kpi-v">${s.over}</b></div>` : ''}
    </div>
    <figure class="panel viz"><figcaption class="section-title">${t('sx.months')}</figcaption>${months}
      ${table([t('sx.month'), t('sx.sFound'), t('sx.sReturned')], s.months.map(m => [monthName(m.date), m.found, m.ret]))}</figure>
    <figure class="panel viz"><figcaption class="section-title">${t('sx.byCat')}</figcaption>${hbars(catRows)}
      ${table([t('c.category'), t('sx.count'), t('home.statReturned')], catRows.map(r => [r.label, r.n, r.ret]))}</figure>
    <figure class="panel viz"><figcaption class="section-title">${t('sx.bySpot')}</figcaption>${hbars(spotRows)}
      ${table([t('if.spot'), t('sx.count')], spotRows.map(r => [r.label, r.n]))}</figure>
    ${s.lost.length ? `<figure class="panel viz"><figcaption class="section-title">${t('sx.byLost')}</figcaption>${hbars(s.lost.map(x => ({label: x.s ? spotName(x.s, id) : t('it.unknown'), n: x.n, tip: String(x.n)})))}
      ${table([t('if.spot'), t('sx.count')], s.lost.map(x => [x.s ? spotName(x.s, id) : t('it.unknown'), x.n]))}</figure>` : ''}
    ${satisfaction(data.ratings)}
    ${pageFeedback(data.fb)}
    ${s.closed.some(x => x.n) ? `<section class="panel viz"><div class="section-title">${t('sx.closed')}</div>
      <p class="kpi-line">${s.closed.map(x => `${t('sx.closed.' + x.k)} <b>${x.n}</b>`).join(' · ')}</p>
      ${table([t('sx.closedWhy'), t('sx.count')], s.closed.map(x => [t('sx.closed.' + x.k), x.n]))}</section>` : ''}
    <p class="hint">${t('sx.note', {items: tp('n.item', data.items.length)})}</p>
  </div>`;
}
