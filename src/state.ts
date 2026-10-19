export type LayerId = 'imagery' | 'contours' | 'route' | 'inundation' | 'cinematic' | 'sites' | 'labels';

export interface AppState {
  readonly tMin: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly selectedId: string | null;
  /** Cinematic mode: camera chases the wave front and playback paces itself. */
  readonly follow: boolean;
  readonly layers: Readonly<Record<LayerId, boolean>>;
}

export type Listener = (state: AppState, prev: AppState) => void;

export interface Store {
  get(): AppState;
  update(fn: (s: AppState) => Partial<AppState>): void;
  subscribe(fn: Listener): () => void;
}

export function createStore(initial: AppState): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    update(fn) {
      const prev = state;
      state = { ...prev, ...fn(prev) };
      listeners.forEach(l => l(state, prev));
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export const toggleLayer = (s: AppState, id: LayerId): Partial<AppState> => ({ layers: { ...s.layers, [id]: !s.layers[id] } });
