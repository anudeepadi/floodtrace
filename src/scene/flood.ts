import * as THREE from 'three';
import type { Corridor } from '../geo/corridor';
import type { Route } from '../geo/route';
import { pointAtKm } from '../geo/route';
import { CINEMATIC_SCALE, cinematicStage } from '../sim/cinematic';
import type { FloodModel } from '../sim/flood';
import type { SprayEmitter } from './spray';
import { EXAGGERATION, type Frame } from './frame';
import waterVert from './water.vert.glsl?raw';
import waterFrag from './water.frag.glsl?raw';

/** Normal-flow depth above the DEM valley floor (the 70 m DEM cannot resolve the channel). */
export const BASE_DEPTH_M = 14;
const FRONT_LINE_M = 1400;

export interface FloodLayer {
  readonly group: THREE.Group;
  /** Max stage reached per corridor section, for the terrain's silt/wet mark. */
  readonly scar: THREE.DataTexture;
  /** `cinematic` draws exaggerated waves; the modeled values elsewhere are unchanged. */
  update(tMin: number, elapsedSec: number, cinematic: boolean): void;
  /** Where spray should leave the breaking front, or null when there is no front. */
  /** `carry` is the front's on-screen velocity (world km per real second). */
  emitter(carrySpeed: number): SprayEmitter | null;
  setRouteVisible(on: boolean): void;
  setInundationVisible(on: boolean): void;
}

export function createFloodLayer(
  frame: Frame, route: Route, corridor: Corridor, model: FloodModel, sunDir: THREE.Vector3, fog: THREE.Fog,
): FloodLayer {
  const group = new THREE.Group();
  const { sections, lateral } = corridor;
  const n = sections * lateral;
  const ex = frame.extent;

  // --- Water sheet over the corridor ---
  const positions = new Float32Array(n * 3), depth = new Float32Array(n), stage = new Float32Array(n);
  const chain = new Float32Array(n), lat = new Float32Array(n), speed = new Float32Array(n);
  for (let i = 0; i < sections; i++) for (let j = 0; j < lateral; j++) {
    const k = i * lateral + j;
    positions[k * 3] = (corridor.uv[k * 2] - 0.5) * ex.widthKm;
    positions[k * 3 + 2] = (corridor.uv[k * 2 + 1] - 0.5) * ex.heightKm;
    chain[k] = corridor.km[i];
    lat[k] = corridor.lat[j];
    speed[k] = model.velocity(corridor.km[i]);
  }
  const index: number[] = [];
  for (let i = 0; i < sections - 1; i++) for (let j = 0; j < lateral - 1; j++) {
    const a = i * lateral + j, b = a + 1, c = a + lateral, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  geo.setAttribute('aStage', new THREE.BufferAttribute(stage, 1));
  geo.setAttribute('aChain', new THREE.BufferAttribute(chain, 1));
  geo.setAttribute('aLat', new THREE.BufferAttribute(lat, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setIndex(index);

  const material = new THREE.ShaderMaterial({
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFrontKm: { value: 0 },
      uSunDir: { value: sunDir.clone().normalize() },
      uFogColor: { value: fog.color },
      uFogNear: { value: fog.near },
      uFogFar: { value: fog.far },
      uWave: { value: 0 },
      uExag: { value: EXAGGERATION / 1000 },
    },
  });
  const water = new THREE.Mesh(geo, material);
  water.renderOrder = 2;
  water.frustumCulled = false;
  group.add(water);

  // --- Flood scar data (read by the terrain shader) ---
  const scarData = new Float32Array(sections);
  const scar = new THREE.DataTexture(scarData, sections, 1, THREE.RedFormat, THREE.FloatType);
  scar.magFilter = THREE.LinearFilter;
  scar.minFilter = THREE.LinearFilter;
  scar.needsUpdate = true;

  // --- Projected route: thin dashed line ---
  const centre = route.points.map(p => frame.toWorld(p.u, p.v, BASE_DEPTH_M + 4));
  const routeLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(centre),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.18, gapSize: 0.22, transparent: true, opacity: 0.45 }),
  );
  routeLine.computeLineDistances();
  group.add(routeLine);

  // --- Wave-front marker: a single hairline ---
  const frontLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, (FRONT_LINE_M / 1000) * EXAGGERATION, 0)]),
    new THREE.LineBasicMaterial({ color: 0xe5484d }),
  );
  group.add(frontLine);

  const toY = (m: number) => (m / 1000) * EXAGGERATION;
  const sectionAt = (km: number) => Math.min(sections - 1, Math.max(0, Math.round(km / (corridor.km[1] - corridor.km[0]))));
  const centreOf = (i: number) => {
    const k = (i * lateral + (lateral - 1) / 2) * 2;
    return new THREE.Vector3((corridor.uv[k] - 0.5) * ex.widthKm, 0, (corridor.uv[k + 1] - 0.5) * ex.heightKm);
  };
  let currentFrontKm = 0, cinematicOn = false;
  return {
    group,
    scar,
    update(tMin, elapsedSec, cinematic) {
      const frontKm = model.frontKm(tMin);
      for (let i = 0; i < sections; i++) {
        const km = corridor.km[i], modeled = model.stage(km, tMin);
        const s = cinematic ? cinematicStage(modeled, frontKm - km, model.peakStage(km)) : modeled;
        const levelM = corridor.bedM[i] + BASE_DEPTH_M + s;
        scarData[i] = model.maxStageReached(km, tMin) * (cinematic ? CINEMATIC_SCALE : 1);
        for (let j = 0; j < lateral; j++) {
          const k = i * lateral + j;
          positions[k * 3 + 1] = toY(levelM);
          depth[k] = levelM - corridor.groundM[k];
          stage[k] = s;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aDepth.needsUpdate = true;
      geo.attributes.aStage.needsUpdate = true;
      scar.needsUpdate = true;

      const km = frontKm;
      currentFrontKm = km; cinematicOn = cinematic;
      material.uniforms.uWave.value = cinematic ? 1 : 0;
      material.uniforms.uTime.value = elapsedSec;
      material.uniforms.uFrontKm.value = km;
      const active = km > 0 && km < model.totalKm;
      frontLine.visible = active;
      if (active) {
        const p = pointAtKm(route, km);
        frontLine.position.copy(frame.toWorld(p.u, p.v));
      }
    },
    emitter(carrySpeed) {
      if (!cinematicOn || currentFrontKm <= 0 || currentFrontKm >= model.totalKm) return null;
      const i = sectionAt(currentFrontKm - 0.08);
      const points: THREE.Vector3[] = [];
      for (let j = 0; j < lateral; j++) {
        const k = i * lateral + j;
        if (depth[k] > 0) points.push(new THREE.Vector3(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]));
      }
      const downstream = centreOf(Math.min(sections - 1, i + 4)).sub(centreOf(Math.max(0, i - 4))).setY(0).normalize();
      const intensity = Math.min(1, Math.max(0.25, model.velocity(currentFrontKm) / 30));
      return { points, downstream, intensity, carry: downstream.clone().multiplyScalar(carrySpeed) };
    },
    setRouteVisible(on) { routeLine.visible = on; },
    setInundationVisible(on) { water.visible = on; },
  };
}
