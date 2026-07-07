// Module B (props) — geometry recipes for every placeable prop type.
// Recipes follow docs/GAME_DESIGN.md §4. Each type is built ONCE per
// (type, season) and cached; all hue comes from painted vertex colors so the
// shared meringue material renders each prop in a single draw call
// (plus one optional emissive "glow" mesh and one "spin" mesh for windmills).

import * as THREE from 'three'
import { PALETTE, CELEBRATION_COLORS } from '../../design/tokens'
import type { Season } from '../../state/types'
import { hash01, mergeParts } from './geometry'
import type { PartSpec } from './geometry'

const T = PALETTE

export interface PropBuild {
  /** Everything solid, vertex-colored — render with propSolidMaterial. */
  solid: THREE.BufferGeometry
  /** Emissive bits (windows / lantern) — render with a glow material. */
  glow: THREE.BufferGeometry | null
  glowKind: 'window' | 'lamp' | null
  /** Windmill blade assembly, pivot at origin, spins around local z. */
  spin: THREE.BufferGeometry | null
  spinPos: [number, number, number]
  /** Idle sway amplitude in radians (0 = rigid). */
  swayAmp: number
  swayFreq: number
}

export const PROP_INFO: Record<string, { label: string; footprint: number }> = {
  'flower-1': { label: 'Rosy Bloom', footprint: 1 },
  'flower-2': { label: 'Petal Puff', footprint: 1 },
  'flower-3': { label: 'Sunny Bud', footprint: 1 },
  'tree-1': { label: 'Puffball Tree', footprint: 1 },
  'tree-2': { label: 'Cone Pine', footprint: 1 },
  'tree-3': { label: 'Blossom Tree', footprint: 1 },
  'tree-4': { label: 'Grand Canopy', footprint: 1 },
  road: { label: 'Stepping Stones', footprint: 1 },
  'small-house': { label: 'Cozy Cottage', footprint: 1 },
  'stall-1': { label: 'Market Stall', footprint: 1 },
  'street-light-1': { label: 'Street Lamp', footprint: 1 },
  'water-kattle-1': { label: 'Watering Can', footprint: 1 },
  'windmill-1': { label: 'Coral Windmill', footprint: 1 },
  'windmill-2': { label: 'Bluebell Windmill', footprint: 1 },
  'windmill-3': { label: 'Meadow Windmill', footprint: 1 },
  'fruit-baskets': { label: 'Fruit Baskets', footprint: 1 },
  'big-house': { label: 'Manor House', footprint: 2 },
  lumber: { label: 'Lumber Pile', footprint: 1 },
  'signpost-1': { label: 'Signpost', footprint: 1 },
  'pumpkin-farm': { label: 'Pumpkin Patch', footprint: 2 },
  gift: { label: 'Mystery Gift', footprint: 1 },
}

/** Types that read fine at any yaw; buildings only get a subtle twist. */
const FREE_SPIN = new Set([
  'flower-1', 'flower-2', 'flower-3', 'tree-1', 'tree-2', 'tree-3', 'tree-4',
  'road', 'lumber', 'pumpkin-farm', 'fruit-baskets', 'water-kattle-1', 'gift',
])

export interface PropJitter { dx: number; dz: number; rot: number; phase: number }

/** Deterministic per-asset jitter (freeform look on the legacy grid). */
export function jitterFor(id: string, type = ''): PropJitter {
  const free = FREE_SPIN.has(type)
  const spread = free ? 0.7 : 0.4
  return {
    dx: (hash01(id, 1) - 0.5) * spread,
    dz: (hash01(id, 2) - 0.5) * spread,
    rot: free ? hash01(id, 3) * Math.PI * 2 : (hash01(id, 3) - 0.5) * 0.7,
    phase: hash01(id, 4) * Math.PI * 2,
  }
}

// ---------------------------------------------------------------------------
// Primitive shorthands (build-time only)
// ---------------------------------------------------------------------------

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg)
const sph = (r: number, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h)
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0)
const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg)
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 3, 8)

