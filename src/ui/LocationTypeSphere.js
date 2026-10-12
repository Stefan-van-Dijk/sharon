import { LOCATION_GROUPS, locationType, locationIcon } from '../core/location/LocationTypeRegistry.js?v=0.2.44';

// One focused level at a time. The same picker is used by first onboarding,
// new locations, and editing a saved location.
export function mountLocationTypeSphere(graph, { selectedType = null, onSelect = () => {} } = {}) {
  let selected = locationType(selectedType) ? selectedType : null;
  let groupId = null;
  const shell = document.createElement('div');
  shell.className = 'sh-type-picker';
  const navigation = document.createElement('div');
  navigation.className = 'sh-type-picker-nav';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '‹ Alle groepen';
  back.className = 'sh-type-picker-back';
  back.addEventListener('click', () => { groupId = null; render(); });
  const heading = document.createElement('span');
  heading.className = 'sh-type-picker-heading';
  heading.setAttribute('aria-live','polite');
  navigation.append(back, heading);
  const circle = document.createElement('div');
  circle.className = 'sh-type-picker-circle';
  circle.setAttribute('role','group');
  const choice = document.createElement('div');
  choice.className = 'sh-type-picker-current';
  choice.setAttribute('aria-live','polite');
  shell.append(navigation,circle,choice);
  graph.replaceChildren(shell);

  const chooseGroup = id => { groupId = id; render(); };
  const chooseType = type => {
    selected = type.id;
    onSelect(type.id,type.label);
    render();
  };
  function render() {
    circle.replaceChildren();
    const group = LOCATION_GROUPS.find(value => value.id === groupId);
    back.hidden = !group;
    heading.textContent = group ? group.label : 'Kies een groep';
    const options = group
      ? group.types.map(locationType).filter(Boolean).map(type => ({
          id:type.id,label:type.label,icon:locationIcon(type.id),type
        }))
      : LOCATION_GROUPS.map(entry => ({id:entry.id,label:entry.label,group:entry}));
    const count = options.length;
    for (const [index,item] of options.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-type-picker-option';
      const angle = -Math.PI / 2 + 2 * Math.PI * index / count;
      const radius = count > 5 ? 36 : count > 3 ? 34 : 30;
      button.style.left = (50 + Math.cos(angle) * radius) + '%';
      button.style.top = (50 + Math.sin(angle) * radius) + '%';
      const active = item.type?.id === selected;
      if (active) button.classList.add('is-selected');
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label',item.label);
      if (item.icon) {
        const icon = document.createElement('span');
        icon.className = 'sh-type-picker-icon';
        icon.setAttribute('aria-hidden','true');
        icon.textContent = item.icon;
        button.append(icon);
      }
      const label = document.createElement('span');
      label.textContent = item.label;
      button.append(label);
      button.addEventListener('click', () => item.type ? chooseType(item.type) : chooseGroup(item.id));
      circle.append(button);
    }
    const selectedLabel = selected && locationType(selected)?.label;
    choice.textContent = selectedLabel ? 'Gekozen: ' + selectedLabel : 'Kies een type';
  }
  render();
  return { refresh: render, get value() { return selected; }, showGroups() { groupId = null; render(); } };
}
