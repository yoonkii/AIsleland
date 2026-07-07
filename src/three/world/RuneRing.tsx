// Diegetic XP: 12 emissive rune quads floating around the cliff base,
// filling clockwise as island.xp / xpToNextLevel (docs/GAME_DESIGN.md §8).
// One InstancedMesh + additive glyph shader; brightness per rune from uFill.

import { useLayoutEffect, useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../state/gameStore'
import { PALETTE } from '../../design/tokens'

const RUNES = 12
const RING_RADIUS = 13.85
const RING_Y = -1.15

const uniforms = {
  uTime: { value: 0 },
  uFill: { value: 0 },
  uColor: { value: new THREE.Color(PALETTE.rune) },
}

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: /* glsl */ `
    attribute float aIndex;
    varying vec2 vUv;
    varying float vIndex;
    void main() {
      vUv = uv;
      vIndex = aIndex;
      vec4 mv = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        mv = instanceMatrix * mv;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uFill;
    uniform vec3 uColor;
    varying vec2 vUv;
    varying float vIndex;
    void main() {
      vec2 p = vUv - 0.5;
      // rune glyph: diamond outline + inner spark, all SDF (no textures)
      float dia = abs(p.x) * 1.5 + abs(p.y);
      float outline = smoothstep(0.055, 0.02, abs(dia - 0.30));
      float spark = smoothstep(0.10, 0.015, length(p * vec2(1.4, 1.0)));
      float tick = smoothstep(0.03, 0.012, abs(p.x)) * smoothstep(0.46, 0.30, abs(p.y));
      float glyph = max(max(outline, spark), tick * 0.7);

      // fill clockwise: rune i fully lit once uFill*12 passes i (partial while filling)
      float lit = clamp(uFill * 12.0 - vIndex, 0.0, 1.0);
      float pulse = 0.82 + 0.18 * sin(uTime * 2.2 + vIndex * 1.9);
      float glow = mix(0.10, pulse, lit);

      float a = glyph * glow;
      if (a < 0.004) discard;
      gl_FragColor = vec4(uColor * (0.6 + 0.9 * lit), a);
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
})

const dummy = new THREE.Object3D()

function buildQuad(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(0.72, 1.0)
  const indices = new Float32Array(RUNES)
  for (let i = 0; i < RUNES; i++) indices[i] = i
  geo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(indices, 1))
  return geo
}

let quadGeo: THREE.PlaneGeometry | null = null
function runeGeometry(): THREE.PlaneGeometry {
  if (!quadGeo) quadGeo = buildQuad()
  return quadGeo
}

export function RuneRing(): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < RUNES; i++) {
      // clockwise from the 12 o'clock azimuth when viewed from above
      const a = Math.PI - (i / RUNES) * Math.PI * 2
      dummy.position.set(Math.sin(a) * RING_RADIUS, RING_Y, Math.cos(a) * RING_RADIUS)
      dummy.rotation.set(0, a, 0) // local +z faces outward
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(({ clock }) => {
    const island = useGameStore.getState().island
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uFill.value =
      island.xpToNextLevel > 0 ? Math.min(1, Math.max(0, island.xp / island.xpToNextLevel)) : 1
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[runeGeometry(), material, RUNES]}
      frustumCulled={false}
    />
  )
}