/** Box whose top face is pinched in — the chamfered "gingerbread" wall look. */
function chamferBox(w: number, h: number, d: number, inset = 0.08): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * (1 - inset))
      pos.setZ(i, pos.getZ(i) * (1 - inset))
    }
  }
  g.computeVertexNormals()
  return g
}

/** 4-sided roof pyramid pre-rotated 45° so world-space scaling stays square. */
function pyramid(r: number, h: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, 4)
  g.rotateY(Math.PI / 4)
  return g
}

/** Log cylinder pre-rotated to lie along the x axis. */
function logAlongX(r: number, len: number, seg = 7): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg)
  g.rotateZ(Math.PI / 2)
  return g
}

// ---------------------------------------------------------------------------
// Seasonal canopy palette
// ---------------------------------------------------------------------------

function shade(hex: string, k: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(k)
}

function canopyColors(season: Season, variant: number): { lo: THREE.ColorRepresentation; hi: THREE.ColorRepresentation } {
  switch (season) {
    case 'spring':
      return { lo: T.canopySummerInner, hi: T.canopySpring }
    case 'summer':
      return { lo: T.canopySummerInner, hi: T.canopySummer }
    case 'autumn': {
      const c = [T.canopyAutumnA, T.canopyAutumnB, T.canopyAutumnC][variant % 3]
      return { lo: shade(c, 0.72), hi: c }
    }
    case 'winter':
      return { lo: shade(T.canopyWinter, 0.86), hi: T.snow }
  }
}

// ---------------------------------------------------------------------------
// Recipe fragments
// ---------------------------------------------------------------------------

function flowerParts(petal: string, budColor: string): PartSpec[] {
  const parts: PartSpec[] = [
    // main stem + leaves
    { geo: cyl(0.025, 0.038, 0.4, 5), color: T.canopySummerInner, position: [0, 0.2, 0] },
    { geo: sph(0.1, 7, 5), color: T.canopySummer, colorTop: T.canopySpring, position: [0.1, 0.13, 0.02], rotation: [0, 0, -0.6], scale: [1, 0.32, 0.55] },
    { geo: sph(0.09, 7, 5), color: T.canopySummer, colorTop: T.canopySpring, position: [-0.09, 0.09, -0.03], rotation: [0, 0.9, 0.55], scale: [1, 0.32, 0.55] },
    // face — golden heart
    { geo: sph(0.075, 8, 6), color: '#FFD966', position: [0, 0.44, 0] },
  ]
  // 5 squashed petal spheres tilted gently outward
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    parts.push({
      geo: sph(0.095, 7, 5),
      color: shade(petal, 0.88),
      colorTop: petal,
      position: [Math.cos(a) * 0.115, 0.445, Math.sin(a) * 0.115],
      rotation: [0.42 * Math.sin(a), 0, -0.42 * Math.cos(a)],
      scale: [1, 0.45, 1],
    })
  }
  // little side bud on a leaning stem
  parts.push(
    { geo: cyl(0.018, 0.026, 0.26, 5), color: T.canopySummerInner, position: [0.16, 0.12, -0.09], rotation: [0.12, 0, -0.35] },
    { geo: sph(0.055, 7, 5), color: budColor, colorTop: '#FFD966', position: [0.2, 0.26, -0.1] },
  )
  return parts
}

function puffballCanopy(season: Season, variant: number, seed: number): PartSpec[] {
  const c = canopyColors(season, variant)
  return [
    { geo: ico(0.9), color: c.lo, colorTop: c.hi, position: [0.1, 1.55, -0.06], scale: [1, 0.8, 1], blob: 0.14, seed },
    { geo: ico(0.7), color: c.lo, colorTop: c.hi, position: [-0.14, 2.1, 0.12], scale: [1, 0.8, 1], blob: 0.12, seed: seed + 1 },
    { geo: ico(0.55), color: c.lo, colorTop: c.hi, position: [0.05, 2.6, 0.02], scale: [1, 0.82, 1], blob: 0.1, seed: seed + 2 },
  ]
}

