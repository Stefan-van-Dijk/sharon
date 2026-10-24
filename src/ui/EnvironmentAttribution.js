// OSMF permits the short linked name; OpenFreeMap's own credit is optional.
// Keep the OpenMapTiles schema credit and every other active source credit.
// https://osmfoundation.org/wiki/Attribution_Guidelines
// https://openfreemap.org/#attribution
export const OSM_MAP_CREDIT = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" title="OpenStreetMap contributors · Open Database License (ODbL)">OpenStreetMap</a>';
const OPENMAPTILES_CREDIT = '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" title="OpenMapTiles · CC BY 4.0">OpenMapTiles</a>';

export function compactEnvironmentAttribution(style) {
  // Presentation is local to Omgeving; the shared style remains unchanged for
  // Locaties and the other map viewers. MapLibre still manages source credits.
  return {...style,sources:{...style.sources,openmaptiles:{...style.sources.openmaptiles,
    attribution:OPENMAPTILES_CREDIT+' · '+OSM_MAP_CREDIT}}};
}
