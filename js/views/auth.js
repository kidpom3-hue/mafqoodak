// صفحات الدخول والإعداد الأول
import { icon, LOGO, otype } from '../constants.js';
import { t } from '../i18n.js';
import { esc, daysWord } from '../utils.js';
import { S, curOffice } from '../state.js';
import { SETTINGS } from '../config.js';
import { backBtn, claimDomainsOf } from './common.js';
import { sharedDevice } from '../firebase.js';

export function vLogin(){
  const mode = S.route.params.mode || 'signin';
  return `<div class="wrap narrow" data-view="login">${S.hist.length ? backBtn() : ''}
    <div class="intro">${LOGO}
      <h1>${t(mode === 'signup' ? 'login.titleUp' : 'login.titleIn')}</h1>
      <p>${t('login.lead')}</p>
    </div>
    ${/* H19: المكتب يشترط بريد الكلية لطلب الاستلام: تلميح قبل الدخول */ ''}
    ${claimDomainsOf(curOffice()).length ? `<div class="note info domain-hint">${icon('idcard')}<span>${t('login.domainHint', {domains: claimDomainsOf(curOffice()).map(d => `<b dir="ltr">@${esc(d)}</b>`).join(t('c.listSep'))})}</span></div>` : ''}
    ${/* H29: «تذكّرني على هذا الجهاز» قبل طريقتي الدخول (Google والبريد)، محدّد افتراضياً. إلغاؤه = جهاز مشترك (firebase.js) */ ''}
    <div class="remember"><label class="check"><input type="checkbox" id="l-remember" aria-describedby="l-remember-hint"${sharedDevice() ? '' : ' checked'}><span>${t('login.remember')}</span></label>
      <p class="hint" id="l-remember-hint">${t('login.rememberHint')}</p></div>
    <button class="btn block ghost" data-act="google">${icon('users')}${t('login.google')}</button>
    <div class="divider"><span>${t('login.orEmail')}</span></div>
    <div class="seg wide">
      <button class="${mode === 'signin' ? 'on' : ''}" data-act="loginMode" data-v="signin">${t('login.have')}</button>
      <button class="${mode === 'signup' ? 'on' : ''}" data-act="loginMode" data-v="signup">${t('login.new')}</button>
    </div>
    <form data-form="login" data-mode="${mode}" class="panel" novalidate>
      ${mode === 'signup' ? `<div class="field"><label for="l-name">${t('login.name')}</label><input id="l-name" name="name" class="input" autocomplete="name" maxlength="60" placeholder="${t('login.namePh')}"></div>` : ''}
      <div class="field"><label for="l-email">${t('login.email')}</label><input id="l-email" name="email" type="email" class="input" dir="ltr" autocomplete="email"></div>
      ${/* H27: زر إظهار كلمة المرور (أسهل في الجوال)، وفي الحساب الجديد 8 أحرف على الأقل مع تلميح تحت الحقل.
         الحقل باتجاه LTR دائماً، فالحاوية dir=ltr ليكون الزر في نهاية النص (يمين الحقل) لا فوقه */ ''}
      <div class="field"><label for="l-pass">${t('login.pass')}</label>
        <div class="pass-wrap" dir="ltr"><input id="l-pass" name="password" type="password" class="input" dir="ltr" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" enterkeyhint="go"${mode === 'signup' ? ' minlength="8" aria-describedby="l-pass-hint"' : ''}>
          <button type="button" class="pass-eye" data-act="togglePass" aria-controls="l-pass" aria-pressed="false" aria-label="${t('login.showPass')}" title="${t('login.showPass')}">${icon('eye')}</button></div>
        ${mode === 'signup' ? `<p class="hint" id="l-pass-hint">${t('login.passHint')}</p>` : ''}</div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${t(mode === 'signup' ? 'login.create' : 'login.enter')}</button>
      ${mode === 'signin' ? `<button type="button" class="link" data-act="resetPass" style="align-self:center">${t('login.forgot')}</button>` : ''}
    </form>
    <p class="hint legal-link">${t('login.agree', {link: `<button class="link" data-act="nav" data-r="privacy">${t('foot.privacy')}</button>`})}</p>
  </div>`;
}

export function vSetup(){
  if (!S.uid) return `<div class="wrap narrow" data-view="setup">
    <div class="intro">${LOGO}<h1>${t('setup.welcome')}</h1>
      <p>${t('setup.welcomeLead')}</p></div>
    <button class="btn block" data-act="login">${icon('users')}${t('ui.signIn')}</button>
  </div>`;
  const o = SETTINGS.firstOffice;
  return `<div class="wrap narrow" data-view="setup">
    <div class="intro">${LOGO}<h1>${t('setup.title')}</h1>
      <p>${t('setup.lead', {email: `<b dir="ltr">${esc(S.me?.email || '')}</b>`})}</p></div>
    <form data-form="setup" class="panel" novalidate>
      <h2 class="section-title">${icon(otype(o.type).icon)}${t('setup.first')}</h2>
      <dl class="facts">
        <dt>${t('setup.org')}</dt><dd>${esc(o.name)}</dd>
        <dt>${t('setup.city')}</dt><dd>${esc(o.city)}</dd>
        <dt>${t('setup.code')}</dt><dd dir="ltr">${esc(o.code)}</dd>
        <dt>${t('setup.keep')}</dt><dd>${daysWord(o.retentionDays)}</dd>
      </dl>
      <p class="hint">${t('setup.editLater')}</p>
      <label class="check"><input type="checkbox" name="samples" checked><span>${t('setup.samples')}</span></label>
      <div class="note warn">${icon('shield')}<span>${t('setup.warn')}</span></div>
      <div class="form-err" hidden></div>
      <button class="btn block" type="submit">${icon('check')}${t('setup.go')}</button>
    </form>
  </div>`;
}

export function vNotConfigured(){
  return `<div class="wrap narrow">
    <div class="intro">${LOGO}<h1>${t('nc.title')}</h1>
      <p>${t('nc.lead')}</p></div>
    <ol class="how">
      <li><b>${t('nc.s1')}</b><span>${t('nc.s1d')}</span></li>
      <li><b>${t('nc.s2')}</b><span>${t('nc.s2d')}</span></li>
      <li><b>${t('nc.s3')}</b><span>${t('nc.s3d')}</span></li>
    </ol>
    <p class="muted">${t('nc.more')}</p>
  </div>`;
}
