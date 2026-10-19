import * as THREE from 'three';
import type { Site, SiteKind } from '../data/incident';
import { lonLatToLocal } from '../geo/mercator';
import type { Frame } from './frame';

const STEM_M = 700;
/** Label box position relative to its stem top (px). */
const LABEL_OFFSET = { x: 7, y: -12 };
const KIND_COLOR: Record<SiteKind, number> = {
  origin: 0xe5484d, border: 0xffffff, settlement: 0xffffff, hydro: 0xffffff, bridge: 0xffffff, staging: 0xffffff,
};
export const KIND_LABEL: Record<SiteKind, string> = {
  origin: 'Collapse site', border: 'Border crossing', settlement: 'Settlement', hydro: 'Hydropower plant', bridge: 'Bridge', staging: 'Army staging area',
};

export interface SiteStatus { impacted: boolean; text: string }

export interface Markers {
  readonly group: THREE.Group;
  update(camera: THREE.Camera, viewport: { w: number; h: number }, status: (id: string) => SiteStatus, selectedId: string | null): void;
  setVisible(sites: boolean, labels: boolean): void;
}

export function createMarkers(frame: Frame, sites: readonly Site[], overlay: HTMLElement, onSelect: (id: string) => void): Markers {
  const group = new THREE.Group();
  const anchors = sites.map(site => {
    const { u, v } = lonLatToLocal(frame.extent, site.lon, site.lat);
    const base = frame.toWorld(u, v), top = frame.toWorld(u, v, STEM_M);
    const color = KIND_COLOR[site.kind];
    const stem = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([base, top]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }),
    );
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color }));
    dot.position.copy(top);
    group.add(stem, dot);

    const el = document.createElement('button');
    el.className = `site-label kind-${site.kind}`;
    el.innerHTML = `<span class="site-name"></span><span class="site-status"></span>`;
    el.querySelector('.site-name')!.textContent = site.name;
    el.addEventListener('click', () => onSelect(site.id));
    overlay.appendChild(el);
    return { site, top, el, status: el.querySelector<HTMLElement>('.site-status')! };
  });

  const v = new THREE.Vector3();
  let labelsOn = true;
  const priority = (id: string, kind: SiteKind, selectedId: string | null) =>
    id === selectedId ? 0 : kind === 'origin' || kind === 'border' ? 1 : kind === 'settlement' ? 3 : 2;
  return {
    group,
    update(camera, viewport, status, selectedId) {
      // Declutter: place labels by priority and hide any that would overlap one already placed.
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const ordered = [...anchors].sort((a, b) => priority(a.site.id, a.site.kind, selectedId) - priority(b.site.id, b.site.kind, selectedId));
      for (const a of ordered) {
        v.copy(a.top).project(camera);
        const x = ((v.x + 1) / 2) * viewport.w, y = ((1 - v.y) / 2) * viewport.h;
        const rect = { x: x + LABEL_OFFSET.x, y: y + LABEL_OFFSET.y, w: a.el.offsetWidth || 140, h: a.el.offsetHeight || 30 };
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        const overlaps = placed.some(r => rect.x < r.x + r.w && r.x < rect.x + rect.w && rect.y < r.y + r.h && r.y < rect.y + rect.h);
        const visible = labelsOn && onScreen && !overlaps;
        a.el.style.display = visible ? '' : 'none';
        if (!visible) continue;
        placed.push(rect);
        a.el.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
        const s = status(a.site.id);
        a.status.textContent = s.text;
        a.el.classList.toggle('impacted', s.impacted);
        a.el.classList.toggle('selected', a.site.id === selectedId);
      }
    },
    setVisible(sitesOn, labels) { group.visible = sitesOn; labelsOn = sitesOn && labels; },
  };
}

