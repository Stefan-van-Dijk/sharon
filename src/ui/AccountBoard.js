import {bindNotesBoard} from './ShopPairing.js?v=0.5.35';

export function openAccountBoard(document, service, {mode:initial='login', name='', onLogin=()=>{}}={}) {
 const previous = document.activeElement;
 const dialog = document.createElement('dialog');
 dialog.className = 'sh-notes-board sh-account-board';
 dialog.setAttribute('aria-label', 'Sharon-account');
 const header = document.createElement('header');
 header.className = 'sh-notes-heading';
 const heading = document.createElement('h2');
 heading.textContent = 'Sharon-account';
 header.append(heading);
 const form = document.createElement('form');
 form.className = 'sh-notes-body';
 const fields = document.createElement('div');
 fields.className = 'sh-account-fields';
 const field = (labelText, type, autocomplete) => {
  const label = document.createElement('label');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.type = type; input.autocomplete = autocomplete; input.required = true;
  label.append(input); fields.append(label);
  return input;
 };
 const email = field('E-mailadres', 'email', 'email');
 email.maxLength = 254;
 const password = field('Wachtwoord', 'password', 'current-password');
 const code = field('Code uit je e-mail', 'text', 'one-time-code');
 code.spellcheck = false;
 const feedback = document.createElement('p');
 feedback.setAttribute('role', 'status');
 const submit = document.createElement('button');
 submit.type = 'submit';
 const navigation = document.createElement('div');
 navigation.className = 'sh-account-board-actions';
 const button = (label, action) => {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = label; element.onclick = action;
  return element;
 };
 const close = () => {
  if (!dialog.isConnected) return;
  release(); form.reset(); dialog.remove(); previous?.focus();
 };
 const release = bindNotesBoard(dialog, header, close);
 let mode;
 function setMode(next) {
  mode = next;
  feedback.textContent = '';
  const needsCode = ['verify', 'reset'].includes(mode);
  const needsPassword = ['register', 'login', 'verify', 'reset'].includes(mode);
  password.disabled = !needsPassword; password.parentElement.hidden = !needsPassword;
  password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  password.minLength = mode === 'login' ? 1 : 12; password.maxLength = 72;
  code.disabled = !needsCode; code.parentElement.hidden = !needsCode;
  submit.textContent = {register:'Account aanmaken', login:'Inloggen', verify:'Bevestig e-mailadres',
   forgot:'Stuur herstelcode', reset:'Bewaar nieuw wachtwoord', resend:'Stuur nieuwe bevestigingscode'}[mode];
  navigation.replaceChildren();
  const choices = mode === 'login'
   ? [['register','Account aanmaken'], ['forgot','Wachtwoord vergeten'], ['verify','E-mailadres bevestigen']]
   : mode === 'verify' ? [['resend','Nieuwe code aanvragen'], ['login','Inloggen']]
   : mode === 'forgot' ? [['reset','Ik heb een herstelcode'], ['login','Inloggen']]
   : [['login','Inloggen']];
  for (const [nextMode, label] of choices) navigation.append(button(label, () => setMode(nextMode)));
 }
 form.append(fields, submit, feedback, navigation, button('Sluiten', close));
 form.onsubmit = async event => {
  event.preventDefault();
  const action = mode;
  for (const control of form.querySelectorAll('button')) control.disabled = true;
  feedback.textContent = '';
  try {
   const input = {email:email.value.trim()};
   if (!password.disabled) input.password = password.value;
   if (!code.disabled) input.code = code.value.trim();
   if (action === 'login') {
    const account = await service.login({...input, name});
    if (!dialog.isConnected) return;
    close(); onLogin(account); return;
   }
   await service.request(action, input);
   if (!dialog.isConnected) return;
   if (action === 'register' || action === 'resend') {
    setMode('verify'); feedback.textContent = 'Als het adres gebruikt kan worden, ontvang je een bevestigingscode.';
   } else if (action === 'forgot') {
    setMode('reset'); feedback.textContent = 'Als het account bestaat, ontvang je een herstelcode.';
   } else {
    setMode('login'); password.value = ''; code.value = '';
    feedback.textContent = action === 'verify' ? 'Je e-mailadres is bevestigd. Log in om verder te gaan.' : 'Je wachtwoord is gewijzigd. Log opnieuw in.';
   }
  } catch (error) {
   if (dialog.isConnected) feedback.textContent = error.message;
  } finally {
   for (const control of form.querySelectorAll('button')) control.disabled = false;
  }
 };
 setMode(initial);
 dialog.append(header, form);
 dialog.addEventListener('close', close, {once:true});
 document.body.append(dialog); dialog.showModal(); email.focus();
 return close;
}
