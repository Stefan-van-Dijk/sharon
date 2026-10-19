const paths={
  loyalty:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  membership:'<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>',
  access:'<circle cx="8" cy="9" r="4"/><path d="M11 12 21 22"/>',
  ticket:'<path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/>',
  other:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9h8M8 13h6"/>'
};
export const cardSymbol=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[kind]||paths.other)+'</svg>';
