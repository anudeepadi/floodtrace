import './styles.css';
import * as THREE from 'three';
import { EVENTS, SITES, TIMELINE_END_MIN, type IncidentEvent } from './data/incident';
import { downsample } from './geo/heightfield';
import { createExtent, localToLonLat, lonLatToLocal } from './geo/mercator';
import { buildCorridor, nearestSections } from './geo/corridor';
import { buildRoute, type Route } from './geo/route';
import { loadTiles } from './loaders/tiles';
import { BASE_DEPTH_M, createFloodLayer } from './scene/flood';
import { createFrame } from './scene/frame';
import { createMarkers } from './scene/markers';
import { createSpray } from './scene/spray';
import { createTerrain } from './scene/terrain';
import { createViewer } from './scene/viewer';
import { createFloodModel, formatClock } from './sim/flood';
import { chasePose, followRate } from './sim/follow';
import { pointAtKm } from './geo/route';
import { createStore, type AppState } from './state';
import type { UiContext } from './ui/context';
import { mountCharts } from './ui/charts';
import { mountEvents } from './ui/events';
import { mountInspector } from './ui/inspector';
import { mountLayers } from './ui/layers';
import { mountTimeline } from './ui/timeline';
import { mountTopbar } from './ui/topbar';

// Observation used to calibrate the model: collapse 08:37 → Gyirong destroyed 08:44 NPT.
const COLLAPSE_MIN = 7;
const GYIRONG_TRAVEL_SEC = 7 * 60;
const DEBRIS_ESTIMATE = 52;   // m/s, published estimate (sanity check only)
const FLOOD_V_MIN = 7;        // m/s, assumed flood-wave floor (cf. 2021 Chamoli flood ~7 m/s mean)
const FLOOD_DECAY_KM = 12;    // assumed distance over which the debris flow dilutes
const SIM_MIN_PER_SEC = 2; // playback rate at 1×
const ROUTE_DOWNSAMPLE = 2; // pathfinding grid; the terrain mesh uses the full-resolution DEM
const CORRIDOR = { spacingKm: 0.06, halfWidthKm: 1.4, lateral: 41, bedHalfWidthKm: 0.25 };
const SHAKE_KM = 0.012; // cinematic camera shake amplitude in follow mode
// Follow-flood camera: on-screen front pace and chase framing (world units = km).
const FOLLOW_PACE = { kmPerSec: 1.4, idleRate: 1.5 };
const CHASE = { backKm: 4.5, lookAheadKm: 2, sideKm: 1.8 };
const CHASE_LIFT_KM = 1.8;
const CAMERA_CLEARANCE_KM = 0.35;
const SIGHT_SAMPLES = 16;
const SIGHT_MAX_K = 0.9;     // ignore terrain right at the front (it is the front)
const SIGHT_MARGIN_KM = 0.4;

const $ = (id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
};

function setLoading(text: string, isError = false) {
  const box = $('loading');
  box.querySelector('.loading-text')!.textContent = text;
  box.classList.toggle('error', isError);
}

