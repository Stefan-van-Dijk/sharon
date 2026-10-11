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
      // Reuse the exact Sharon mark used by the app. The mark does not
      // change between states; accessible labels convey the current action.
      button.innerHTML = `<img class="environment-visibility-logo"
        src="./assets/sharon-logo.svg?v=0.1.87"
        alt="" aria-hidden="true" draggable="false">`;
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
