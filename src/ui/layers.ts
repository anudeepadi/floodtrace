import { INCIDENT, SITES, SOURCES } from '../data/incident';
import { toggleLayer, type AppState, type LayerId } from '../state';
import { el, type UiContext } from './context';

const LAYERS: readonly { id: LayerId; name: string; meta: string }[] = [
  { id: 'imagery', name: 'Satellite imagery', meta: 'Esri World Imagery' },
  { id: 'contours', name: 'Contours', meta: '500 m interval · AWS Terrain' },
  { id: 'route', name: 'Flood route', meta: 'DEM least-cost path' },
  { id: 'inundation', name: 'Water', meta: 'River and modeled surge' },
  { id: 'cinematic', name: 'Cinematic water', meta: 'Waves, spray, 3× height. Not to scale' },
  { id: 'sites', name: 'Sites & infrastructure', meta: `${SITES.length} objects` },
  { id: 'labels', name: 'Labels', meta: 'Names and arrival times' },
];

export function mountLayers(root: HTMLElement, ctx: UiContext): (s: AppState) => void {
  root.replaceChildren();

  const layerSec = section('Layers');
  const toggles = LAYERS.map(layer => {
    const row = el('label', 'layer-row');
    const box = el('input'); box.type = 'checkbox';
    box.addEventListener('change', () => ctx.store.update(s => toggleLayer(s, layer.id)));
    const text = el('span', 'layer-text');
    text.append(el('span', 'layer-name', layer.name), el('span', 'layer-meta', layer.meta));
    row.append(box, text);
    layerSec.body.append(row);
    return { id: layer.id, box };
  });

  const overview = section('Incident');
  const grid = el('div', 'stat-grid');
  for (const st of INCIDENT.stats) {
    const cell = el('div', `stat tone-${st.tone}`);
    cell.append(el('span', 'stat-value', st.value), el('span', 'stat-label', st.label));
    grid.append(cell);
  }
  const props = el('dl', 'props');
  const prop = (k: string, v: string) => props.append(el('dt', '', k), el('dd', '', v));
  prop('Trigger', INCIDENT.trigger);
  prop('Districts', INCIDENT.districts.join(', '));
  prop('Reach modeled', `${ctx.route.totalKm.toFixed(1)} km`);
  prop('Calibration', `${ctx.siteKm.gyirong.toFixed(1)} km from the collapse to Gyirong in 7 min (observed)`);
  overview.body.append(grid, el('p', 'fine', INCIDENT.statsAsOf), props);

  const src = section('Sources');
  for (const id of INCIDENT.sources) {
    const a = el('a', 'source-link', SOURCES[id].label);
    a.href = SOURCES[id].url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    src.body.append(a);
  }

  root.append(layerSec.node, overview.node, src.node);
  return s => { for (const t of toggles) t.box.checked = s.layers[t.id]; };
}

export function section(title: string): { node: HTMLElement; body: HTMLElement } {
  const node = el('section', 'panel-section');
  const head = el('header', 'section-head', title);
  const body = el('div', 'section-body');
  node.append(head, body);
  return { node, body };
}
