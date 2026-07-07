// Procedural geometry for the gumdrop island and its furniture.
// Everything is vertex-colored so the whole island renders with ONE meringue
// material (docs/GAME_DESIGN.md §3.1). Built once, cached at module level.

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PALETTE } from '../../design/tokens'
import { ISLAND_RADIUS, terrainHeight, worldToGrid } from '../coords'

/** Deterministic RNG so the island looks identical every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

// Scratch colors reused by all builders (build-time only, but tidy).
const cA = new THREE.Color()
const cB = new THREE.Color()
const cOut = new THREE.Color()

function pushColor(arr: number[], c: THREE.Color): void {
  arr.push(c.r, c.g, c.b)
}

/** Paint an existing (non-indexed or indexed) geometry via a per-vertex callback. */
function paintVertexColors(
  geo: THREE.BufferGeometry,
  paint: (x: number, y: number, z: number, out: THREE.Color) => void,
): void {
  const pos = geo.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    paint(pos.getX(i), pos.getY(i), pos.getZ(i), cOut)
    colors[i * 3] = cOut.r
    colors[i * 3 + 1] = cOut.g
    colors[i * 3 + 2] = cOut.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

// ---------------------------------------------------------------------------
// Top plate — polar disc that follows terrainHeight() exactly
// ---------------------------------------------------------------------------

const SEG = 64 // shared angular resolution so the disc rim welds to the cliff top

function buildTopDisc(): THREE.BufferGeometry {
  const RINGS = 9
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const grass = new THREE.Color(PALETTE.grass)
  const grassHi = new THREE.Color(PALETTE.grassHi)
  const lip = new THREE.Color(PALETTE.soilLip)

  const colorAt = (x: number, z: number, r: number, out: THREE.Color): void => {
    // lighter meadow in the middle, deeper green toward the rim
    out.copy(grassHi).lerp(grass, smoothstep(3.5, 11.5, r))
    // mottled patches
    const patch = Math.sin(x * 0.9 + 2.1) * Math.sin(z * 0.8 - 1.3)
    out.lerp(grassHi, clamp01(patch) * 0.22)
    // soil lip peeking through at the very edge
    out.lerp(lip, smoothstep(12.35, 13.0, r) * 0.75)
  }

  // center vertex
  positions.push(0, terrainHeight(0, 0), 0)
  colorAt(0, 0, 0, cOut)
  pushColor(colors, cOut)

  for (let j = 1; j <= RINGS; j++) {
    const r = ISLAND_RADIUS * Math.pow(j / RINGS, 0.88)
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2
      const x = r * Math.sin(a)
      const z = r * Math.cos(a)
      positions.push(x, terrainHeight(x, z), z)
      colorAt(x, z, r, cOut)
      pushColor(colors, cOut)
    }
  }

  const idx = (j: number, i: number): number => 1 + (j - 1) * SEG + (i % SEG)
  for (let i = 0; i < SEG; i++) indices.push(0, idx(1, i), idx(1, i + 1))
  for (let j = 1; j < RINGS; j++) {
    for (let i = 0; i < SEG; i++) {
      indices.push(idx(j, i), idx(j + 1, i), idx(j + 1, i + 1))
      indices.push(idx(j, i), idx(j + 1, i + 1), idx(j, i + 1))
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals() // smooth normals for the soft meadow...
  return geo.toNonIndexed() // ...carried into the merged non-indexed island
}

// ---------------------------------------------------------------------------
// Cliff band — lathe with lip overhang + periodic value noise, chunky facets
// ---------------------------------------------------------------------------

/** Periodic-in-angle 2-octave value noise for the cliff band. */
function cliffNoise(a: number, y: number): number {
  return (
    Math.sin(a * 5 + y * 1.7 + 1.3) * 0.55 +
    Math.sin(a * 11 - y * 2.3 + 4.1) * 0.3 +
    Math.sin(a * 23 + y * 0.9 + 2.0) * 0.15
  )
}

const CLIFF_BOTTOM_Y = -2.62
const CLIFF_BOTTOM_R = 9.8

function buildCliff(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(13.0, 0),
    new THREE.Vector2(13.42, -0.16),
    new THREE.Vector2(13.7, -0.5), // lip overhang (widest point)
    new THREE.Vector2(13.5, -0.9),
    new THREE.Vector2(12.7, -1.45),
    new THREE.Vector2(11.6, -1.95),
    new THREE.Vector2(10.4, -2.3),
    new THREE.Vector2(CLIFF_BOTTOM_R, CLIFF_BOTTOM_Y),
  ]
  const lathe = new THREE.LatheGeometry(profile, SEG)
  const pos = lathe.getAttribute('position')

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const a = Math.atan2(x, z)
    const r0 = Math.hypot(x, z)
    // fade noise to zero at the grass seam and at the underside seam
    const fade = clamp01(-y / 0.45) * clamp01((y - CLIFF_BOTTOM_Y) / 0.5)
    const r = r0 + cliffNoise(a, y) * 0.45 * fade
    pos.setX(i, r * Math.sin(a))
    pos.setZ(i, r * Math.cos(a))
    if (y > -0.001) {
      // weld the top ring to the terrain rim (same angles as the disc rim)
      pos.setY(i, terrainHeight(r * Math.sin(a), r * Math.cos(a)))
    }
  }

  cA.set(PALETTE.soilLip)
  cB.set(PALETTE.cliff)
  const clay = new THREE.Color(PALETTE.clay)
  paintVertexColors(lathe, (x, y, z, out) => {
    if (y > -0.55) out.copy(cA).lerp(cB, smoothstep(-0.15, -0.55, y))
    else out.copy(cB).lerp(clay, smoothstep(-0.7, -1.7, y))
    // strata striping + painted AO toward the underside
    const band = Math.sin(Math.atan2(x, z) * 7 + y * 3.0)
    out.lerp(clay, clamp01(band) * 0.12)
    out.multiplyScalar(1 - 0.1 * smoothstep(-1.6, -2.62, y))
  })

  const faceted = lathe.toNonIndexed()
  lathe.dispose()
  faceted.deleteAttribute('uv')
  faceted.deleteAttribute('normal')
  faceted.computeVertexNormals() // flat facets on purpose
  return faceted
}

