import { MAX_CONNECTION_BACKUP_BYTES } from '../core/connection/ConnectionBackup.js?v=0.5.23';
import { focusTextField } from './TextInputFocus.js?v=0.5.23';

const FIRST_RUN_PROMPT_MS = 1100;
const RETURNING_SHARE_MS = 650;
const WELCOME_MS = 850;
const ANTICIPATE_MS = 150;
const CLOSE_MS = 360;
const MORPH_MS = 260;
const REVEAL_MS = 520;
const FINAL_HOLD_MS = 460;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runFirstIntro(root, startedAt, { initialName = '', readPersonId, restoreBackup } = {}) {
  await waitUntil(startedAt, FIRST_RUN_PROMPT_MS);
  await showFirstRunStory(root);
  const name = await askForName(root, { initialName });
  if (readPersonId) await showIdentityChoice(root, readPersonId, restoreBackup);
  await mergeToSharon(root);
  return name;
}

export async function runReturningIntro(root, startedAt, name) {
  await waitUntil(startedAt, RETURNING_SHARE_MS);
  showWelcome(root, name);
  await sleep(WELCOME_MS);
  hideWelcome(root);
  await mergeToSharon(root);
}

async function waitUntil(startedAt, minimumMs) {
  const elapsed = performance.now() - startedAt;
  if (elapsed < minimumMs) await sleep(minimumMs - elapsed);
}

async function showFirstRunStory(root) {
  const panel = root.querySelector('[data-intro-copy]');
  if (!panel) return;
  const lines = [
    'Van plek tot plek, van moment tot moment beweeg je door de wereld.',
    'Een wereld vol informatie. En jij, met je eigen plekken, bezigheden en ervaringen.',
    'Share on brengt die werelden samen. Zodat informatie betekenis krijgt, precies waar en wanneer jij die nodig hebt.',
    'Jouw wereld. Jouw momenten. Jouw informatie.'
  ];
  panel.innerHTML = '';
  panel.classList.add('is-story', 'is-visible');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.className = 'sharon-story-line';
    panel.append(paragraph);
    if (reducedMotion) {
      paragraph.textContent = line;
    } else {
      for (const char of line) {
        paragraph.textContent += char;
        await sleep(/[.!?]/.test(char) ? 250 : char === ',' ? 140 : char === ' ' ? 28 : 43);
      }
    }
    await sleep(reducedMotion ? 0 : 220);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'story-continue';
  button.textContent = 'Zullen we kennismaken?';
  panel.append(button);
  await new Promise(resolve => button.addEventListener('click', () => {
    // Build the name field inside the tap gesture so iOS can open its keyboard.
    askForNamePrepared(root);
    resolve();
  }, { once: true }));
  panel.classList.remove('is-story');
  panel.classList.add('is-visible');
}

function askForNamePrepared(root) {
  const panel = root.querySelector('[data-intro-copy]');
  if (!panel) return;
  panel.innerHTML = '<form class="sharon-intro-form" data-sharon-intro-form><label for="sharonIntroName">Mag ik je naam noteren?</label><input id="sharonIntroName" name="name" type="text" maxlength="80" autocomplete="name" autocapitalize="words" enterkeyhint="done" required><button type="submit">Verder</button></form>';
  focusTextField(panel.querySelector('input[name="name"]'));
}

function askForName(root, { initialName = '' } = {}) {
  const intro = root.querySelector('[data-intro]');
  if (!intro) return Promise.resolve('');

  const panel = intro.querySelector('[data-intro-copy]');
  if (!panel.querySelector('[data-sharon-intro-form]')) panel.innerHTML = `
    <form class="sharon-intro-form" data-sharon-intro-form>
      <label for="sharonIntroName">Mag ik je naam noteren?</label>
      <input
        id="sharonIntroName"
        name="name"
        type="text"
        maxlength="80"
        autocomplete="name"
        autocapitalize="words"
        enterkeyhint="done"
        value="${escapeAttribute(initialName)}"
        required
      >
      <button type="submit">Verder</button>
    </form>
  `;
  panel.classList.add('is-visible');

  const form = panel.querySelector('[data-sharon-intro-form]');
  const input = form.querySelector('input[name="name"]');
  if (initialName && !input.value) input.value = initialName;
  focusTextField(input);

  return new Promise(resolve => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const name = String(new FormData(form).get('name') || '').trim();

      if (!name) {
        input.focus();
        return;
      }

      form.querySelector('button').disabled = true;
      panel.classList.remove('is-visible');

      setTimeout(() => {
        panel.innerHTML = '';
        resolve(name);
      }, 180);
    });
  });
}

