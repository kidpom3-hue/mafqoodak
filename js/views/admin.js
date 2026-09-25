// صفحات الإدارة: نظرة عامة، المواقع، الصلاحيات، نموذج الموقع
import { icon, OFFICE_TYPES, otype } from '../constants.js';
import { esc, relTime } from '../utils.js';
import { S } from '../state.js';
import { backBtn, person } from './common.js';

/* ---------- admin ---------- */
export function vAdmin(){
  if (S.route.params.tab) S.adminTab = S.route.params.tab;
  const t = S.adminTab;
  const body = t === 'offices' ? adminOffices() : t === 'people' ? adminPeople() : adminOverview();
  return `<div class="wrap" data-view="admin">
    <section class="hero"><div class="hero-kicker">${icon('grid')}إدارة التطبيق</div><h1 class="hero-title">${t === 'offices' ? 'المواقع ومكاتب المفقودات' : t === 'people' ? 'الموظفون والصلاحيات' : 'نظرة عامة'}</h1></section>
    ${body}
  </div>`;
}
export function adminOverview(){
  const all = S.allItems; const samples = all.filter(i => i.sample).length;
  const pendReq = S.staffReqs.filter(r => r.status === 'pending').length;
  return `
    ${samples ? `<div class="note warn">${icon('sample')}<span>في التطبيق ${samples} عناصر توضيحية مُعلّمة بـ«مثال». احذفها قبل الإطلاق الفعلي.</span></div>
      <button class="btn sm danger" data-act="delSamples" style="align-self:flex-start">${icon('trash')}حذف البيانات التوضيحية</button>` : ''}
    <div class="stats">
      <div class="stat"><b>${S.offices.filter(o => o.active !== false).length}</b><span>مواقع مفعّلة</span></div>
      <div class="stat"><b>${all.filter(i => i.status === 'available' || i.status === 'reserved').length}</b><span>مفقودات محفوظة</span></div>
      <div class="stat"><b>${all.filter(i => i.status === 'returned').length}</b><span>أُعيدت لأصحابها</span></div>
      <div class="stat"><b>${S.staffList.length}</b><span>موظفون</span></div>
      <div class="stat ${pendReq ? 'hot' : ''}"><b>${pendReq}</b><span>طلبات صلاحية</span></div>
    </div>
    <div class="panel"><div class="section-title">حسب الموقع</div>
      <div class="table-wrap"><table class="t"><thead><tr><th>الموقع</th><th>متاح</th><th>محجوز</th><th>مُسلّم</th><th>نسبة الإعادة</th></tr></thead><tbody>
      ${S.offices.map(o => { const its = all.filter(i => i.officeId === o.id); const a = its.filter(i => i.status === 'available').length, r = its.filter(i => i.status === 'reserved').length, d = its.filter(i => i.status === 'returned').length; const tot = its.filter(i => i.status !== 'archived').length;
        return `<tr><td>${esc(o.name)}${o.active === false ? ' <span class="pill mute">موقوف</span>' : ''}</td><td class="n">${a}</td><td class="n">${r}</td><td class="n">${d}</td><td class="n">${tot ? Math.round(100 * d / tot) + '%' : '—'}</td></tr>`; }).join('')}
      </tbody></table></div>
    </div>`;
}
export function adminOffices(){
  return `<div class="btn-row"><button class="btn" data-act="newOffice">${icon('plus')}أضف موقعاً</button></div>
    <div class="office-list">${S.offices.map(o => {
      const n = S.allItems.filter(i => i.officeId === o.id && (i.status === 'available' || i.status === 'reserved')).length;
      const staffN = S.staffList.filter(s => (s.offices || []).includes(o.id)).length;
      return `<div class="office-card">
        <span class="oi">${icon(otype(o.type).icon)}</span>
        <span class="grow"><b>${esc(o.name)}</b><span class="meta">${esc(otype(o.type).name)} · ${esc(o.city || '')} · رمز القيد ${esc(o.code || '')}</span><span class="meta">${n} محفوظ · ${staffN} موظف</span></span>
        <span class="btn-row" style="flex-direction:column;align-items:flex-end">
          <button class="switch ${o.active !== false ? 'on' : ''}" data-act="toggleOffice" data-id="${esc(o.id)}" role="switch" aria-checked="${o.active !== false}" aria-label="تفعيل الموقع"></button>
          <button class="link" data-act="editOffice" data-id="${esc(o.id)}">${icon('edit')}تعديل</button>
        </span>
      </div>`; }).join('') || `<div class="empty">${icon('pin')}<b>لا توجد مواقع</b></div>`}</div>`;
}
export function adminPeople(){
  const reqs = S.staffReqs.filter(r => r.status === 'pending');
  const oname = id => S.offices.find(o => o.id === id)?.name || id;
  return `
    <div class="section-title">طلبات الصلاحية ${reqs.length ? `<span class="count">${reqs.length}</span>` : ''}</div>
    ${reqs.length ? `<div class="list">${reqs.map(r => `<div class="box">
      <div class="box-head"><div>${person(r.id)}<span class="meta">${esc(r.note || '')}</span></div><span class="meta">${relTime(r.createdAt)}</span></div>
      <div class="tags">${(r.offices || []).map(id => `<span class="tagchip">${esc(oname(id))}</span>`).join('')}</div>
      <div class="btn-row"><button class="btn sm" data-act="approveReq" data-id="${esc(r.id)}">${icon('check')}منح الصلاحية</button><button class="btn sm danger" data-act="rejectReq" data-id="${esc(r.id)}">${icon('x')}رفض</button></div>
    </div>`).join('')}</div>` : `<div class="note">${icon('info')}<span>أرسل رابط التطبيق للموظف؛ يسجّل دخوله ثم يطلب الصلاحية من صفحة «المكتب» ← «اطلب صلاحية موظف»، فيظهر طلبه هنا.</span></div>`}
    <div class="section-title">الموظفون الحاليون</div>
    <div class="note">${icon('shield')}<span>مالك التطبيق لديه صلاحية موظف في كل المكاتب تلقائياً.</span></div>
    ${S.staffList.length ? `<div class="list">${S.staffList.map(s => `<div class="box">
      <div class="box-head"><div>${person(s.id)}<span class="meta">${esc(s.note || '')}</span></div><button class="btn sm danger" data-act="revoke" data-id="${esc(s.id)}">${icon('x')}سحب الصلاحية</button></div>
      <div class="tags">${(s.offices || []).map(id => `<span class="tagchip">${esc(oname(id))}</span>`).join('')}</div>
    </div>`).join('')}</div>` : `<p class="muted">لا يوجد موظفون بعد.</p>`}`;
}
export function vOfficeForm(){
  const o = S.route.params.id ? S.offices.find(x => x.id === S.route.params.id) : null;
  return `<div class="wrap" data-view="officeForm">${backBtn()}
    <section class="hero"><div class="hero-kicker">${icon('pin')}${o ? 'تعديل موقع' : 'موقع جديد'}</div><h1 class="hero-title">${o ? esc(o.name) : 'أضف مكتب مفقودات'}</h1></section>
    <form data-form="office" data-id="${esc(o?.id || '')}" class="panel" novalidate>
      <div class="field"><label for="o-name">اسم المنشأة</label><input id="o-name" name="name" class="input" required maxlength="80" value="${esc(o?.name || '')}" placeholder="مثال: مطار الملك فهد الدولي"></div>
      <div class="two">
        <div class="field"><label for="o-short">اسم مختصر</label><input id="o-short" name="short" class="input" maxlength="30" value="${esc(o?.short || '')}" placeholder="يظهر في الشريط العلوي"></div>
        <div class="field"><label for="o-type">النوع</label><select id="o-type" name="type" class="input">${OFFICE_TYPES.map(t => `<option value="${t.id}" ${o?.type === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
        <div class="field"><label for="o-city">المدينة</label><input id="o-city" name="city" class="input" maxlength="40" value="${esc(o?.city || '')}"></div>
        <div class="field"><label for="o-code">رمز القيد (حروف لاتينية)</label><input id="o-code" name="code" class="input" maxlength="4" dir="ltr" value="${esc(o?.code || '')}" placeholder="TCA"></div>
      </div>
      <div class="field"><label for="o-place">موقع المكتب داخل المنشأة</label><input id="o-place" name="place" class="input" maxlength="120" value="${esc(o?.place || '')}"></div>
      <div class="two">
        <div class="field"><label for="o-hours">أوقات العمل</label><input id="o-hours" name="hours" class="input" maxlength="80" value="${esc(o?.hours || '')}"></div>
        <div class="field"><label for="o-phone">رقم التواصل</label><input id="o-phone" name="phone" class="input" maxlength="30" dir="ltr" value="${esc(o?.phone || '')}"></div>
        <div class="field"><label for="o-ret">مدة الحفظ (أيام)</label><input id="o-ret" name="retentionDays" type="number" min="7" max="365" class="input" value="${esc(o?.retentionDays || 90)}"></div>
      </div>
      <div class="field"><label for="o-spots">أماكن العثور داخل المنشأة</label><textarea id="o-spots" name="spots" class="input" placeholder="مكان في كل سطر">${esc((o?.spots || []).join('\n'))}</textarea><span class="hint">تظهر كقائمة اختيار عند تسجيل المفقودات والبلاغات.</span></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}حفظ</button>
    </form>
  </div>`;
}

