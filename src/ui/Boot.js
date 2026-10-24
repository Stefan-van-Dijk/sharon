import { focusTextField } from './TextInputFocus.js?v=0.3.96';

const FIRST_RUN_PROMPT_MS = 1100;
const RETURNING_SHARE_MS = 650;
const WELCOME_MS = 850;
const ANTICIPATE_MS = 150;
const CLOSE_MS = 360;
const MORPH_MS = 260;
const REVEAL_MS = 520;
const FINAL_HOLD_MS = 460;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runFirstIntro(root, startedAt, { initialName = '' } = {}) {
  await waitUntil(startedAt, FIRST_RUN_PROMPT_MS);
  await showFirstRunStory(root);
  const name = await askForName(root, { initialName });
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
