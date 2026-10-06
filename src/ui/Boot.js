const NORMAL_MIN_MS = 500;
const FIRST_RUN_INTRO_MS = 1400;

export async function holdBoot(startedAt, minimumMs = NORMAL_MIN_MS) {
  const elapsed = performance.now() - startedAt;
  if (elapsed >= minimumMs) return;
  await new Promise(resolve => setTimeout(resolve, minimumMs - elapsed));
}

export async function askForName(root, startedAt, { initialName = '' } = {}) {
  await holdBoot(startedAt, FIRST_RUN_INTRO_MS);

  const inner = root.querySelector('.sharon-boot-inner');
  if (!inner) return '';

  inner.innerHTML = `
    <small class="sharon-boot-kicker">SHARE ON</small>
    <h1 class="sharon-boot-title">Sharon</h1>
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

  const form = inner.querySelector('[data-sharon-intro-form]');
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
      resolve(name);
    });
  });
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
