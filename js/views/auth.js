// صفحات الدخول والإعداد الأول
import { icon, LOGO, otype } from '../constants.js';
import { esc, daysWord } from '../utils.js';
import { S } from '../state.js';
import { SETTINGS } from '../config.js';
import { backBtn } from './common.js';

export function vLogin(){
  const mode = S.route.params.mode || 'signin';
  return `<div class="wrap narrow" data-view="login">${S.hist.length ? backBtn() : ''}
    <div class="intro">${LOGO}
      <h1>${mode === 'signup' ? 'أنشئ حسابك' : 'سجّل الدخول'}</h1>
      <p>تحتاج حساباً لتسجيل البلاغات وطلب استلام مفقوداتك. تصفّح المفقودات متاح للجميع دون تسجيل.</p>
    </div>
    <button class="btn block ghost" data-act="google">${icon('users')}المتابعة بحساب Google</button>
    <div class="divider"><span>أو بالبريد الإلكتروني</span></div>
    <div class="seg wide">
      <button class="${mode === 'signin' ? 'on' : ''}" data-act="loginMode" data-v="signin">لدي حساب</button>
      <button class="${mode === 'signup' ? 'on' : ''}" data-act="loginMode" data-v="signup">حساب جديد</button>
    </div>
    <form data-form="login" data-mode="${mode}" class="panel" novalidate>
      ${mode === 'signup' ? `<div class="field"><label for="l-name">الاسم</label><input id="l-name" name="name" class="input" autocomplete="name" maxlength="60" placeholder="مثال: عبدالله محمد"></div>` : ''}
      <div class="field"><label for="l-email">البريد الإلكتروني</label><input id="l-email" name="email" type="email" class="input" dir="ltr" autocomplete="email"></div>
      <div class="field"><label for="l-pass">كلمة المرور</label><input id="l-pass" name="password" type="password" class="input" dir="ltr" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${mode === 'signup' ? 'إنشاء الحساب' : 'دخول'}</button>
      ${mode === 'signin' ? `<button type="button" class="link" data-act="resetPass" style="align-self:center">نسيت كلمة المرور؟</button>` : ''}
    </form>
  </div>`;
}

export function vSetup(){
  if (!S.uid) return `<div class="wrap narrow" data-view="setup">
    <div class="intro">${LOGO}<h1>مرحباً بك في مفقودك</h1>
      <p>التطبيق متصل بـ Firebase لكنه لم يُجهَّز بعد. سجّل الدخول بالحساب الذي تريده مالكاً للتطبيق، ثم أكمل الإعداد.</p></div>
    <button class="btn block" data-act="login">${icon('users')}تسجيل الدخول</button>
  </div>`;
  const o = SETTINGS.firstOffice;
  return `<div class="wrap narrow" data-view="setup">
    <div class="intro">${LOGO}<h1>إعداد التطبيق لأول مرة</h1>
      <p>ستصبح مالك التطبيق بحسابك <b dir="ltr">${esc(S.me?.email || '')}</b>، وتدير المواقع وصلاحيات الموظفين.</p></div>
    <form data-form="setup" class="panel" novalidate>
      <div class="section-title">${icon(otype(o.type).icon)}أول موقع</div>
      <dl class="facts">
        <dt>المنشأة</dt><dd>${esc(o.name)}</dd>
        <dt>المدينة</dt><dd>${esc(o.city)}</dd>
        <dt>رمز القيد</dt><dd dir="ltr">${esc(o.code)}</dd>
        <dt>مدة الحفظ</dt><dd>${daysWord(o.retentionDays)}</dd>
      </dl>
      <p class="hint">تعدّل هذه البيانات لاحقاً من لوحة الإدارة، أو قبل الإعداد من ملف js/config.js.</p>
      <label class="check"><input type="checkbox" name="samples" checked><span>أضف 9 مفقودات توضيحية للتجربة (مُعلّمة بـ«مثال» وتُحذف بزر واحد)</span></label>
      <div class="note warn">${icon('shield')}<span>أول من يكمل هذه الخطوة يصبح مالك التطبيق، لذلك أكملها فور نشر التطبيق.</span></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}أكمل الإعداد وابدأ</button>
    </form>
  </div>`;
}

export function vNotConfigured(){
  return `<div class="wrap narrow">
    <div class="intro">${LOGO}<h1>خطوة أخيرة قبل التشغيل</h1>
      <p>التطبيق غير مربوط بقاعدة بيانات بعد. افتح الملف <code>js/config.js</code> والصق فيه إعدادات مشروعك من Firebase.</p></div>
    <ol class="how">
      <li><b>أنشئ مشروعاً في Firebase</b><span>من console.firebase.google.com</span></li>
      <li><b>أضف تطبيق ويب</b><span>Project settings ← Your apps ← أيقونة &lt;/&gt;</span></li>
      <li><b>انسخ الإعدادات</b><span>الصقها في firebaseConfig داخل js/config.js</span></li>
    </ol>
    <p class="muted">الخطوات الكاملة في ملف README.md داخل المستودع.</p>
  </div>`;
}
