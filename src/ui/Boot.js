const NORMAL_MIN_MS = 500;
const FIRST_RUN_INTRO_MS = 900;

export async function holdBoot(startedAt, minimumMs = NORMAL_MIN_MS) {
  const elapsed = performance.now() - startedAt;
  if (elapsed >= minimumMs) return;
  await new Promise(resolve => setTimeout(resolve, minimumMs - elapsed));
}

export async function askForName(root, startedAt) {
  await holdBoot(startedAt, FIRST_RUN_INTRO_MS);

  const boot = root.querySelector('.sharon-boot');
  const inner = root.querySelector('.sharon-boot-inner');
  if (!boot || !inner) return '';

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
        required
      >
      <button type="submit">Verder</button>
    </form>
  `;

  const form = inner.querySelector('[data-sharon-intro-form]');
  const input = form.querySelector('input[name="name"]');

  setTimeout(() => input.focus({ preventScroll: true }), 120);

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
    }, { once: false });
  });
}