// ---------------------------------------------------------------------------
// Underside — low-poly inverted cone + dangling root cones
// ---------------------------------------------------------------------------

const CONE_TOP_Y = -2.0
const CONE_TOP_R = 10.3
const CONE_H = 7.2

function undersideNoise(x: number, y: number, z: number): number {
  return Math.sin(x * 1.35 + z * 1.6 + 0.7) * 0.5 + Math.sin(x * 0.7 - z * 1.1 + y * 0.8) * 0.5
}

function buildUnderside(): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(CONE_TOP_R, CONE_H, 9, 4, true)
  cone.rotateX(Math.PI) // apex down
  cone.translate(0, CONE_TOP_Y - CONE_H / 2, 0)

  const pos = cone.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r0 = Math.hypot(x, z)
    if (r0 < 0.05) continue // keep the apex a single point
    const keepSeam = smoothstep(CONE_TOP_Y - 0.4, CONE_TOP_Y - 1.0, y) // don't tear the tucked seam
    const r = r0 + undersideNoise(x, y, z) * 0.6 * keepSeam
    pos.setX(i, (x / r0) * r)
    pos.setZ(i, (z / r0) * r)
    pos.setY(i, y + Math.sin(x * 2.2 + z * 1.9) * 0.25 * keepSeam)
  }

  cA.set(PALETTE.dirtUnderTop)
  cB.set(PALETTE.dirtUnderBottom)
  paintVertexColors(cone, (_x, y, _z, out) => {
    out.copy(cA).lerp(cB, smoothstep(CONE_TOP_Y, CONE_TOP_Y - CONE_H, y))
  })

  const faceted = cone.toNonIndexed()
  cone.dispose()
  faceted.deleteAttribute('uv')
  faceted.deleteAttribute('normal')
  faceted.computeVertexNormals()
  return faceted
}

