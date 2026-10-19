import { INCIDENT } from '../data/incident';
import { formatClock } from '../sim/flood';
import type { AppState } from '../state';
import { el, fmtKm, type UiContext } from './context';

export function mountTopbar(root: HTMLElement, ctx: UiContext): (s: AppState) => void {
  root.replaceChildren();
  const brand = el('div', 'brand');
  brand.append(el('span', 'brand-name', 'FloodTrace'));

  const crumb = el('div', 'crumbs');
  crumb.append(el('span', 'crumb active', INCIDENT.name), el('span', 'tag', INCIDENT.id));

  const clock = el('div', 'clock');
  const clockTime = el('span', 'clock-time'), clockMeta = el('span', 'clock-meta', `${INCIDENT.date}, Nepal time`);
  clock.append(clockTime, clockMeta);

  const metrics = el('div', 'metrics');
  const metric = (label: string) => {
    const box = el('div', 'metric'), value = el('span', 'metric-value');
    box.append(el('span', 'metric-label', label), value);
    metrics.append(box);
    return value;
  };
  const mFront = metric('Front from glacier'), mVel = metric('Front speed'), mHit = metric('Sites hit');
  const ok = ctx.model.consistentWithEstimate, v = ctx.model.debrisSpeed.toFixed(1);
  const mode = el('span', ok ? 'calibration' : 'calibration warn-cal');
  mode.append('Debris speed ', el('b', '', `${v} m/s`));
  mode.title = `Solved from the observed travel time: collapse 08:37, Gyirong destroyed 08:44. `
    + (ok ? 'Close to the published estimate of about 52 m/s.' : 'Far from the published estimate of about 52 m/s, so check the traced route.');

  root.append(brand, crumb, clock, metrics, mode);

  return s => {
    clockTime.textContent = formatClock(s.tMin);
    const km = ctx.model.frontKm(s.tMin);
    mFront.textContent = km > 0 ? fmtKm(km) : '—';
    mVel.textContent = km > 0 && km < ctx.model.totalKm ? `${ctx.model.velocity(km).toFixed(1)} m/s` : '—';
    const hit = ctx.sites.filter(site => ctx.model.arrivalMin(ctx.siteKm[site.id]) <= s.tMin).length;
    mHit.textContent = `${hit} / ${ctx.sites.length}`;
    mHit.classList.toggle('critical', hit > 0);
  };
}
