import { compactEnvironmentAttribution } from './EnvironmentAttribution.js?v=0.4.38';
/**
 * Shared renderer bootstrap for Omgeving and Locaties.
 * Both screens must use the same MapLibre module, stylesheet, worker and
 * MapLibre constructor. Only the interaction controls differ.
 */
export const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
export const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css';
export const MAPLIBRE_WORKER = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs';

export function ensureRendererStyle(doc = document) {
  if (doc.querySelector('[data-sharon-maplibre-css]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = MAPLIBRE_CSS;
  link.dataset.sharonMaplibreCss = 'true';
  doc.head.append(link);
}

export function configureRenderer(library) {
  if (typeof library?.Map !== 'function') {
    throw new Error('De kaartbibliotheek kon niet worden geladen.');
  }
  // The ESM build on iOS needs the external module worker URL.
  library.setWorkerUrl?.(MAPLIBRE_WORKER);
  library.setWorkerCount?.(2);
  return library;
}

export function createSharonMap(library, options) {
  configureRenderer(library);
  const style = compactEnvironmentAttribution(options.style);
  return new library.Map(style === options.style ? options : {...options, style});
}

export async function loadSharonRenderer(loadRenderer = () => import(MAPLIBRE_JS)) {
  ensureRendererStyle();
  return configureRenderer(await loadRenderer());
}
