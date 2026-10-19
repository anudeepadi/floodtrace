#include <common>
#include <logdepthbuf_pars_fragment>

uniform float uTime;
uniform float uFrontKm;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uWave;

varying vec3 vWorldPos;
varying float vDepth;
varying float vStage;
varying float vChain;
varying float vLat;
varying float vSpeed;
varying float vCrest;
varying float vWave;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Ripple height field in flow space (x along the river, y across it).
float ripples(vec2 p) {
  float h = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) {
    h += a * vnoise(p);
    p = p * 2.07 + vec2(3.1, 7.7);
    a *= 0.5;
  }
  return h;
}

void main() {
  #include <logdepthbuf_fragment>
  if (vDepth <= 0.0) discard;

  // Ripples advect downstream; faster water scrolls faster and is rougher.
  float turb = clamp(vStage / 45.0, 0.0, 1.0);
  vec2 p = vec2(vChain * 55.0 - uTime * (0.8 + vSpeed * 0.09), vLat * 60.0);
  float e = 0.04;
  float h0 = ripples(p);
  float hx = ripples(p + vec2(e, 0.0));
  float hy = ripples(p + vec2(0.0, e));
  float rough = 0.35 + turb * 1.2;
  vec3 n = normalize(vec3(-(hx - h0) / e * rough * 0.05, 1.0, -(hy - h0) / e * rough * 0.05));
  if (uWave > 0.5) {
    // Light the displaced wave geometry, keeping the small ripples on top of it.
    vec3 ng = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
    if (ng.y < 0.0) ng = -ng;
    n = normalize(ng + vec3(n.x, 0.0, n.z));
  }

  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 R = reflect(-V, n);
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 sky = mix(vec3(0.14, 0.16, 0.18), vec3(0.70, 0.76, 0.82), smoothstep(-0.1, 0.9, R.y));

  // Glacial river is grey-green; the debris flood is opaque brown with sediment.
  vec3 body = mix(vec3(0.10, 0.14, 0.14), vec3(0.34, 0.27, 0.19), turb);
  vec3 col = mix(body, sky, fresnel * 0.8);
  col += pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0) * 1.4;
  // Cinematic: troughs darker, crests lighter with a broad sheen, so the swell reads from above.
  col *= 1.0 + 0.6 * vWave;
  col += uWave * pow(max(dot(R, normalize(uSunDir)), 0.0), 40.0) * 0.25 * max(vWave, 0.0);

  // Foam: shoreline, the breaking front, and whitecaps on fast water.
  float shore = 1.0 - smoothstep(0.0, 1.2 + vStage * 0.04, vDepth);
  float behind = uFrontKm - vChain;
  float front = uFrontKm > 0.01 ? smoothstep(0.7, 0.0, behind) * step(0.0, behind) : 0.0;
  float caps = smoothstep(0.6, 0.78, h0) * turb;
  // Foam breaks into streaks stretched along the current.
  float grain = smoothstep(0.3, 0.8, ripples(vec2(p.x * 0.7, p.y * 2.6) * 1.8));
  float foam = clamp(shore * 0.35 + front * 0.9 + caps + vCrest * 1.3, 0.0, 1.0) * grain;
  col = mix(col, vec3(0.88, 0.86, 0.82), foam);

  float edge = 1.0 - smoothstep(0.82, 1.0, abs(vLat));
  float alpha = mix(0.86, 0.97, max(turb, foam)) * edge * smoothstep(0.0, 0.6, vDepth);

  float d = length(cameraPosition - vWorldPos);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
