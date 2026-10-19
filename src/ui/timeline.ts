import { formatClock } from '../sim/flood';
import type { AppState } from '../state';
import { el, fitCanvas, type UiContext } from './context';

const SPEEDS = [1, 2, 5, 10];
const SEV_COLOR = { critical: '#e5484d', warning: '#f2f2f2', info: '#8a8a8a' } as const;
const STEP_MIN = 5;

export function mountTimeline(root: HTMLElement, ctx: UiContext): (s: AppState) => void {
  root.replaceChildren();
  const controls = el('div', 'tl-controls');
  const btn = (label: string, title: string) => { const b = el('button', 'tl-btn', label); b.title = title; controls.append(b); return b; };
  const back = btn('−5', 'Back 5 min'), play = btn('▶', 'Play or pause (space)'), fwd = btn('+5', 'Forward 5 min');
  const speed = btn('1×', 'Playback speed');
  speed.classList.add('tl-speed');

  const track = el('div', 'tl-track');
  const canvas = el('canvas', 'tl-canvas');
  const head = el('div', 'tl-head mono');
  track.append(canvas, head);
  const range = el('span', 'tl-range mono', `${formatClock(0)} → ${formatClock(ctx.endMin)} NPT`);
  root.append(controls, track, range);

  const clampT = (t: number) => Math.min(ctx.endMin, Math.max(0, t));
  back.addEventListener('click', () => ctx.seek(clampT(ctx.store.get().tMin - STEP_MIN)));
  fwd.addEventListener('click', () => ctx.seek(clampT(ctx.store.get().tMin + STEP_MIN)));
  play.addEventListener('click', () => ctx.store.update(s => ({ playing: !s.playing, tMin: s.tMin >= ctx.endMin ? 0 : s.tMin })));
  speed.addEventListener('click', () => ctx.store.update(s => ({ speed: SPEEDS[(SPEEDS.indexOf(s.speed) + 1) % SPEEDS.length] })));
  window.addEventListener('keydown', e => {
    if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, button')) return;
    e.preventDefault(); play.click();
  });

  const tFromPointer = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return clampT(((ev.clientX - r.left) / r.width) * ctx.endMin);
  };
  canvas.addEventListener('pointerdown', ev => {
    canvas.setPointerCapture(ev.pointerId);
    ctx.store.update(() => ({ playing: false }));
    ctx.seek(tFromPointer(ev));
  });
  canvas.addEventListener('pointermove', ev => { if (canvas.hasPointerCapture(ev.pointerId)) ctx.seek(tFromPointer(ev)); });

  const draw = (t: number) => {
    const { ctx: g, w, h } = fitCanvas(canvas);
    const x = (m: number) => (m / ctx.endMin) * w;
    g.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let m = 0; m <= ctx.endMin; m += 15) {
      const major = m % 60 === 30;
      g.fillStyle = major ? '#5a5a5a' : '#2a2a2a';
      g.fillRect(Math.round(x(m)), h - (major ? 12 : 7), 1, major ? 12 : 7);
      if (m % 30 === 0) { g.fillStyle = '#7a7a7a'; g.fillText(formatClock(m), Math.min(w - 16, Math.max(16, x(m))), 2); }
    }
    g.fillStyle = '#f2f2f2'; g.fillRect(0, h / 2 - 1, x(t), 2);
    g.fillStyle = '#2a2a2a'; g.fillRect(x(t), h / 2 - 1, w - x(t), 2);
    for (const e of ctx.events) {
      const ex = x(ctx.eventTime(e));
      g.fillStyle = SEV_COLOR[e.severity];
      g.fillRect(Math.round(ex) - 1, h / 2 - 6, 2, 12);
    }
    head.style.left = `${(t / ctx.endMin) * 100}%`;
    head.textContent = formatClock(t);
  };

  return s => {
    play.textContent = s.playing ? '❚❚' : '▶';
    play.classList.toggle('active', s.playing);
    speed.textContent = `${s.speed}×`;
    draw(s.tMin);
  };
}
