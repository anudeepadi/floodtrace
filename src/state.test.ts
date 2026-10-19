import { describe, expect, it, vi } from 'vitest';
import { createStore, toggleLayer, type AppState } from './state';

const initial: AppState = {
  tMin: 0, playing: false, speed: 1, selectedId: null, follow: false,
  layers: { imagery: true, contours: true, route: true, inundation: true, cinematic: false, sites: true, labels: true },
};

describe('store', () => {
  it('produces a new state object so panels can diff prev vs next', () => {
    const store = createStore(initial);
    store.update(() => ({ tMin: 12 }));
    expect(store.get()).not.toBe(initial);
    expect(initial.tMin).toBe(0);
    expect(store.get().tMin).toBe(12);
  });

  it('notifies subscribers with prev and next state, and stops after unsubscribe', () => {
    const store = createStore(initial), spy = vi.fn();
    const off = store.subscribe(spy);
    store.update(() => ({ selectedId: 'bidur' }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ selectedId: 'bidur' }), initial);
    off();
    store.update(() => ({ selectedId: null }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('toggleLayer flips one layer without mutating the others', () => {
    const next = toggleLayer(initial, 'imagery');
    expect(next.layers?.imagery).toBe(false);
    expect(next.layers?.route).toBe(true);
    expect(initial.layers.imagery).toBe(true);
  });
});
