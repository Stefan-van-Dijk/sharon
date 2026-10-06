const FIRST_RUN_PROMPT_MS = 1100;
const RETURNING_SHARE_MS = 650;
const WELCOME_MS = 850;
const MERGE_MS = 760;
const FINAL_HOLD_MS = 420;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runFirstIntro(root, startedAt, { initialName = '' } = {}) {
  await waitUntil(startedAt, FIRST_RUN_PROMPT_MS);
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

function askForName(root, { initialName = '' } = {}) {
  const intro = root.querySelector('[data-intro]');
  if (!intro) return Promise.resolve('');

  const panel = intro.querySelector('[data-intro-copy]');
  panel.innerHTML = `
    <form class="sharon-intro-form" data-sharon-intro-form>
      <label for="sharonIntroName">Hoe mogen we je noemen?</label>
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

  brand.classList.add('is-closing');
  await sleep(Math.round(MERGE_MS * 0.46));

  brand.classList.add('is-marking');
  await sleep(Math.round(MERGE_MS * 0.54));

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
