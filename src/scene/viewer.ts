import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BG = 0x050505;
const SHADOW_MAP_SIZE = 4096;
const FLY_SECONDS = 1.2;
const CHASE_STIFFNESS = 1.8; // higher = camera locks on faster

export interface Viewer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly size: { w: number; h: number };
  /** Direction toward the sun (for water specular). */
  readonly sunDir: THREE.Vector3;
  flyTo(target: THREE.Vector3, distance?: number): void;
  resetView(): void;
  /** Damped move toward a camera pose; call every frame while chasing. */
  chase(target: THREE.Vector3, eye: THREE.Vector3, dt: number): void;
  /** Fires when the user starts dragging/zooming the map. */
  onUserControl(fn: () => void): void;
  /** Keep the camera at least `clearanceKm` above the ground height returned by `groundY`. */
  clampToGround(groundY: (x: number, z: number) => number, clearanceKm: number): void;
  start(onFrame: (dt: number) => void): void;
}

export function createViewer(container: HTMLElement, worldSpan: number): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, worldSpan * 1.1, worldSpan * 2.6);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, worldSpan * 6);
  const home = { pos: new THREE.Vector3(-worldSpan * 0.55, worldSpan * 0.62, worldSpan * 0.72), target: new THREE.Vector3(0, 1.5, 0) };
  camera.position.copy(home.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 2;
  controls.maxDistance = worldSpan * 2.5;

  scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x2a2620, 1.1));
  // Mid-morning sun from the south-east (the collapse happened at 08:37 local time, late August).
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.2);
  sun.position.set(30, 55, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  const half = worldSpan * 0.62;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const sunDir = sun.position.clone().normalize();

  const size = { w: 1, h: 1 };
  const resize = () => {
    size.w = container.clientWidth; size.h = container.clientHeight;
    renderer.setSize(size.w, size.h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  let ground: { groundY: (x: number, z: number) => number; clearanceKm: number } | null = null;
  let flight: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t: number } | null = null;
  const fly = (target: THREE.Vector3, camTo: THREE.Vector3) => {
    flight = { from: controls.target.clone(), to: target.clone(), camFrom: camera.position.clone(), camTo, t: 0 };
  };

  return {
    scene, camera, size, sunDir,
    flyTo(target, distance = 9) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      dir.y = Math.max(dir.y, 0.55);
      fly(target, target.clone().add(dir.normalize().multiplyScalar(distance)));
    },
    resetView() { fly(home.target, home.pos.clone()); },
    chase(target, eye, dt) {
      flight = null;
      const k = 1 - Math.exp(-dt * CHASE_STIFFNESS);
      controls.target.lerp(target, k);
      camera.position.lerp(eye, k);
    },
    onUserControl(fn) { controls.addEventListener('start', fn); },
    clampToGround(groundY, clearanceKm) { ground = { groundY, clearanceKm }; },
    start(onFrame) {
      const clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 0.1);
        if (flight) {
          flight.t = Math.min(1, flight.t + dt / FLY_SECONDS);
          const k = flight.t * flight.t * (3 - 2 * flight.t);
          controls.target.lerpVectors(flight.from, flight.to, k);
          camera.position.lerpVectors(flight.camFrom, flight.camTo, k);
          if (flight.t === 1) flight = null;
        }
        controls.update();
        if (ground) {
          const minY = ground.groundY(camera.position.x, camera.position.z) + ground.clearanceKm;
          if (camera.position.y < minY) camera.position.y = minY;
        }
        onFrame(dt);
        renderer.render(scene, camera);
      });
    },
  };
}
