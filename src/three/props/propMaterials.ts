// Module B (props) — shared material singletons.
// One vertex-colored meringue material draws every solid prop body; two small
// emissive variants light windows and lamps after dusk. Props.tsx calls
// updatePropGlow() once per frame.

import * as THREE from 'three'
import { makeMeringue } from '../materials'
import { PALETTE } from '../../design/tokens'

/** Every solid prop mesh — hues live in the geometry's color attribute. */
export const propSolidMaterial = makeMeringue({ vertexColors: true })

/** House/windmill windows — steady warm glow after dusk. */
export const windowGlowMaterial = makeMeringue({
  vertexColors: true,
  emissive: PALETTE.lampGlow,
  emissiveIntensity: 0,
})

/** Street lamp lanterns — same glow, plus a gentle 2.4s breathing pulse. */
export const lampGlowMaterial = makeMeringue({
  vertexColors: true,
  emissive: PALETTE.lampGlow,
  emissiveIntensity: 0,
})

/** Arrange-mode ghost tints. */
export const ghostValidMaterial = makeMeringue({
  color: PALETTE.validGreen, transparent: true, opacity: 0.55,
})
export const ghostInvalidMaterial = makeMeringue({
  color: PALETTE.invalidRed, transparent: true, opacity: 0.55,
})
ghostValidMaterial.depthWrite = false
ghostInvalidMaterial.depthWrite = false

/** Arrange-mode cell highlight (color/opacity animated per frame). */
export const cellTintMaterial = new THREE.MeshBasicMaterial({
  color: PALETTE.validGreen,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  side: THREE.DoubleSide,
})

/** Invisible but raycastable island-surface plane for arrange mode. */
export const pointerPlaneMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
})

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** 0 in daylight → 1 after dusk / before dawn (lamps ignite AT dusk). */
export function nightGlowFactor(timeOfDay: number): number {
  return timeOfDay >= 0.5
    ? smooth01((timeOfDay - 0.71) / 0.05)
    : smooth01((0.29 - timeOfDay) / 0.05)
}

/** Called once per frame from the Props root — drives all emissive props. */
export function updatePropGlow(timeOfDay: number, elapsedTime: number): void {
  const glow = nightGlowFactor(timeOfDay)
  windowGlowMaterial.emissiveIntensity = glow * 1.3
  // ±10% breathing pulse over ~2.4s (design doc §4, Lv5 lamp)
  lampGlowMaterial.emissiveIntensity = glow * 1.4 * (1 + 0.1 * Math.sin(elapsedTime * (Math.PI * 2 / 2.4)))
}
