// 220 fireflies as one THREE.Points draw: per-id lissajous drift baked into
// the vertex shader, additive #D9F2A8 glow, faded in by nightness. Low
// quality halves the count via drawRange. Night only (hidden by day).

import { useEffect, useMemo, useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { PALETTE } from '../../design/tokens'
import { nightness } from './skyColors'
import { mulberry32 } from './islandGeometry'
import { terrainHeight } from '../coords'

const COUNT = 220

function buildGeometry(): THREE.BufferGeometry {
  const rng = mulberry32(0xf1ef1e)
  const positions = new Float32Array(COUNT * 3)
  const phases = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    const r = Math.sqrt(rng()) * 11.2
    const a = rng() * Math.PI * 2
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    positions[i * 3] = x
    positions[i * 3 + 1] = terrainHeight(x, z) + 0.7 + rng() * 1.9
    positions[i * 3 + 2] = z
    phases[i] = rng()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geo.computeBoundingSphere()
  return geo
}

const uniforms = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uProj: { value: 800 },
  uColor: { value: new THREE.Color(PALETTE.firefly) },
}

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: /* glsl */ `
    attribute float aPhase;
    uniform float uTime;
    uniform float uProj;
    varying float vPulse;
    void main() {
      float p = aPhase * 6.2831;
      vec3 pos = position + vec3(
        sin(uTime * 0.7 + p * 3.0) * 1.2,
        sin(uTime * 0.9 + p * 5.0) * 0.5,
        cos(uTime * 0.55 + p * 7.0) * 1.2
      );
      vPulse = 0.5 + 0.5 * sin(uTime * 3.0 + p * 11.0);
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      float size = 0.06 + 0.05 * vPulse;
      gl_PointSize = size * uProj / max(1.0, -mv.z);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uNight;
    uniform vec3 uColor;
    varying float vPulse;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = smoothstep(1.0, 0.2, d) * (0.35 + 0.65 * vPulse) * uNight;
      if (a < 0.004) discard;
      gl_FragColor = vec4(uColor, a);
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

export function Fireflies(): JSX.Element {
  const pointsRef = useRef<THREE.Points>(null)
  const quality = useGameStore((s) => s.quality)
  const geometry = useMemo(() => buildGeometry(), [])

  useEffect(() => {
    geometry.setDrawRange(0, quality === 'high' ? COUNT : COUNT / 2)
  }, [geometry, quality])

  useFrame(({ clock, gl, size, camera }) => {
    const t = effectiveTimeOfDay(useGameStore.getState())
    const night = nightness(t)
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uNight.value = night
    const cam = camera as THREE.PerspectiveCamera
    uniforms.uProj.value =
      (size.height * gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360))
    const points = pointsRef.current
    if (points) points.visible = night > 0.02
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
