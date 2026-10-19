import { formatClock } from '../sim/flood';
import type { AppState } from '../state';
import { el, fitCanvas, type UiContext } from './context';

const C = {
  grid: '#1f1f1f', axis: '#5a5a5a', text: '#7a7a7a', line: '#f2f2f2', fill: 'rgba(255,255,255,0.06)',
  cursor: '#f2f2f2', front: '#e5484d', terrain: '#6a6a6a', terrainFill: 'rgba(255,255,255,0.05)', water: '#cfcfcf',
};
const PAD = { l: 38, r: 10, t: 8, b: 18 };
const DEFAULT_SITE = 'betrawati';

interface Plot { ctx: CanvasRenderingContext2D; w: number; h: number; x: (v: number) => number; y: (v: number) => number }

function axes(canvas: HTMLCanvasElement, xMax: number, yMax: number, yTicks: number[], xLabel: (v: number) => string, xTicks: number[]): Plot {
  const { ctx, w, h } = fitCanvas(canvas);
  const x = (v: number) => PAD.l + (v / xMax) * (w - PAD.l - PAD.r);
  const y = (v: number) => h - PAD.b - (v / yMax) * (h - PAD.t - PAD.b);
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.lineWidth = 1;
  ctx.fillStyle = C.text;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const t of yTicks) {
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(PAD.l, y(t)); ctx.lineTo(w - PAD.r, y(t)); ctx.stroke();
    ctx.fillText(String(t), PAD.l - 6, y(t));
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const t of xTicks) ctx.fillText(xLabel(t), x(t), h - PAD.b + 4);
  return { ctx, w, h, x, y };
}

function cursor(p: Plot, xv: number, color = C.cursor) {
  p.ctx.strokeStyle = color; p.ctx.setLineDash([3, 3]);
  p.ctx.beginPath(); p.ctx.moveTo(p.x(xv), PAD.t); p.ctx.lineTo(p.x(xv), p.h - PAD.b); p.ctx.stroke();
  p.ctx.setLineDash([]);
}

function series(p: Plot, n: number, fx: (i: number) => number, fy: (i: number) => number, stroke: string, fill?: string) {
  const { ctx } = p;
  ctx.beginPath();
  for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x(fx(i)), p.y(fy(i)));
  ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
  if (fill) { ctx.lineTo(p.x(fx(n - 1)), p.y(0)); ctx.lineTo(p.x(fx(0)), p.y(0)); ctx.fillStyle = fill; ctx.fill(); }
}

const niceTicks = (max: number, count: number) => {
  const step = 10 ** Math.floor(Math.log10(max / count));
  const s = [1, 2, 5, 10].map(m => m * step).find(v => max / v <= count) ?? step * 10;
  return Array.from({ length: Math.floor(max / s) + 1 }, (_, i) => i * s);
};

export function mountCharts(root: HTMLElement, ctx: UiContext): (s: AppState) => void {
  root.replaceChildren();
  const card = (title: string) => {
    const box = el('div', 'chart-card'), head = el('div', 'chart-head'), sub = el('span', 'chart-sub');
    head.append(el('span', 'chart-title', title), sub);
    const canvas = el('canvas', 'chart-canvas');
    box.append(head, canvas);
    root.append(box);
    return { canvas, sub };
  };
  const front = card('Front position'), hydro = card('Water level'), profile = card('River profile');
  front.sub.textContent = 'km from the glacier';
  const timeTicks = Array.from({ length: Math.floor(ctx.endMin / 30) + 1 }, (_, i) => i * 30);
  const routeSites = ctx.sites.filter(s => s.onRoute);

  return s => {
    const { model, route, endMin } = ctx;

    // 1 · Front position vs time, with site arrivals as dots.
    const kmTicks = niceTicks(model.totalKm, 4);
    const p1 = axes(front.canvas, endMin, model.totalKm * 1.05, kmTicks, formatClock, timeTicks);
    const N = 160;
    series(p1, N, i => (i / (N - 1)) * endMin, i => model.frontKm((i / (N - 1)) * endMin), C.line, C.fill);
    for (const site of routeSites) {
      const km = ctx.siteKm[site.id], t = model.arrivalMin(km);
      p1.ctx.fillStyle = t <= s.tMin ? C.front : C.axis;
      p1.ctx.beginPath(); p1.ctx.arc(p1.x(t), p1.y(km), 2.5, 0, Math.PI * 2); p1.ctx.fill();
    }
    cursor(p1, s.tMin);

    // 2 · Hydrograph at the selected (or default) site.
    const siteId = s.selectedId ?? DEFAULT_SITE, km = ctx.siteKm[siteId];
    const siteName = ctx.sites.find(x => x.id === siteId)?.name ?? siteId;
    hydro.sub.textContent = `${siteName}, m above normal`;
    const peak = model.peakStage(km);
    const p2 = axes(hydro.canvas, endMin, peak * 1.15, niceTicks(peak, 4), formatClock, timeTicks);
    series(p2, N, i => (i / (N - 1)) * endMin, i => model.stage(km, (i / (N - 1)) * endMin), C.water, 'rgba(255,255,255,0.07)');
    cursor(p2, model.arrivalMin(km), C.front);
    cursor(p2, s.tMin);

    // 3 · Elevation along the river with the current water surface.
    profile.sub.textContent = 'elevation (m) by river km, surge ×10';
    const zMax = Math.max(...ctx.profileM) * 1.05;
    const n = route.km.length;
    const p3 = axes(profile.canvas, route.totalKm, zMax, niceTicks(zMax, 4), v => `${v.toFixed(0)}`, niceTicks(route.totalKm, 6));
    series(p3, n, i => route.km[i], i => ctx.profileM[i], C.terrain, C.terrainFill);
    // Exaggerate stage ×10 so an 80 m surge is visible against a 5 km relief.
    series(p3, n, i => route.km[i], i => ctx.profileM[i] + model.stage(route.km[i], s.tMin) * 10, C.water);
    const fk = model.frontKm(s.tMin);
    if (fk > 0 && fk < model.totalKm) cursor(p3, fk, C.front);
  };
}
