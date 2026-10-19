import { formatClock } from '../sim/flood';
import type { AppState } from '../state';
import { el, type UiContext } from './context';
import { section } from './layers';

export function mountEvents(root: HTMLElement, ctx: UiContext): (s: AppState) => void {
  root.replaceChildren();
  const sec = section('Events');
  const legend = el('div', 'certainty-legend');
  for (const c of ['observed', 'derived', 'modeled'] as const) legend.append(el('span', `cert cert-${c}`, c));
  sec.body.append(legend);

  const ordered = [...ctx.events].sort((a, b) => ctx.eventTime(a) - ctx.eventTime(b));
  const rows = ordered.map(e => {
    const t = ctx.eventTime(e);
    const row = el('button', `event sev-${e.severity}`);
    const top = el('span', 'event-top');
    top.append(el('span', 'event-time mono', formatClock(t)), el('span', 'event-title', e.title), el('span', `cert cert-${e.certainty}`, e.certainty));
    row.append(top, el('span', 'event-detail', e.detail));
    row.addEventListener('click', () => { ctx.seek(t); if (e.siteId) ctx.select(e.siteId); });
    sec.body.append(row);
    return { row, t };
  });

  root.append(sec.node);
  return s => { for (const r of rows) r.row.classList.toggle('past', r.t <= s.tMin); };
}
