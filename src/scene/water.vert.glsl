#include <common>
#include <logdepthbuf_pars_vertex>

attribute float aDepth;
attribute float aStage;
attribute float aChain;
attribute float aLat;
attribute float aSpeed;

uniform float uTime;
uniform float uWave;      // 0 = modeled surface, 1 = cinematic waves
uniform float uFrontKm;
uniform float uExag;      // world units per metre of height

varying vec3 vWorldPos;
varying float vDepth;
varying float vStage;
varying float vChain;
varying float vLat;
varying float vSpeed;
varying float vCrest;
varying float vWave;

const float TAU = 6.28318530718;

// Downstream-travelling wave trains (wavelengths in km, phase speed in km/s).
float waveTrain(float s, float lat, float t) {
  float a = sin(TAU * (s / 0.45 - t * 0.55) + lat * 0.8);
  float b = 0.55 * sin(TAU * (s / 0.27 - t * 0.85) - lat * 1.9);
  float c = 0.3 * sin(TAU * (s / 0.16 - t * 1.3) + lat * 3.7);
  float w = (a + b + c) / 1.85;
  // Peaked crests and wide troughs, like real swell.
  return w > 0.0 ? pow(w, 0.6) : -pow(-w, 1.4);
}

void main() {
  vec3 p = position;
  float crest = 0.0, wave = 0.0;
  if (uWave > 0.5 && aStage > 0.0 && aDepth > 0.0) {
    // Taller mid-channel, flat at the banks; fades out far behind the front as the surge settles.
    float across = 1.0 - aLat * aLat;
    float behind = uFrontKm - aChain;
    float settle = exp(-max(behind, 0.0) / 12.0);
    float amp = (6.0 + min(aStage, 120.0) * 0.4) * across * (0.35 + 0.65 * settle);
    float w = waveTrain(aChain, aLat, uTime);
    p.y += w * amp * uExag;
    crest = smoothstep(0.35, 0.9, w) * clamp(amp / 10.0, 0.0, 1.0);
    wave = w * clamp(amp / 10.0, 0.0, 1.0);
  }
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vDepth = aDepth;
  vStage = aStage;
  vChain = aChain;
  vLat = aLat;
  vSpeed = aSpeed;
  vCrest = crest;
  vWave = wave;
  gl_Position = projectionMatrix * viewMatrix * world;
  #include <logdepthbuf_vertex>
}
