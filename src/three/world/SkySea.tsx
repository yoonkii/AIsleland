// The infinite sparkle sea of sky under the island (docs/GAME_DESIGN.md §3.2):
// 200x200 plane at y=-14, deep->shallow glow under the island, two scrolling
// voronoi sparkle layers (layer 2 skipped on low quality), horizon fade.

import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { PALETTE } from '../../design/tokens'
import { colorTrack } from './skyColors'

const seaDeepTrack = colorTrack([
  [0.0, '#1C3852'],
  [0.2, '#1C3852'],
  [0.27, '#3D6E93'],
  [0.38, PALETTE.seaDeep],
  [0.62, PALETTE.seaDeep],
  [0.73, '#3D6E93'],
  [0.8, '#1C3852'],
])

const seaShallowTrack = colorTrack([
  [0.0, '#2E5470'],
  [0.2, '#2E5470'],
  [0.27, '#6FA9B8'],
  [0.38, PALETTE.seaShallow],
  [0.62, PALETTE.seaShallow],
  [0.73, '#6FA9B8'],
  [0.8, '#2E5470'],
])

// fake-reflection boost near the horizon
const seaHorizonTrack = colorTrack([
  [0.0, '#31486B'],
  [0.2, '#31486B'],
  [0.27, '#E8B48F'],
  [0.38, '#C7E9F2'],
  [0.62, '#C7E9F2'],
  [0.73, '#E8B48F'],
  [0.8, '#31486B'],
])

const uniforms = {
  uTime: { value: 0 },
  uQuality: { value: 1 },
  uDeep: { value: new THREE.Color(PALETTE.seaDeep) },
  uShallow: { value: new THREE.Color(PALETTE.seaShallow) },
  uHorizon: { value: new THREE.Color('#C7E9F2') },
  uSparkle: { value: new THREE.Color('#EAFBFF') },
}

const vert = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uQuality;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHorizon;
  uniform vec3 uSparkle;
  varying vec2 vWorld;

  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }

  float voronoi(vec2 x, out float id) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float md = 8.0;
    vec2 mc = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(n + g);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < md) { md = d; mc = n + g; }
      }
    }
    id = fract(sin(dot(mc, vec2(12.9898, 78.233))) * 43758.5453);
    return sqrt(md);
  }

  void main() {
    float dist = length(vWorld);
    // lighter beneath the island: the sea glows up at it
    vec3 col = mix(uDeep, uShallow, exp(-dist * 0.04));
    col += uShallow * exp(-dist * 0.10) * 0.22;

    // sparkles fade with distance — far away they alias into "snow"
    float sparkleFade = 1.0 - smoothstep(26.0, 62.0, dist);

    // sparkle layer 1: sparse twinkle — only the brightest voronoi centers
    float id1;
    float d1 = voronoi(vWorld / 4.5 + uTime * vec2(0.03, 0.017), id1);
    float tw1 = max(0.0, sin(uTime * 1.6 + id1 * 6.2831));
    col += uSparkle * smoothstep(0.05, 0.0, d1) * tw1 * tw1 * 0.4 * sparkleFade;

    // sparkle layer 2 (skipped on low quality): broad soft shimmer patches
    if (uQuality > 0.5) {
      float id2;
      float d2 = voronoi(vWorld / 9.0 + uTime * vec2(-0.02, 0.04), id2);
      float tw2 = max(0.0, sin(uTime * 1.1 + id2 * 6.2831));
      col += uSparkle * smoothstep(0.06, 0.0, d2) * tw2 * tw2 * 0.22 * sparkleFade;
    }

    // fake reflection: brighten toward the horizon, then dissolve into the dome
    col = mix(col, uHorizon, smoothstep(48.0, 95.0, dist) * 0.6);
    float alpha = 1.0 - smoothstep(80.0, 98.0, dist);

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function SkySea(): JSX.Element {
  useFrame(({ clock }) => {
    const s = useGameStore.getState()
    const t = effectiveTimeOfDay(s)
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uQuality.value = s.quality === 'high' ? 1 : 0
    seaDeepTrack(t, uniforms.uDeep.value)
    seaShallowTrack(t, uniforms.uShallow.value)
    seaHorizonTrack(t, uniforms.uHorizon.value)
  })

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -14, 0]} renderOrder={-6} frustumCulled={false}>
      <planeGeometry args={[200, 200, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}
