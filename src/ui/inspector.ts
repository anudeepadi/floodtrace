import { SOURCES } from '../data/incident';
import { KIND_LABEL } from '../scene/markers';
import { formatClock } from '../sim/flood';
import type { AppState } from '../state';
import { el, fmtKm, type UiContext } from './context';
import { section } from './layers';

/** Object view for the selected site: properties, live model status, sourced facts. */
export function mountInspector(root: HTMLElement, ctx: UiContext): (s: AppState, prev: AppState | null) => void {
  root.replaceChildren();
  const sec = section('Site');
  root.append(sec.node);

  // A site's arrival counts as observed only if an observed event is pinned to it.
  const observedSites = new Set(ctx.events.filter(e => e.certainty === 'observed' && e.siteId).map(e => e.siteId));
  const live = el('dl', 'props');
  let liveRows: { arrival: HTMLElement; stage: HTMLElement; status: HTMLElement } | null = null;

  const renderEmpty = () => {
    sec.body.replaceChildren(el('p', 'empty', 'Click a site on the map or an event to see it here.'));
    liveRows = null;
  };

  const renderSite = (id: string) => {
    const site = ctx.sites.find(s => s.id === id);
    if (!site) return renderEmpty();
    const head = el('div', 'obj-head');
    head.append(el('span', `obj-kind kind-${site.kind}`, KIND_LABEL[site.kind]), el('h2', 'obj-title', site.name));

    const props = el('dl', 'props');
    const prop = (k: string, v: string) => props.append(el('dt', '', k), el('dd', 'mono', v));
    prop('Coordinates', `${site.lat.toFixed(3)}°N ${site.lon.toFixed(3)}°E (approx.)`);
    prop('River chainage', fmtKm(ctx.siteKm[id]));
    prop('On the river', site.onRoute ? 'Yes' : 'No, measured to the nearest river point');

    live.replaceChildren();
    const row = (k: string) => { const dd = el('dd', 'mono'); live.append(el('dt', '', k), dd); return dd; };
    liveRows = { arrival: row('Surge arrives'), stage: row('Water now'), status: row('Status') };

    const facts = el('ul', 'facts');
    for (const f of site.facts) facts.append(el('li', '', f));
    const srcs = el('div', 'obj-sources');
    for (const s of site.sources) {
      const a = el('a', 'source-link', SOURCES[s].label);
      a.href = SOURCES[s].url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      srcs.append(a);
    }

    const close = el('button', 'ghost-btn', 'Clear');
    close.addEventListener('click', () => ctx.select(null));
    head.append(close);

    sec.body.replaceChildren(head, props, el('h3', 'sub', 'Model'), live, el('h3', 'sub', 'Reported'), facts, srcs);
  };

  const refreshLive = (s: AppState) => {
    if (!liveRows || !s.selectedId) return;
    const km = ctx.siteKm[s.selectedId], arrival = ctx.model.arrivalMin(km), stage = ctx.model.stage(km, s.tMin);
    const observed = observedSites.has(s.selectedId);
    liveRows.arrival.textContent = `${formatClock(arrival)} (${observed ? 'observed' : 'modeled'})`;
    liveRows.stage.textContent = stage > 0 ? `${stage.toFixed(1)} m above normal` : 'Normal level';
    const delta = Math.round(arrival - s.tMin);
    liveRows.status.textContent = delta > 0 ? `Surge in ${delta} min` : 'Hit';
    liveRows.status.className = delta > 0 ? 'mono warn' : 'mono critical';
  };

  return (s, prev) => {
    if (!prev || s.selectedId !== prev.selectedId) (s.selectedId ? renderSite(s.selectedId) : renderEmpty());
    refreshLive(s);
  };
}
