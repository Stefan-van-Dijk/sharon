const LINES = [
  'Begin klein.',
  'Voeg iets toe dat je al kent.',
  'Een persoon. Een object. Een plek.',
  'Later verbind je er tijd, ritten, acties en kaarten aan.',
  'En deel je alleen wat jij wilt.'
];

const CHOICES = [
  { id: 'people', label: 'Persoon toevoegen' },
  { id: 'objects', label: 'Object toevoegen' },
  { id: 'locations', label: 'Locatie toevoegen' }
];

export async function runStory(root, { name = '' } = {}) {
  root.innerHTML = `
    <section class="story-layer" aria-label="Start met Sharon">
      <header class="story-brand" aria-label="Sharon">
        <span>Shar</span>
        <img src="./assets/sharon-mark.png?v=0.1.14" alt="" aria-hidden="true">
        <span>n</span>
      </header>

      <div class="story-content">
        <div class="story-copy" data-story-copy aria-live="polite"></div>
        <span class="type-caret" data-type-caret aria-hidden="true"></span>

        <div class="story-choices" data-story-choices hidden>
          ${CHOICES.map(choice => `
            <button type="button" class="story-choice" data-story-choice="${choice.id}">
              <span>${choice.label}</span>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7.5 4.5 13 10l-5.5 5.5"/>
              </svg>
            </button>
          `).join('')}
        </div>
      </div>
    </section>
  `;

  const copy = root.querySelector('[data-story-copy]');
  const caret = root.querySelector('[data-type-caret]');
  const choices = root.querySelector('[data-story-choices]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const lines = [...LINES];
  if (name) lines[0] = `Begin klein, ${name}.`;

  if (reducedMotion) {
    copy.innerHTML = lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
  } else {
    for (const line of lines) {
      const paragraph = document.createElement('p');
      copy.append(paragraph);
      await typeLine(paragraph, line);
      await sleep(line.length > 40 ? 360 : 280);
    }
  }

  caret.hidden = true;
  choices.hidden = false;
  requestAnimationFrame(() => choices.classList.add('is-visible'));

  return new Promise(resolve => {
    choices.addEventListener('click', event => {
      const button = event.target.closest('[data-story-choice]');
      if (!button) return;
      resolve(button.dataset.storyChoice);
    }, { once: true });
  });
}

async function typeLine(element, text) {
  for (let index = 0; index < text.length; index += 1) {
    element.textContent += text[index];

    const character = text[index];
    let delay = 27;

    if (character === '.' || character === ',' || character === ':') delay = 110;
    if (character === ' ') delay = 18;

    await sleep(delay);
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  })[character]);
}
