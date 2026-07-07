// Sky dome (3-stop OKLab-lerped gradient), sun + moon discs with halos, and
// 400 twinkle stars. All uniforms are written per-frame with zero allocation.

import { useMemo, useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { PALETTE } from '../../design/tokens'
import {
  skyTopTrack, skyMidTrack, skyHorizonTrack, sunGlowTrack,
  sunDirection, moonDirection, daylight,
} from './skyColors'
import { mulberry32 } from './islandGeometry'

const DOME_RADIUS = 92
const ORB_DISTANCE = 80

// ---------------------------------------------------------------------------
// Dome
// ---------------------------------------------------------------------------

const domeUniforms = {
  uTop: { value: new THREE.Color(PALETTE.skyDayTop) },
  uMid: { value: new THREE.Color(PALETTE.skyDayMid) },
  uHorizon: { value: new THREE.Color(PALETTE.skyDayHorizon) },
  uGlowColor: { value: new THREE.Color(PALETTE.sparkle) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uGlowAmount: { value: 0.4 },
}

const domeVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const domeFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGlowColor;
  uniform vec3 uSunDir;
  uniform float uGlowAmount;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.015, 0.30, h));
    col = mix(col, uTop, smoothstep(0.30, 0.78, h));
    // below the horizon: settle into a slightly deepened horizon color
    col = mix(col, uHorizon * 0.82, smoothstep(0.0, -0.35, h));
    // warm halo around the sun/moon position
    float glow = pow(max(dot(dir, uSunDir), 0.0), 9.0);
    col += uGlowColor * glow * uGlowAmount;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// ---------------------------------------------------------------------------
// Sun / moon discs (radial-gradient halo shader, no textures)
// ---------------------------------------------------------------------------

function makeOrbMaterial(core: string, halo: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCore: { value: new THREE.Color(core) },
      uHalo: { value: new THREE.Color(halo) },
      uOpacity: { value: 1 },
      uMoonBite: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCore;
      uniform vec3 uHalo;
      uniform float uOpacity;
      uniform float uMoonBite;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float core = smoothstep(0.34, 0.30, d);
        float halo = pow(clamp(1.0 - d, 0.0, 1.0), 2.4) * 0.55;
        // crescent bite (moon only)
        float bite = smoothstep(0.42, 0.30, length(vUv - vec2(0.62, 0.58)) * 2.0) * uMoonBite;
        core *= 1.0 - bite * 0.85;
        vec3 col = uCore * core + uHalo * halo;
        float a = clamp(core + halo, 0.0, 1.0) * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------

const STAR_COUNT = 400

function buildStarGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(STAR_COUNT * 3)
  const phases = new Float32Array(STAR_COUNT)
  const rng = mulberry32(0x5747a5)
  for (let i = 0; i < STAR_COUNT; i++) {
    // hash-scattered upper hemisphere
    const a = rng() * Math.PI * 2
    const y = 0.06 + rng() * 0.94
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    positions[i * 3] = Math.sin(a) * r * DOME_RADIUS * 0.96
    positions[i * 3 + 1] = y * DOME_RADIUS * 0.96
    positions[i * 3 + 2] = Math.cos(a) * r * DOME_RADIUS * 0.96
    phases[i] = rng() * Math.PI * 2
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  return geo
}

const starUniforms = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uPx: { value: 1 },
  uColor: { value: new THREE.Color(PALETTE.sparkle) },
}

const starMaterial = new THREE.ShaderMaterial({
  uniforms: starUniforms,
  vertexShader: /* glsl */ `
    attribute float aPhase;
    uniform float uTime;
    uniform float uPx;
    varying float vTwinkle;
    void main() {
      vTwinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aPhase * 7.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = (1.4 + 1.6 * vTwinkle) * uPx;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uNight;
    uniform vec3 uColor;
    varying float vTwinkle;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = smoothstep(1.0, 0.25, d) * vTwinkle * uNight;
      if (a < 0.004) discard;
      gl_FragColor = vec4(uColor, a);
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

// ---------------------------------------------------------------------------

const sunDirScratch = new THREE.Vector3()
const moonDirScratch = new THREE.Vector3()

const sunMat = makeOrbMaterial(PALETTE.sparkle, PALETTE.skyDuskHorizon)
const moonMat = (() => {
  const m = makeOrbMaterial('#F4F8FF', PALETTE.rimNight)
  m.uniforms.uMoonBite.value = 1
  return m
})()

export function Sky(): JSX.Element {
  const sunRef = useRef<THREE.Mesh>(null)
  const moonRef = useRef<THREE.Mesh>(null)
  const starsRef = useRef<THREE.Points>(null)

  const starGeo = useMemo(() => buildStarGeometry(), [])

  useFrame(({ clock, gl }) => {
    const t = effectiveTimeOfDay(useGameStore.getState())
    const day = daylight(t)
    const night = 1 - day

    skyTopTrack(t, domeUniforms.uTop.value)
    skyMidTrack(t, domeUniforms.uMid.value)
    skyHorizonTrack(t, domeUniforms.uHorizon.value)
    sunGlowTrack(t, domeUniforms.uGlowColor.value)

    sunDirection(t, sunDirScratch)
    moonDirection(t, moonDirScratch)
    // dome halo follows whichever orb is up
    domeUniforms.uSunDir.value.copy(day >= 0.5 ? sunDirScratch : moonDirScratch)
    domeUniforms.uGlowAmount.value = day >= 0.5 ? 0.42 * day : 0.22 * night

    const sun = sunRef.current
    if (sun) {
      sun.position.copy(sunDirScratch).multiplyScalar(ORB_DISTANCE)
      sun.lookAt(0, 0, 0)
      sunMat.uniforms.uOpacity.value = day
      sun.visible = day > 0.02
    }
    const moon = moonRef.current
    if (moon) {
      moon.position.copy(moonDirScratch).multiplyScalar(ORB_DISTANCE)
      moon.lookAt(0, 0, 0)
      moonMat.uniforms.uOpacity.value = night
      moon.visible = night > 0.02
    }

    const stars = starsRef.current
    if (stars) {
      starUniforms.uTime.value = clock.elapsedTime
      starUniforms.uNight.value = night
      starUniforms.uPx.value = gl.getPixelRatio()
      stars.visible = night > 0.02
    }
  })

  return (
    <group>
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[DOME_RADIUS, 32, 18]} />
        <shaderMaterial
          uniforms={domeUniforms}
          vertexShader={domeVert}
          fragmentShader={domeFrag}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <points ref={starsRef} geometry={starGeo} material={starMaterial} renderOrder={-9} frustumCulled={false} />

      <mesh ref={sunRef} material={sunMat} renderOrder={-8} frustumCulled={false}>
        <planeGeometry args={[17, 17]} />
      </mesh>
      <mesh ref={moonRef} material={moonMat} renderOrder={-8} frustumCulled={false}>
        <planeGeometry args={[13, 13]} />
      </mesh>
    </group>
  )
}
