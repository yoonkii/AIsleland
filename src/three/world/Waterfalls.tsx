// Twin waterfalls at 10 o'clock and 4 o'clock: quarter-arc sheets with a
// scrolling two-band stripe shader, dissolving into additive mist sprites.
// Rides the island bob (rendered inside World's island group).

import { useMemo, useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { PALETTE } from '../../design/tokens'
import { daylight } from './skyColors'
import { waterfallGeometry, mulberry32 } from './islandGeometry'
import { boundaryRadius, SURFACE_Y, VOXEL, WATERFALL_AZIMUTHS } from '../coords'

const AZIMUTHS = WATERFALL_AZIMUTHS // channels carved through the voxel rim

// --- stripe sheet -----------------------------------------------------------

const sheetUniforms = {
  uTime: { value: 0 },
  uDim: { value: 1 },
  uBase: { value: new THREE.Color(PALETTE.seaShallow) },
  uStripe: { value: new THREE.Color(PALETTE.waterfallStripe) },
}

const sheetMaterial = new THREE.ShaderMaterial({
  uniforms: sheetUniforms,
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uDim;
    uniform vec3 uBase;
    uniform vec3 uStripe;
    varying vec2 vUv;
    void main() {
      // two stripe bands scrolling downward at different rates
      float b1 = step(0.55, fract(vUv.y * 6.0 + uTime * 1.8 + sin(vUv.x * 9.0) * 0.08));
      float b2 = step(0.62, fract(vUv.y * 11.0 + uTime * 2.6 + vUv.x * 0.7));
      vec3 col = mix(uBase, uStripe, max(b1 * 0.85, b2 * 0.5)) * uDim;
      // dissolve at the bottom, soften side edges, tuck the top under the lip
      float a = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
      a *= smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
      gl_FragColor = vec4(col, a * 0.92);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
})

// --- mist sprites ------------------------------------------------------------

let mistTexture: THREE.CanvasTexture | null = null

/** Tiny procedural radial-gradient puff (no asset files). */
function getMistTexture(): THREE.CanvasTexture {
  if (!mistTexture) {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2)
      grad.addColorStop(0, 'rgba(255,255,255,0.9)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)
    }
    mistTexture = new THREE.CanvasTexture(canvas)
  }
  return mistTexture
}

interface MistSpec {
  x: number
  y: number
  z: number
  phase: number
  scale: number
}

const MIST_LOOP_S = 2.2

function Fall({ azimuth, seed }: { azimuth: number; seed: number }): JSX.Element {
  const mistRefs = useRef<Array<THREE.Sprite | null>>([])

  const { edgeR, yTop, mists, mistMats } = useMemo(() => {
    const rng = mulberry32(seed)
    // hug the voxel island's actual outline at this angle; note the boundary
    // uses atan2(z, x) while the azimuth convention is dir = (sin a, cos a)
    const edge = boundaryRadius(Math.atan2(Math.cos(azimuth), Math.sin(azimuth))) + 0.05
    // the channel floor is carved one voxel below the meadow — spill from there
    const lipY = SURFACE_Y - VOXEL - 0.02
    const specs: MistSpec[] = []
    const mats: THREE.SpriteMaterial[] = []
    for (let i = 0; i < 6; i++) {
      specs.push({
        x: (rng() - 0.5) * 1.6,
        y: -7.0 - rng() * 0.5,
        z: 2.1 + (rng() - 0.5) * 0.9,
        phase: rng(),
        scale: 0.9 + rng() * 0.5,
      })
      mats.push(
        new THREE.SpriteMaterial({
          map: getMistTexture(),
          transparent: true,
          depthWrite: false,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
        }),
      )
    }
    return { edgeR: edge, yTop: lipY, mists: specs, mistMats: mats }
  }, [azimuth, seed])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < mists.length; i++) {
      const sprite = mistRefs.current[i]
      if (!sprite) continue
      const spec = mists[i]
      const k = (t / MIST_LOOP_S + spec.phase) % 1
      const s = (0.8 + 0.6 * k) * spec.scale
      sprite.scale.set(s, s * 0.8, 1)
      sprite.position.set(spec.x, spec.y + k * 0.9, spec.z)
      const mat = sprite.material as THREE.SpriteMaterial
      mat.opacity = 0.4 * (1 - k) * Math.min(1, k * 5) * sheetUniforms.uDim.value
    }
  })

  return (
    <group
      position={[Math.sin(azimuth) * edgeR, yTop, Math.cos(azimuth) * edgeR]}
      rotation-y={azimuth}
    >
      <mesh geometry={waterfallGeometry()} material={sheetMaterial} />
      {mists.map((_, i) => (
        <sprite
          key={i}
          ref={(s) => {
            mistRefs.current[i] = s
          }}
          material={mistMats[i]}
        />
      ))}
    </group>
  )
}

export function Waterfalls(): JSX.Element {
  useFrame(({ clock }) => {
    const t = effectiveTimeOfDay(useGameStore.getState())
    sheetUniforms.uTime.value = clock.elapsedTime
    sheetUniforms.uDim.value = 0.35 + 0.65 * daylight(t)
  })
  return (
    <group>
      <Fall azimuth={AZIMUTHS[0]} seed={101} />
      <Fall azimuth={AZIMUTHS[1]} seed={202} />
    </group>
  )
}
