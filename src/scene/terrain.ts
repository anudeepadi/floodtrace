import * as THREE from 'three';
import type { Frame } from './frame';
import { EXAGGERATION } from './frame';

const CONTOUR_INTERVAL_M = 500;

/** Where the flood touched the ground, per terrain vertex. */
export interface ScarInput {
  texture: THREE.DataTexture;
  sections: number;
  /** Nearest corridor section per vertex (−1 = outside the corridor). */
  section: Int32Array;
  /** Normal-flow water level per section (m), i.e. bed + base depth. */
  baseLevelM: Float32Array;
}

export interface Terrain {
  readonly mesh: THREE.Mesh;
  setImagery(on: boolean): void;
  setContours(on: boolean): void;
}

export function createTerrain(frame: Frame, imagery: HTMLCanvasElement, scar: ScarInput): Terrain {
  const { field, extent } = frame;
  const geo = new THREE.PlaneGeometry(extent.widthKm, extent.heightKm, field.cols - 1, field.rows - 1);
  geo.rotateX(-Math.PI / 2); // x east, z south; vertex order is row-major from north
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, (field.data[i] / 1000) * EXAGGERATION);
  geo.computeVertexNormals();

  // Per-vertex link into the flood scar: section index and height above that section's normal water level.
  const aSect = new Float32Array(pos.count), aAbove = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const s = scar.section[i];
    aSect[i] = s;
    aAbove[i] = s < 0 ? 1e4 : field.data[i] - scar.baseLevelM[s];
  }
  geo.setAttribute('aSect', new THREE.BufferAttribute(aSect, 1));
  geo.setAttribute('aAbove', new THREE.BufferAttribute(aAbove, 1));

  const texture = new THREE.CanvasTexture(imagery);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const uniforms = {
    uContour: { value: 1 },
    uInterval: { value: (CONTOUR_INTERVAL_M / 1000) * EXAGGERATION },
    uScar: { value: scar.texture },
    uSections: { value: scar.sections },
  };
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSect;
        attribute float aAbove;
        uniform sampler2D uScar;
        uniform float uSections;
        varying float vElev;
        varying float vWet;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vElev = position.y;
        vWet = 0.0;
        if (aSect >= 0.0) {
          float reached = texture2D(uScar, vec2((aSect + 0.5) / uSections, 0.5)).r;
          // Fade the mark out over the top few metres so the high-water line is soft.
          vWet = (1.0 - smoothstep(reached - 6.0, reached + 2.0, aAbove)) * step(0.5, reached);
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vElev;
        varying float vWet;
        uniform float uContour;
        uniform float uInterval;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // Analyst grade, as before: slightly desaturated and cooled imagery.
        float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(luma), 0.3) * vec3(0.82, 0.88, 0.98);
        // Ground the flood covered: grey-brown silt over the original texture, darker where still wet.
        vec3 silt = diffuseColor.rgb * 0.55 + vec3(0.24, 0.21, 0.17);
        diffuseColor.rgb = mix(diffuseColor.rgb, silt, vWet * 0.55);
        float e = vElev / uInterval;
        float line = 1.0 - min(abs(fract(e - 0.5) - 0.5) / fwidth(e), 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), line * 0.1 * uContour);`);
  };

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return {
    mesh,
    setImagery(on) {
      material.map = on ? texture : null;
      material.color.set(on ? 0xffffff : 0x5a6573);
      material.needsUpdate = true;
    },
    setContours(on) { uniforms.uContour.value = on ? 1 : 0; },
  };
}
