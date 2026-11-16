const paths={
 environment:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z"/><path d="M9 3v16m6-14v16"/>',
 locations:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 cards:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>',
 notes:'<path d="m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2M10 6h11M10 12h11M10 18h11"/>',
 persons:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
 objects:'<path d="m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5m-9 5v9M7.5 5.5l9 5"/>',
 themes:'<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/>',
 actions:'<path d="m4 12 5 5L20 6"/>',
 agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/>',
 time:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 rides:'<path d="m4 10 2-6h12l2 6M3 10h18v8H3Zm2 8v3m14-3v3M6 14h2m8 0h2"/>',
 codes:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M7 7v10m4-10v10m3-10v10m3-10v10"/>',
 settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
 apps:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M18 14v8m-4-4h8"/>'
};
export function moduleIcon(id){return '<svg class="sh-module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[id==='people'?'persons':id]||paths.apps)+'</svg>';}
export function homeModules(settings,available){const saved=settings.home?.modules;return Array.isArray(saved)?[...new Set(saved)].filter(id=>available.includes(id)):[...available];}
