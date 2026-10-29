import { renderStrip } from './Strip.js?v=0.4.26';

const symbols={
  persons:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  objects:'<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9"/>',
  rides:'<path d="m5 8 2-5h10l2 5M3 9h18v9H3V9Zm3 9v3m12-3v3M6 13h2m8 0h2"/>',
  tasks:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9V3Zm-1 11 3 3 5-6"/>',
  actions:'<path d="m13 2-8 12h6l-1 8 9-13h-7l1-7Z"/>',
  locations:'<path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  environment:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
  cards:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'
};

// Shared object-list contract. Editor/detail strips keep renderStrip's own policy.
export function renderObjectStrip({module='objects',iconHtml='',...options}={}) {
  const icon=iconHtml||'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(symbols[module]||symbols.objects)+'</svg>';
  return renderStrip({
    variant:'location',surfaceClassName:'sh-location-row',ariaLabel:options.title||'',
    actions:[{kind:'edit',label:'Bewerk'},{kind:'delete',label:'Verwijder'}],
    trailingHtml:'<span class="sh-location-chevron" aria-hidden="true">›</span>',
    ...options,
    className:'sh-object-strip '+(options.className||''),
    accentColor:/^#[0-9a-f]{6}$/i.test(options.accentColor||'')?options.accentColor:'#489ff8',
    leadingHtml:'<span class="sh-strip-icon" aria-hidden="true">'+icon+'</span>'
  });
}