function housePartsAt(
  parts: PartSpec[], glow: PartSpec[],
  x: number, scale: number, roof: string,
): void {
  const s = scale
  parts.push(
    { geo: chamferBox(1.15 * s, 0.85 * s, 0.95 * s), color: shade(T.wallCream, 0.94), colorTop: T.wallCream, position: [x, 0.425 * s, 0] },
    { geo: pyramid(0.95 * s, 0.9 * s), color: roof, colorTop: shade(roof, 1.12), position: [x, (0.85 + 0.31) * s, 0], scale: [1.15, 0.7, 1.15] },
    { geo: capsule(0.13 * s, 0.2 * s), color: T.trunk, position: [x, 0.28 * s, 0.47 * s], scale: [1, 1, 0.35] },
    { geo: box(0.16 * s, 0.4 * s, 0.16 * s), color: T.cliff, colorTop: T.pathSand, position: [x + 0.34 * s, 1.02 * s, 0.16 * s] },
  )
  glow.push(
    { geo: box(0.16 * s, 0.2 * s, 0.05 * s), color: T.lampGlow, position: [x - 0.3 * s, 0.5 * s, 0.46 * s] },
    { geo: box(0.16 * s, 0.2 * s, 0.05 * s), color: T.lampGlow, position: [x + 0.3 * s, 0.5 * s, 0.46 * s] },
  )
}

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