function buildRoots(rng: () => number): THREE.BufferGeometry[] {
  const roots: THREE.BufferGeometry[] = []
  cA.set(PALETTE.dirtUnderBottom)
  cB.set(PALETTE.trunk)
  for (let k = 0; k < 5; k++) {
    const root = new THREE.ConeGeometry(0.35, 1.8, 5, 1, false)
    root.rotateX(Math.PI) // hang tip-down
    root.rotateZ((rng() - 0.5) * 0.5)
    const rr = 2.5 + rng() * 4.0
    const ang = rng() * Math.PI * 2
    const surfaceY = CONE_TOP_Y - CONE_H * (1 - rr / CONE_TOP_R)
    root.translate(Math.sin(ang) * rr, surfaceY - 0.35, Math.cos(ang) * rr)
    paintVertexColors(root, (_x, y, _z, out) => {
      out.copy(cA).lerp(cB, clamp01((surfaceY - y) * 0.5) * 0.6)
    })
    const faceted = root.toNonIndexed()
    root.dispose()
    faceted.deleteAttribute('uv')
    faceted.deleteAttribute('normal')
    faceted.computeVertexNormals()
    roots.push(faceted)
  }
  return roots
}

// ---------------------------------------------------------------------------
// Public: merged island, rocks, clouds, grass tufts, waterfall sheet
// ---------------------------------------------------------------------------

let islandGeo: THREE.BufferGeometry | null = null

/** The whole static island (top + cliff + underside + roots) as ONE geometry. */
export function islandGeometry(): THREE.BufferGeometry {
  if (!islandGeo) {
    const rng = mulberry32(1337)
    const parts = [buildTopDisc(), buildCliff(), buildUnderside(), ...buildRoots(rng)]
    for (const p of parts) p.deleteAttribute('uv')
    islandGeo = mergeGeometries(parts, false)
    for (const p of parts) p.dispose()
    islandGeo.computeBoundingSphere()
  }
  return islandGeo
}

let rockGeo: THREE.BufferGeometry | null = null

/** Chunky icosahedron rock, vertex-colored cliff/clay. */
export function rockGeometry(): THREE.BufferGeometry {
  if (!rockGeo) {
    const geo = new THREE.IcosahedronGeometry(1, 0)
    cA.set(PALETTE.clay)
    cB.set(PALETTE.cliff)
    paintVertexColors(geo, (x, y, _z, out) => {
      out.copy(cA).lerp(cB, clamp01(y * 0.5 + 0.5))
      out.multiplyScalar(0.94 + 0.06 * Math.sin(x * 5.0))
    })
    geo.deleteAttribute('uv')
    rockGeo = geo
  }
  return rockGeo
}

let cloudGeo: THREE.BufferGeometry | null = null

/** Flat-shaded cloud blob: 3 merged icosa-d0, cream underside tint. */
export function cloudGeometry(): THREE.BufferGeometry {
  if (!cloudGeo) {
    const m = new THREE.Matrix4()
    const blob = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const g = new THREE.IcosahedronGeometry(1, 0)
      m.makeScale(sx, sy, sz).setPosition(x, y, z)
      g.applyMatrix4(m)
      return g
    }
    const parts = [
      blob(1.6, 0.62, 1.05, 0, 0, 0),
      blob(1.05, 0.5, 0.8, 1.35, -0.08, 0.3),
      blob(0.92, 0.46, 0.75, -1.25, -0.05, -0.22),
    ]
    for (const p of parts) p.deleteAttribute('uv')
    const merged = mergeGeometries(parts, false)
    for (const p of parts) p.dispose()
    cA.set('#FFFFFF')
    cB.set(PALETTE.skyDayHorizon) // #FDEBD2 underside tint per design §3.4
    paintVertexColors(merged, (_x, y, _z, out) => {
      out.copy(cA).lerp(cB, smoothstep(0.15, -0.35, y))
    })
    merged.deleteAttribute('normal')
    merged.computeVertexNormals()
    cloudGeo = merged
  }
  return cloudGeo
}

