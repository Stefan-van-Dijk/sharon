/**
 * Sharon Omgeving: hide or restore UI chrome without changing the map.
 * A MapLibre IControl keeps its small button immediately beside attribution.
 * Provider credits start expanded; a deliberate user action may collapse
 * them, while this persistent control restores the full attribution links.
 */
export function createEnvironmentVisibilityControl(stage) {
  let wrapper = null;
  let button = null;
  let onClick = null;

  return {
    onAdd() {
      wrapper = document.createElement('div');
      wrapper.className = 'maplibregl-ctrl environment-visibility-control';
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'environment-visibility-toggle';
      button.setAttribute('aria-label', 'Kaartbediening en bronvermelding verbergen');
      button.setAttribute('aria-pressed', 'false');
      button.title = 'Kaartbediening en bronvermelding verbergen';
      button.innerHTML = `
        <svg class="visibility-eye" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>
          <circle cx="12" cy="12" r="2.6"/>
        </svg>
        <svg class="visibility-eye-off" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.9 5.7A10.9 10.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4"/>
          <path d="M6.5 7.7A17.4 17.4 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1 0 2-.2 2.9-.5"/>
          <path d="M10.5 10.5a2.5 2.5 0 0 0 3 3"/>
          <path d="M3 3l18 18"/>
        </svg>`;
      onClick = event => {
        event.stopPropagation();
        const hidden = stage?.classList.toggle('is-map-clean') ?? false;
        button.setAttribute('aria-pressed', String(hidden));
        const label = hidden ? 'Kaartbediening en bronvermelding tonen' :
          'Kaartbediening en bronvermelding verbergen';
        button.setAttribute('aria-label', label);
        button.title = label;
      };
      button.addEventListener('click', onClick);
      wrapper.append(button);
      return wrapper;
    },
    onRemove() {
      button?.removeEventListener('click', onClick);
      stage?.classList.remove('is-map-clean');
      wrapper?.remove();
      wrapper = null;
      button = null;
      onClick = null;
    }
  };
}
