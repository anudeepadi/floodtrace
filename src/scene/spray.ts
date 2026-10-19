// Spray and debris thrown up by the breaking front (cinematic mode only).
import * as THREE from 'three';

const MAX = 6000;
const SPRAY_RATE = 2200;        // particles per second at full intensity
const DEBRIS_SHARE = 0.25;
const GRAVITY = 0.07;           // km/s²
const DRAG = 0.6;               // 1/s

export interface SprayEmitter {
  /** Wet points across the front where spray can start (world space). */
  points: readonly THREE.Vector3[];
  /** Unit downstream direction (world space, horizontal). */
  downstream: THREE.Vector3;
  /** 0..1, scales emission and launch speed. */
  intensity: number;
  /** Front velocity on screen (world km per real second); spray is carried along with it. */
  carry: THREE.Vector3;
}

export interface Spray {
  readonly points: THREE.Points;
  update(dt: number, emitter: SprayEmitter | null): void;
  clear(): void;
}

export function createSpray(): Spray {
  const pos = new Float32Array(MAX * 3), vel = new Float32Array(MAX * 3);
  const age = new Float32Array(MAX).fill(1), life = new Float32Array(MAX).fill(1);
  const kind = new Float32Array(MAX), seed = Float32Array.from({ length: MAX }, Math.random);
  const t = new Float32Array(MAX); // normalised age for the shader

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 900 } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aT; attribute float aKind; attribute float aSeed;
      uniform float uScale;
      varying float vT; varying float vKind;
      void main() {
        vT = aT; vKind = aKind;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Spray puffs grow as they rise; debris stays small.
        float size = aKind > 0.5 ? 0.012 + aSeed * 0.016 : 0.02 + aT * (0.05 + aSeed * 0.08);
        gl_PointSize = aT >= 1.0 ? 0.0 : size * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying float vT; varying float vKind;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        if (vKind > 0.5) {
          gl_FragColor = vec4(vec3(0.16, 0.12, 0.09), (1.0 - smoothstep(0.35, 0.5, r)) * (1.0 - vT));
        } else {
          float soft = 1.0 - smoothstep(0.0, 0.5, r);
          float fade = smoothstep(0.0, 0.08, vT) * (1.0 - vT);
          gl_FragColor = vec4(vec3(0.86, 0.83, 0.78), soft * soft * fade * 0.32);
        }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 3;

  let next = 0, carry = 0;
  const spawn = (e: SprayEmitter) => {
    const i = next; next = (next + 1) % MAX;
    const origin = e.points[(Math.random() * e.points.length) | 0];
    const debris = Math.random() < DEBRIS_SHARE;
    const up = debris ? 0.01 + Math.random() * 0.03 : 0.05 + Math.random() * 0.12;
    const fwd = (debris ? 0.03 : 0.02) + Math.random() * 0.05;
    const side = (Math.random() - 0.5) * 0.06;
    pos[i * 3] = origin.x; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z;
    vel[i * 3] = e.carry.x + e.downstream.x * fwd - e.downstream.z * side;
    vel[i * 3 + 1] = up * (0.5 + e.intensity);
    vel[i * 3 + 2] = e.carry.z + e.downstream.z * fwd + e.downstream.x * side;
    age[i] = 0;
    life[i] = debris ? 1.2 + Math.random() : 0.9 + Math.random() * 1.4;
    kind[i] = debris ? 1 : 0;
  };

  return {
    points,
    update(dt, emitter) {
      if (emitter && emitter.points.length) {
        carry += SPRAY_RATE * emitter.intensity * dt;
        while (carry >= 1) { spawn(emitter); carry -= 1; }
      }
      const drag = Math.exp(-DRAG * dt);
      const cx = emitter?.carry.x ?? 0, cz = emitter?.carry.z ?? 0;
      for (let i = 0; i < MAX; i++) {
        if (age[i] >= life[i]) { t[i] = 1; continue; }
        age[i] += dt;
        // Air drag pulls horizontal speed toward the moving front, so the cloud travels with the surge.
        vel[i * 3] = cx + (vel[i * 3] - cx) * drag; vel[i * 3 + 2] = cz + (vel[i * 3 + 2] - cz) * drag;
        vel[i * 3 + 1] -= GRAVITY * (kind[i] > 0.5 ? 1.4 : 0.6) * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        t[i] = Math.min(1, age[i] / life[i]);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aT.needsUpdate = true;
      geo.attributes.aKind.needsUpdate = true;
    },
    clear() { age.fill(1); t.fill(1); geo.attributes.aT.needsUpdate = true; },
  };
}