let tuftGeo: THREE.BufferGeometry | null = null

/** One grass tuft: 3 leaning blade-cones, grass -> grassHi gradient. */
export function tuftGeometry(): THREE.BufferGeometry {
  if (!tuftGeo) {
    const m = new THREE.Matrix4()
    const e = new THREE.Euler()
    const blade = (h: number, tiltX: number, tiltZ: number, x: number, z: number) => {
      const g = new THREE.ConeGeometry(0.055, h, 5, 1, false)
      g.translate(0, h / 2, 0)
      e.set(tiltX, 0, tiltZ)
      m.makeRotationFromEuler(e).setPosition(x, 0, z)
      g.applyMatrix4(m)
      return g
    }
    const parts = [
      blade(0.42, 0.14, -0.1, 0, 0),
      blade(0.32, -0.22, 0.16, 0.07, 0.05),
      blade(0.28, 0.1, 0.3, -0.07, -0.04),
    ]
    for (const p of parts) p.deleteAttribute('uv')
    const merged = mergeGeometries(parts, false)
    for (const p of parts) p.dispose()
    cA.set(PALETTE.grass)
    cB.set(PALETTE.grassHi)
    paintVertexColors(merged, (_x, y, _z, out) => {
      out.copy(cA).lerp(cB, smoothstep(0.05, 0.4, y))
      out.multiplyScalar(0.92) // reads as depth against the lighter meadow
    })
    tuftGeo = merged
  }
  return tuftGeo
}

let waterfallGeo: THREE.BufferGeometry | null = null

/**
 * Waterfall sheet: a 1.2 x 7 plane bent to a quarter-arc. Local +z points
 * away from the island; the top edge sits at local y=+0.4 tucked into the lip.
 */
export function waterfallGeometry(): THREE.BufferGeometry {
  if (!waterfallGeo) {
    const geo = new THREE.PlaneGeometry(1.45, 7, 6, 24)
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const s = (3.5 - pos.getY(i)) / 7 // 0 at top edge, 1 at bottom
      const theta = (s * Math.PI) / 2
      // Lip physics: HORIZONTAL tongue flowing out from under the grass
      // overhang (local -z is toward the island center), curving into a
      // vertical sheet. dy/dθ = 0 at the top, dz/dθ = 0 at the bottom.
      pos.setY(i, -0.12 - 6.9 * (1 - Math.cos(theta)))
      pos.setZ(i, -1.1 + 1.7 * Math.sin(theta))
      pos.setX(i, pos.getX(i) * (1 + s * 0.4)) // sheet widens as it falls
    }
    geo.deleteAttribute('normal')
    waterfallGeo = geo
  }
  return waterfallGeo
}

/**
 * Deterministic scatter positions for grass tufts: everywhere on the island
 * top EXCEPT the buildable clearing, biased toward the rim meadow.
 */
export function scatterTufts(
  count: number,
): Array<{ x: number; y: number; z: number; rot: number; scale: number }> {
  const rng = mulberry32(20260707)
  const out: Array<{ x: number; y: number; z: number; rot: number; scale: number }> = []
  let guard = 0
  while (out.length < count && guard++ < count * 30) {
    const r = Math.sqrt(rng()) * 12.1
    const a = rng() * Math.PI * 2
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (worldToGrid(x, z) !== null) continue // keep the clearing pristine
    out.push({
      x,
      y: terrainHeight(x, z) - 0.02,
      z,
      rot: rng() * Math.PI * 2,
      scale: 0.55 + rng() * 0.5,
    })
  }
  return out
}