function buildProp(type: string, season: Season): PropBuild {
  const parts: PartSpec[] = []
  const glow: PartSpec[] = []
  const spin: PartSpec[] = []
  let glowKind: 'window' | 'lamp' | null = null
  let spinPos: [number, number, number] = [0, 0, 0]
  let swayAmp = 0
  let swayFreq = 1.3

  switch (type) {
    // --- flowers -----------------------------------------------------------
    case 'flower-1':
      parts.push(...flowerParts('#F49FB6', '#FFD1DC'))
      swayAmp = 0.1
      swayFreq = 1.6
      break
    case 'flower-2':
      parts.push(...flowerParts('#C9A8E8', '#F49FB6'))
      swayAmp = 0.1
      swayFreq = 1.45
      break
    case 'flower-3':
      parts.push(...flowerParts('#FFE08A', '#F49FB6'))
      swayAmp = 0.1
      swayFreq = 1.75
      break

    // --- trees -------------------------------------------------------------
    case 'tree-1': { // puffball
      parts.push({ geo: cyl(0.12, 0.2, 1.2, 6), color: shade(T.trunk, 0.82), colorTop: T.trunk, position: [0, 0.6, 0] })
      parts.push(...puffballCanopy(season, 0, 11))
      swayAmp = 0.035
      swayFreq = 0.9
      break
    }
    case 'tree-2': { // pine
      const c = season === 'winter'
        ? { lo: T.canopySummerInner, hi: T.canopyWinter }
        : { lo: T.canopySummerInner, hi: T.canopySummer }
      parts.push(
        { geo: cyl(0.1, 0.17, 0.55, 6), color: shade(T.trunk, 0.82), colorTop: T.trunk, position: [0, 0.275, 0] },
        { geo: cone(0.9, 0.95, 7), color: c.lo, colorTop: c.hi, position: [0, 0.82, 0], blob: 0.07, seed: 21 },
        { geo: cone(0.65, 0.9, 7), color: c.lo, colorTop: c.hi, position: [0, 1.45, 0], blob: 0.06, seed: 22 },
        { geo: cone(0.4, 0.85, 7), color: c.lo, colorTop: c.hi, position: [0, 2.05, 0], blob: 0.05, seed: 23 },
      )
      if (season === 'winter') parts.push({ geo: ico(0.16), color: T.snow, position: [0, 2.5, 0], scale: [1, 0.7, 1] })
      swayAmp = 0.028
      swayFreq = 1.0
      break
    }
    case 'tree-3': { // blossom
      parts.push({ geo: cyl(0.11, 0.19, 1.1, 6), color: shade(T.trunk, 0.82), colorTop: T.trunk, position: [0, 0.55, 0] })
      const spring: Season = season === 'autumn' ? 'autumn' : 'spring'
      parts.push(...puffballCanopy(spring, 2, 31))
      const stud = season === 'winter' ? T.snow : T.blossom
      const studAt: Array<[number, number, number]> = [
        [0.75, 1.7, 0.35], [-0.6, 1.95, -0.4], [0.3, 2.55, 0.42], [-0.35, 2.85, 0.05], [0.55, 2.3, -0.5],
      ]
      for (let i = 0; i < studAt.length; i++) {
        parts.push({ geo: ico(0.17), color: shade(stud as string, 0.92), colorTop: stud, position: studAt[i], blob: 0.05, seed: 40 + i })
      }
      swayAmp = 0.045
      swayFreq = 1.1
      break
    }
    case 'tree-4': { // grand two-lobe canopy
      const c = canopyColors(season, 1)
      parts.push(
        { geo: cyl(0.14, 0.22, 1.6, 6), color: shade(T.trunk, 0.82), colorTop: T.trunk, position: [0, 0.8, 0] },
        { geo: cyl(0.07, 0.1, 0.7, 5), color: T.trunk, position: [0.35, 1.5, 0.1], rotation: [0, 0, -0.7] },
        { geo: ico(1.05), color: c.lo, colorTop: c.hi, position: [-0.1, 2.35, 0], scale: [1, 0.85, 1], blob: 0.16, seed: 51 },
        { geo: ico(0.5), color: c.lo, colorTop: c.hi, position: [0.85, 1.95, 0.2], blob: 0.1, seed: 52 },
      )
      swayAmp = 0.03
      swayFreq = 0.85
      break
    }

    // --- ground / path -----------------------------------------------------
    case 'road': {
      const stones: Array<[number, number, number, number]> = [
        [-0.55, -0.42, 0.38, 0.3], [0.05, 0.08, 0.42, 1.4], [0.62, 0.5, 0.34, 2.4],
      ]
      for (let i = 0; i < stones.length; i++) {
        const [x, z, r, ry] = stones[i]
        parts.push({
          geo: cyl(r, r * 1.12, 0.09, 6), color: T.pathPebble, colorTop: T.pathSand,
          position: [x, 0.045, z], rotation: [0, ry, 0], blob: 0.03, seed: 60 + i,
        })
      }
      const pebbles: Array<[number, number]> = [[-0.2, -0.6], [0.42, -0.1], [-0.75, 0.05], [0.25, 0.75]]
      for (let i = 0; i < pebbles.length; i++) {
        parts.push({ geo: ico(0.06), color: T.pathPebble, colorTop: T.pathSand, position: [pebbles[i][0], 0.05, pebbles[i][1]], seed: 70 + i })
      }
      break
    }

    // --- buildings ---------------------------------------------------------
    case 'small-house':
      housePartsAt(parts, glow, 0, 1, T.roofCoral)
      glowKind = 'window'
      break

    case 'big-house': {
      housePartsAt(parts, glow, -0.3, 1.45, T.roofCoral)
      // side wing with its own blue gable
      parts.push(
        { geo: chamferBox(0.95, 0.8, 0.9, 0.06), color: shade(T.wallCream, 0.94), colorTop: T.wallCream, position: [0.85, 0.4, 0.12] },
        { geo: pyramid(0.78, 0.62), color: T.roofBlue, colorTop: shade(T.roofBlue, 1.12), position: [0.85, 1.01, 0.12], scale: [1.15, 0.7, 1.15] },
      )
      glow.push({ geo: box(0.15, 0.19, 0.05), color: T.lampGlow, position: [0.85, 0.46, 0.56] })
      glowKind = 'window'
      break
    }

    case 'stall-1': {
      parts.push(
        { geo: chamferBox(1.25, 0.55, 0.75, 0.05), color: shade(T.wallCream, 0.94), colorTop: T.wallCream, position: [0, 0.275, 0] },
        { geo: box(1.38, 0.06, 0.88), color: T.soilLip, colorTop: T.pathSand, position: [0, 0.58, 0] },
      )
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        parts.push({ geo: cyl(0.045, 0.045, 1.3, 6), color: T.trunk, position: [sx * 0.6, 0.65, sz * 0.34] })
      }
      // striped awning
      for (let i = 0; i < 6; i++) {
        parts.push({
          geo: box(0.235, 0.045, 1.0),
          color: i % 2 === 0 ? T.roofCoral : T.wallCream,
          colorTop: i % 2 === 0 ? shade(T.roofCoral, 1.12) : T.snow,
          position: [-0.585 + i * 0.234, 1.36, 0.12],
          rotation: [-0.42, 0, 0],
        })
      }
      // produce on the counter + a crate
      parts.push(
        { geo: sph(0.075, 7, 5), color: T.roofCoral, position: [-0.32, 0.67, 0.08] },
        { geo: sph(0.07, 7, 5), color: T.canopyAutumnA, position: [-0.18, 0.665, -0.12] },
        { geo: sph(0.07, 7, 5), color: T.accentGreen, position: [-0.4, 0.66, -0.14] },
        { geo: box(0.32, 0.3, 0.32), color: T.pathPebble, colorTop: T.pathSand, position: [0.52, 0.15, 0.58], rotation: [0, 0.4, 0] },
      )
      break
    }

    case 'street-light-1':
      parts.push(
        { geo: cyl(0.15, 0.2, 0.09, 8), color: T.pathPebble, position: [0, 0.045, 0] },
        { geo: cyl(0.038, 0.052, 1.5, 6), color: shade(T.trunk, 0.8), colorTop: T.trunk, position: [0, 0.83, 0] },
        { geo: cone(0.16, 0.16, 6), color: shade(T.trunk, 0.8), position: [0, 1.75, 0] },
      )
      glow.push({ geo: ico(0.135), color: T.lampGlow, position: [0, 1.6, 0] })
      glowKind = 'lamp'
      break

    case 'water-kattle-1':
      parts.push(
        { geo: cyl(0.26, 0.31, 0.42, 10), color: shade(T.roofBlue, 0.92), colorTop: T.skyDayMid, position: [0, 0.21, 0] },
        { geo: cyl(0.05, 0.075, 0.55, 6), color: T.roofBlue, position: [0.36, 0.32, 0], rotation: [0, 0, -0.85] },
        { geo: cone(0.09, 0.07, 8), color: T.skyDayMid, position: [0.56, 0.47, 0], rotation: [0, 0, -0.85] },
        { geo: new THREE.TorusGeometry(0.17, 0.032, 6, 12, Math.PI), color: T.roofBlue, position: [-0.24, 0.34, 0], rotation: [0, 0, -0.3] },
        { geo: sph(0.05, 6, 5), color: T.skyDayMid, position: [0, 0.44, 0] },
      )
      break

    case 'windmill-1':
    case 'windmill-2':
    case 'windmill-3': {
      const accent = type === 'windmill-1' ? T.roofCoral : type === 'windmill-2' ? T.roofBlue : T.accentGreen
      const profile: THREE.Vector2[] = [
        new THREE.Vector2(0.02, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0.63, 0.35),
        new THREE.Vector2(0.66, 0.8), new THREE.Vector2(0.58, 1.25), new THREE.Vector2(0.47, 1.65),
        new THREE.Vector2(0.36, 1.95), new THREE.Vector2(0.3, 2.08), new THREE.Vector2(0.02, 2.12),
      ]
      parts.push(
        { geo: new THREE.LatheGeometry(profile, 10), color: shade(T.wallCream, 0.92), colorTop: T.wallCream, position: [0, 0, 0] },
        { geo: cone(0.42, 0.52, 10), color: accent, colorTop: shade(accent, 1.12), position: [0, 2.3, 0] },
        { geo: capsule(0.11, 0.16), color: T.trunk, position: [0, 0.26, 0.57], scale: [1, 1, 0.4] },
      )
      glow.push({ geo: box(0.15, 0.2, 0.07), color: T.lampGlow, position: [0, 1.25, 0.53] })
      glowKind = 'window'
      // blade assembly (separate mesh so it can rotate) — pivot at origin
      spin.push({ geo: sph(0.11, 8, 6), color: T.trunk, position: [0, 0, 0.03] })
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2
        spin.push(
          { geo: box(0.74, 0.15, 0.05), color: shade(T.wallCream, 0.96), colorTop: T.wallCream, position: [Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0], rotation: [0, 0, a] },
          { geo: box(0.34, 0.2, 0.06), color: accent, colorTop: shade(accent, 1.12), position: [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0], rotation: [0, 0, a] },
        )
      }
      spinPos = [0, 1.82, 0.5]
      break
    }

    case 'fruit-baskets': {
      parts.push(
        { geo: cyl(0.31, 0.24, 0.3, 9), color: shade(T.trunk, 0.9), colorTop: T.soilLip, position: [-0.26, 0.15, -0.02] },
        { geo: cyl(0.23, 0.18, 0.24, 9), color: shade(T.trunk, 0.9), colorTop: T.soilLip, position: [0.3, 0.12, 0.16], rotation: [0, 0.8, 0] },
      )
      const apples: Array<[number, number, number]> = [[-0.34, 0.33, -0.08], [-0.18, 0.34, 0.05], [-0.3, 0.36, 0.09], [-0.16, 0.32, -0.11]]
      for (const p of apples) parts.push({ geo: sph(0.085, 7, 5), color: shade(T.roofCoral, 0.94), colorTop: T.roofCoral, position: p })
      const oranges: Array<[number, number, number]> = [[0.24, 0.27, 0.1], [0.37, 0.27, 0.2], [0.3, 0.31, 0.24]]
      for (const p of oranges) parts.push({ geo: sph(0.075, 7, 5), color: shade(T.canopyAutumnA, 0.94), colorTop: T.canopyAutumnA, position: p })
      // one runaway apple in the grass
      parts.push({ geo: sph(0.08, 7, 5), color: T.roofCoral, position: [0.05, 0.08, -0.42] })
      break
    }

    case 'lumber': {
      const rows: Array<[number, number, number]> = [
        [-0.34, 0.16, 0], [0, 0.16, 0], [0.34, 0.16, 0], [-0.17, 0.44, 0], [0.17, 0.44, 0],
      ]
      for (let i = 0; i < rows.length; i++) {
        const [z, y] = [rows[i][0], rows[i][1]]
        parts.push({ geo: logAlongX(0.16, 0.95), color: shade(T.trunk, 0.85), colorTop: T.trunk, position: [0, y, z] })
        // pale cut ends
        parts.push(
          { geo: logAlongX(0.135, 0.03, 9), color: T.pathSand, colorTop: T.pathSand, position: [0.48, y, z] },
          { geo: logAlongX(0.135, 0.03, 9), color: T.pathSand, colorTop: T.pathSand, position: [-0.48, y, z] },
        )
      }
      break
    }

    case 'signpost-1':
      parts.push(
        { geo: cyl(0.05, 0.062, 1.35, 6), color: shade(T.trunk, 0.82), colorTop: T.trunk, position: [0, 0.675, 0] },
        { geo: sph(0.06, 6, 5), color: T.trunk, position: [0, 1.38, 0] },
        { geo: box(0.72, 0.2, 0.05), color: T.pathPebble, colorTop: T.pathSand, position: [0.3, 1.12, 0], rotation: [0, 0.18, 0] },
        { geo: pyramid(0.145, 0.14), color: T.pathPebble, colorTop: T.pathSand, position: [0.72, 1.12, 0], rotation: [1.5708, 0.18, 1.5708] },
        { geo: box(0.6, 0.18, 0.05), color: T.pathPebble, colorTop: T.pathSand, position: [-0.25, 0.84, 0.04], rotation: [0, -0.35, 0] },
      )
      break

    case 'pumpkin-farm': {
      parts.push({ geo: chamferBox(1.7, 0.12, 1.25, 0.12), color: T.dirtUnderTop, colorTop: T.clay, position: [0, 0.06, 0] })
      const pumpkins: Array<[number, number, number, number]> = [
        [-0.45, -0.25, 0.3, 71], [0.35, 0.3, 0.24, 72], [0.42, -0.33, 0.19, 73],
      ]
      for (const [x, z, r, seed] of pumpkins) {
        parts.push(
          { geo: sph(r, 10, 7), color: shade(T.canopyAutumnB, 0.9), colorTop: T.canopyAutumnA, position: [x, 0.1 + r * 0.7, z], scale: [1, 0.72, 1], blob: r * 0.12, seed },
          { geo: cyl(0.028, 0.042, 0.12, 5), color: T.canopySummerInner, position: [x, 0.12 + r * 1.42 * 0.72, z], rotation: [0, 0, 0.2] },
        )
      }
      parts.push(
        { geo: sph(0.13, 7, 5), color: T.canopySummerInner, colorTop: T.canopySummer, position: [-0.05, 0.14, 0.18], scale: [1, 0.25, 0.7], rotation: [0, 0.6, 0] },
        { geo: sph(0.11, 7, 5), color: T.canopySummerInner, colorTop: T.canopySummer, position: [-0.15, 0.13, -0.4], scale: [1, 0.25, 0.7], rotation: [0, -0.8, 0] },
      )
      swayAmp = 0.012
      swayFreq = 1.2
      break
    }

    // --- fallback: a cute gift box ------------------------------------------
    default: {
      const body = CELEBRATION_COLORS[3] // soft blue
      parts.push(
        { geo: chamferBox(0.55, 0.45, 0.55, 0.05), color: shade(body, 0.92), colorTop: body, position: [0, 0.225, 0] },
        { geo: box(0.57, 0.46, 0.13), color: T.heart, position: [0, 0.23, 0] },
        { geo: box(0.13, 0.46, 0.57), color: T.heart, position: [0, 0.23, 0] },
        { geo: sph(0.095, 7, 5), color: T.heart, position: [-0.085, 0.5, 0], rotation: [0, 0, 0.55], scale: [1, 0.6, 0.7] },
        { geo: sph(0.095, 7, 5), color: T.heart, position: [0.085, 0.5, 0], rotation: [0, 0, -0.55], scale: [1, 0.6, 0.7] },
        { geo: sph(0.055, 6, 5), color: shade(T.heart, 0.85), position: [0, 0.49, 0] },
      )
      break
    }
  }

  return {
    solid: mergeParts(parts),
    glow: glow.length > 0 ? mergeParts(glow) : null,
    glowKind: glow.length > 0 ? glowKind : null,
    spin: spin.length > 0 ? mergeParts(spin) : null,
    spinPos,
    swayAmp,
    swayFreq,
  }
}

// ---------------------------------------------------------------------------
// Cache — geometry is built once per (type, season) and shared by every mesh.
// ---------------------------------------------------------------------------

const buildCache = new Map<string, PropBuild>()

const SEASONAL = new Set(['tree-1', 'tree-2', 'tree-3', 'tree-4'])

export function getPropBuild(type: string, season: Season): PropBuild {
  const known = type in PROP_INFO ? type : 'gift'
  const key = SEASONAL.has(known) ? `${known}|${season}` : known
  let build = buildCache.get(key)
  if (!build) {
    build = buildProp(known, season)
    buildCache.set(key, build)
  }
  return build
}