function showIdentityChoice(root, readPersonId, restoreBackup) {
  const panel = root.querySelector('[data-intro-copy]');
  if (!panel) return;
  panel.innerHTML = `
    <section class="sharon-intro-form" aria-labelledby="sharonIntroIdentityTitle">
      <h2 id="sharonIntroIdentityTitle">Jouw Sharon-ID</h2>
      <p>Je kunt Sharon op dit toestel gebruiken zonder account.</p>
      <button type="button" data-intro-local>Verder op dit toestel</button>
      ${restoreBackup ? `<details>
        <summary>Herstellen uit back-up</summary>
        <form data-intro-backup>
          <label>Back-upbestand <input name="backup" type="file" accept=".sharon-backup,application/json" required></label>
          <label>Wachtzin <input name="password" type="password" autocomplete="off" required></label>
          <label>Wat wil je herstellen?
            <select name="scope"><option value="connections">Alleen mijn verbindingen</option><option value="full">Ook mijn lokale items en instellingen</option></select>
          </label>
          <button type="submit">Herstellen</button>
          <p role="status" data-intro-restore-status></p>
        </form>
      </details>` : ''}
      <button type="button" data-intro-identity aria-expanded="false" aria-controls="sharonIntroIdentity">Bekijk mijn Sharon-ID</button>
      <div id="sharonIntroIdentity" hidden>
        <p>Je ID hoort bij dit profiel. Je kunt je verbonden ID herstellen met een eerder gemaakte back-up.</p>
        <p role="status" data-intro-person-id></p>
      </div>
    </section>
  `;
  panel.classList.add('is-visible');
  const next = panel.querySelector('[data-intro-local]');
  const identity = panel.querySelector('[data-intro-identity]');
  const details = panel.querySelector('#sharonIntroIdentity');
  const status = panel.querySelector('[data-intro-person-id]');
  const form = panel.querySelector('[data-intro-backup]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button');
    if (submit.disabled) return;
    const result = form.querySelector('[data-intro-restore-status]');
    const { backup, password, scope } = form.elements;
    const file = backup.files[0];
    if (!file || file.size > MAX_CONNECTION_BACKUP_BYTES) {
      result.textContent = 'Kies een geldig Sharon-back-upbestand.';
      return;
    }
    submit.disabled = next.disabled = identity.disabled = true;
    result.textContent = 'Verbindingen controleren…';
    try {
      const withLocal = scope.value === 'full';
      await restoreBackup(await file.text(), password.value, {withLocal});
      form.reset();
      result.textContent = withLocal
        ? 'Je Sharon-ID en lokale gegevens zijn teruggezet.'
        : 'Je Sharon-ID is teruggezet. Je kunt verder op dit toestel.';
    } catch (error) {
      result.textContent = error.message;
    } finally {
      password.value = '';
      submit.disabled = next.disabled = identity.disabled = false;
    }
  });
  next.focus();
  return new Promise(resolve => {
    identity.addEventListener('click', async () => {
      const show = details.hidden;
      details.hidden = !show;
      identity.setAttribute('aria-expanded', String(show));
      if (!show || status.textContent) return;
      try {
        status.textContent = await readPersonId();
      } catch {
        status.textContent = 'Je Sharon-ID kon niet worden opgehaald. Je kunt verder op dit toestel.';
      }
    });
    next.addEventListener('click', () => {
      panel.classList.remove('is-visible');
      panel.replaceChildren();
      resolve();
    }, { once: true });
  });
}

function showWelcome(root, name) {
  const panel = root.querySelector('[data-intro-copy]');
  if (!panel) return;

  panel.innerHTML = `<p class="sharon-welcome">Welkom ${escapeHtml(name)}</p>`;
  requestAnimationFrame(() => panel.classList.add('is-visible'));
}

function hideWelcome(root) {
  const panel = root.querySelector('[data-intro-copy]');
  if (!panel) return;
  panel.classList.remove('is-visible');
}

async function mergeToSharon(root) {
  const brand = root.querySelector('[data-brand-motion]');
  if (!brand) return;

  brand.classList.add('is-anticipating');
  await sleep(ANTICIPATE_MS);

  brand.classList.add('is-closing');
  await sleep(CLOSE_MS);

  brand.classList.add('is-morphing');
  await sleep(MORPH_MS);

  brand.classList.add('is-marking');
  await sleep(REVEAL_MS);

  brand.classList.add('is-final');
  await sleep(FINAL_HOLD_MS);
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  })[character]);
}
