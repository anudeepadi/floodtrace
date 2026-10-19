import type { IncidentEvent, Site } from '../data/incident';
import type { Route } from '../geo/route';
import type { FloodModel } from '../sim/flood';
import type { Store } from '../state';

/** Everything the panels need, resolved once at startup. */
export interface UiContext {
  readonly store: Store;
  readonly model: FloodModel;
  readonly route: Route;
  readonly sites: readonly Site[];
  readonly events: readonly IncidentEvent[];
  /** River chainage for every site (off-route sites use the nearest river point). */
  readonly siteKm: Readonly<Record<string, number>>;
  /** Elevation (m) sampled along the route, aligned with route.km. */
  readonly profileM: readonly number[];
  readonly endMin: number;
  eventTime(e: IncidentEvent): number;
  seek(tMin: number): void;
  select(id: string | null): void;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** HiDPI-aware canvas sizing; returns a context scaled to CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export const fmtKm = (km: number) => `${km.toFixed(1)} km`;