/** Off-route sites (e.g. Dhunche on the hillside) inherit the chainage of the nearest river point. */
function chainageForSites(route: Route, extent: ReturnType<typeof createExtent>): Record<string, number> {
  return Object.fromEntries(SITES.map(site => {
    if (site.id in route.siteKm) return [site.id, route.siteKm[site.id]];
    const p = lonLatToLocal(extent, site.lon, site.lat);
    let best = 0, bestD = Infinity;
    route.points.forEach((q, i) => {
      const d = ((q.u - p.u) * extent.widthKm) ** 2 + ((q.v - p.v) * extent.heightKm) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return [site.id, route.km[best]];
  }));
}

async function boot() {
  setLoading('Loading DEM and imagery tiles…');
  const tiles = await loadTiles();
  const extent = createExtent(tiles.demRange);
  const field = downsample(tiles.heightfield, ROUTE_DOWNSAMPLE);
  const frame = createFrame(extent, tiles.heightfield);

  setLoading('Tracing flood route along valley floors…');
  await new Promise(r => setTimeout(r, 0)); // let the message paint before the heavy pathfinding
  const route = buildRoute(field, extent, SITES.filter(s => s.onRoute));
  const model = createFloodModel({
    totalKm: route.totalKm,
    collapseMin: COLLAPSE_MIN,
    calibration: { distanceKm: route.siteKm.gyirong, travelSec: GYIRONG_TRAVEL_SEC },
    debrisEstimate: DEBRIS_ESTIMATE,
    vMin: FLOOD_V_MIN,
    decayKm: FLOOD_DECAY_KM,
  });
  const siteKm = chainageForSites(route, extent);

  const store = createStore({
    tMin: 0, playing: true, speed: 2, selectedId: null, follow: false,
    layers: { imagery: true, contours: true, route: true, inundation: true, cinematic: false, sites: true, labels: true },
  });

  // ----- Scene -----
  const mapEl = $('map');
  const viewer = createViewer(mapEl, Math.max(extent.widthKm, extent.heightKm));
  const corridor = buildCorridor(route, extent, frame.elevationM, CORRIDOR);
  const flood = createFloodLayer(frame, route, corridor, model, viewer.sunDir, viewer.scene.fog as THREE.Fog);
  const terrain = createTerrain(frame, tiles.imagery, {
    texture: flood.scar,
    sections: corridor.sections,
    section: nearestSections(corridor, frame.field.cols, frame.field.rows, extent, CORRIDOR.halfWidthKm),
    baseLevelM: corridor.bedM.map(b => b + BASE_DEPTH_M),
  });
  const siteWorld = (id: string) => {
    const s = SITES.find(x => x.id === id)!;
    const { u, v } = lonLatToLocal(extent, s.lon, s.lat);
    return frame.toWorld(u, v);
  };
  const ctx: UiContext = {
    store, model, route, sites: SITES, events: EVENTS, siteKm,
    profileM: route.points.map(p => frame.elevationM(p.u, p.v)),
    endMin: TIMELINE_END_MIN,
    eventTime: (e: IncidentEvent) => e.tMin ?? model.arrivalMin(siteKm[e.siteId!]) + (e.offsetMin ?? 0),
    seek: tMin => store.update(() => ({ tMin, follow: false })),
    select: id => {
      store.update(() => ({ selectedId: id, follow: false }));
      if (id) viewer.flyTo(siteWorld(id));
    },
  };
  const spray = createSpray();
  viewer.scene.add(spray.points);
  const markers = createMarkers(frame, SITES, $('overlay'), ctx.select);
  viewer.scene.add(terrain.mesh, flood.group, markers.group);

  // ----- Panels -----
  const panels: ((s: AppState, prev: AppState | null) => void)[] = [
    mountTopbar($('topbar'), ctx),
    mountLayers($('layers'), ctx),
    mountInspector($('inspector'), ctx),
    mountEvents($('events'), ctx),
    mountTimeline($('timeline'), ctx),
    mountCharts($('charts'), ctx),
  ];
  const applyLayers = (s: AppState) => {
    terrain.setImagery(s.layers.imagery);
    terrain.setContours(s.layers.contours);
    flood.setRouteVisible(s.layers.route);
    flood.setInundationVisible(s.layers.inundation);
    spray.points.visible = s.layers.inundation;
    if (!s.layers.cinematic) spray.clear();
    $('cinematic-note').hidden = !s.layers.cinematic;
    markers.setVisible(s.layers.sites, s.layers.labels);
  };
  let dirty = true;
  store.subscribe((s, prev) => {
    if (s.layers !== prev.layers) applyLayers(s);
    dirty = true;
  });
  applyLayers(store.get());
  panels.forEach(render => render(store.get(), null));

  viewer.clampToGround((x, z) => frame.toWorld(x / extent.widthKm + 0.5, z / extent.heightKm + 0.5).y, CAMERA_CLEARANCE_KM);
  $('reset-view').addEventListener('click', () => { store.update(() => ({ follow: false })); viewer.resetView(); });
  const followBtn = $('follow-btn'), caption = $('follow-caption');
  followBtn.addEventListener('click', () => store.update(s => (s.follow
    ? { follow: false }
    : { follow: true, tMin: 0, playing: true, selectedId: null })));
  viewer.onUserControl(() => { if (store.get().follow) store.update(() => ({ follow: false })); });
  store.subscribe((s, prev) => {
    if (s.follow === prev.follow) return;
    followBtn.textContent = s.follow ? 'Stop following' : 'Follow the flood';
    followBtn.classList.toggle('active', s.follow);
    caption.hidden = !s.follow;
  });
  const routeSites = SITES.filter(x => x.onRoute);
  const chaseTo = (tMin: number, dt: number) => {
    const km = model.frontKm(tMin);
    const pose = chasePose(route, km, extent, CHASE);
    const target = frame.toWorld(pose.target.u, pose.target.v);
    // Raise the eye until the straight sight line to the front clears every ridge in between:
    // eyeY·(1−k) + frontY·k ≥ terrain(k) + margin  for all sampled k.
    const front = pointAtKm(route, km);
    const frontY = frame.toWorld(front.u, front.v).y;
    let eyeY = frame.toWorld(pose.eye.u, pose.eye.v).y + CHASE_LIFT_KM;
    for (let i = 1; i < SIGHT_SAMPLES; i++) {
      const k = (i / SIGHT_SAMPLES) * SIGHT_MAX_K;
      const h = frame.toWorld(pose.eye.u + (front.u - pose.eye.u) * k, pose.eye.v + (front.v - pose.eye.v) * k).y;
      eyeY = Math.max(eyeY, (h + SIGHT_MARGIN_KM - frontY * k) / (1 - k));
    }
    const eye = frame.toWorld(pose.eye.u, pose.eye.v).setY(eyeY);
    if (store.get().layers.cinematic && tMin > COLLAPSE_MIN) {
      // Low-frequency rumble rather than random jitter.
      eye.x += Math.sin(elapsed * 23.0) * SHAKE_KM; eye.y += Math.sin(elapsed * 31.0 + 1.3) * SHAKE_KM * 0.7;
    }
    viewer.chase(target, eye, dt);

    const next = routeSites.find(x => siteKm[x.id] > km + 0.05);
    const phase = tMin < COLLAPSE_MIN ? `collapse in ${Math.ceil(COLLAPSE_MIN - tMin)} min` : `front ${km.toFixed(1)} km from the glacier, ${model.velocity(km).toFixed(0)} m/s`;
    const ahead = next ? `, ${next.name} in ${Math.max(0, Math.ceil(model.arrivalMin(siteKm[next.id]) - tMin))} min` : '';
    caption.textContent = `${formatClock(tMin)}  ${phase}${ahead}`;
  };
  mountCursorReadout(mapEl, viewer, terrain.mesh, extent, frame.elevationM);

  // ----- Loop -----
  let prevState = store.get(), elapsed = 0, lastFrontKm = 0;
  viewer.start(dt => {
    const s = store.get();
    if (s.playing) {
      const km = model.frontKm(s.tMin);
      const rate = s.follow
        ? followRate(km > 0 ? model.velocity(km) : 0, FOLLOW_PACE)
        : SIM_MIN_PER_SEC * s.speed;
      const t = s.tMin + dt * rate;
      const frontDone = s.follow && model.frontKm(t) >= model.totalKm;
      store.update(() => (t >= TIMELINE_END_MIN ? { tMin: TIMELINE_END_MIN, playing: false, follow: false } : { tMin: t, follow: s.follow && !frontDone }));
    }
    const now = store.get();
    if (now.follow) chaseTo(now.tMin, dt);
    elapsed += dt;
    flood.update(now.tMin, elapsed, now.layers.cinematic);
    // Front speed on screen, so spray rides along with the surge at any playback rate.
    const frontNow = model.frontKm(now.tMin);
    const carry = dt > 0 ? Math.max(0, frontNow - lastFrontKm) / dt : 0;
    lastFrontKm = frontNow;
    spray.update(dt, now.layers.cinematic && now.layers.inundation ? flood.emitter(carry) : null);
    markers.update(viewer.camera, viewer.size, id => {
      const delta = model.arrivalMin(siteKm[id]) - now.tMin;
      return delta > 0 ? { impacted: false, text: `in ${Math.ceil(delta)} min` } : { impacted: true, text: `hit ${formatClock(model.arrivalMin(siteKm[id]))}` };
    }, now.selectedId);
    if (dirty) { panels.forEach(render => render(now, prevState)); prevState = now; dirty = false; }
  });
  $('loading').remove();
  // Dev-only handle for inspecting the scene from the browser console.
  if (import.meta.env.DEV) Object.assign(window, { __ft: { viewer, store, route, corridor, model, frame } });
}

function mountCursorReadout(
  mapEl: HTMLElement, viewer: ReturnType<typeof createViewer>, mesh: THREE.Mesh,
  extent: ReturnType<typeof createExtent>, elevationM: (u: number, v: number) => number,
) {
  const out = $('cursor-readout');
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pending = false;
  mapEl.addEventListener('pointermove', ev => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const r = mapEl.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, viewer.camera);
      const hit = ray.intersectObject(mesh, false)[0];
      if (!hit) { out.textContent = '—'; return; }
      const u = hit.point.x / extent.widthKm + 0.5, v = hit.point.z / extent.heightKm + 0.5;
      const { lat, lon } = localToLonLat(extent, u, v);
      out.textContent = `${lat.toFixed(4)}°N  ${lon.toFixed(4)}°E  ·  ${Math.round(elevationM(u, v)).toLocaleString()} m`;
    });
  });
}

boot().catch(err => {
  console.error(err);
  setLoading(err instanceof Error ? err.message : String(err), true);
});
