// The "meringue" material — one shared toon look for everything solid in the
// world (docs/GAME_DESIGN.md §2): 3-band toon ramp + warm fresnel rim + subtle
// curved-world vertex bend. All modules create materials ONLY through here so
// the island reads as one substance.

import * as THREE from 'three'
import { PALETTE } from '../design/tokens'

// --- 3-band toon ramp (0.55 / 0.78 / 1.0) ---
let ramp: THREE.DataTexture | null = null
export function toonRamp(): THREE.DataTexture {
  if (!ramp) {
    const data = new Uint8Array([140, 140, 140, 255, 199, 199, 199, 255, 255, 255, 255, 255])
    ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
    ramp.minFilter = THREE.NearestFilter
    ramp.magFilter = THREE.NearestFilter
    ramp.generateMipmaps = false
    ramp.needsUpdate = true
  }
  return ramp
}

// --- Shared uniforms (world updates these once per frame) ---
export const globalUniforms = {
  uRimColor: { value: new THREE.Color(PALETTE.rimDay) },
  uRimStrength: { value: 0.35 },
  uCurve: { value: 0.004 },
  uCamPivot: { value: new THREE.Vector3(0, 0, 0) },
}

const rimDay = new THREE.Color(PALETTE.rimDay)
const rimNight = new THREE.Color(PALETTE.rimNight)

/** Call once per frame (module A does this): keeps rim color/curve pivot in sync. */
export function updateGlobalUniforms(camPivot: THREE.Vector3, timeOfDay: number): void {
  globalUniforms.uCamPivot.value.copy(camPivot)
  // nightness: 1 at midnight, 0 during the day
  const night = Math.max(0, Math.cos(timeOfDay * Math.PI * 2)) // t=0 midnight → 1
  globalUniforms.uRimColor.value.copy(rimDay).lerp(rimNight, night)
}

export interface MeringueOptions {
  color?: THREE.ColorRepresentation
  vertexColors?: boolean
  emissive?: THREE.ColorRepresentation
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  /** Set false for things that must not bend (sky-attached quads etc.). */
  curved?: boolean
}

/**
 * Create a meringue MeshToonMaterial. Reuse instances wherever possible
 * (module-level singletons) — every unique material is a program switch.
 */
export function makeMeringue(opts: MeringueOptions = {}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: opts.color ?? '#ffffff',
    gradientMap: toonRamp(),
    vertexColors: opts.vertexColors ?? false,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  })
  const curved = opts.curved ?? true

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = globalUniforms.uRimColor
    shader.uniforms.uRimStrength = globalUniforms.uRimStrength
    shader.uniforms.uCurve = curved ? globalUniforms.uCurve : { value: 0 }
    shader.uniforms.uCamPivot = globalUniforms.uCamPivot

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uCurve;
         uniform vec3 uCamPivot;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
         #ifdef USE_INSTANCING
           mvPosition = instanceMatrix * mvPosition;
         #endif
         vec4 aisleWorld = modelMatrix * mvPosition;
         float aisleDist = length(aisleWorld.xz - uCamPivot.xz);
         aisleWorld.y -= aisleDist * aisleDist * uCurve;
         mvPosition = viewMatrix * aisleWorld;
         gl_Position = projectionMatrix * mvPosition;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uRimColor;
         uniform float uRimStrength;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float aisleRim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.0) * uRimStrength;
         outgoingLight += uRimColor * aisleRim;
         #include <opaque_fragment>`,
      )
  }
  mat.customProgramCacheKey = () => `meringue-${curved ? 'c' : 'f'}`
  return mat
}
