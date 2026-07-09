// Voxel diorama island (MagicaVoxel-style reference): terraced grass-capped
// columns, a warm sand ring at the cliff edge, dithered stone strata and a
// stepped stalactite underside. Built ONCE into a single vertex-colored
// geometry (face-culled per column) and drawn with the shared meringue
// material — the voxel "pixel" shading is baked into the vertex colors.

import * as THREE from 'three'
import { PALETTE } from '../../design/tokens'
import { boundaryRadius, isWaterChannel, terrainHeight, VOXEL } from '../coords'
import { mulberry32 } from './islandGeometry'

const GRID = 26 // columns span [-GRID, GRID] in voxel units

// --- deterministic hashes ---------------------------------------------------

function hash2(ix: number, iz: number, salt = 0): number {
  let h = (ix * 374761393 + iz * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// --- palette ------------------------------------------------------------------

const GRASS_TONES = ['#8FCF86', '#98D690', '#a5de9b', '#89c981'].map((c) => new THREE.Color(c))
const STREAM_TONES = ['#8FD8DE', '#A5E4E8', '#CFF0F5'].map((c) => new THREE.Color(c))
const SAND = new THREE.Color(PALETTE.pathSand)
const SAND_DARK = new THREE.Color(PALETTE.pathPebble)
const SOIL = new THREE.Color('#9A6B4A')
const STONE_TONES = [PALETTE.cliff, PALETTE.clay, '#D8A171', '#BE805A'].map((c) => new THREE.Color(c))
const UNDER_TOP = new THREE.Color(PALETTE.dirtUnderTop)
const UNDER_BOTTOM = new THREE.Color(PALETTE.dirtUnderBottom)

// face shading baked into vertex colors (crisp voxel readability)
const SHADE_TOP = 1.0
const SHADE_X = 0.8
const SHADE_Z = 0.88
const SHADE_BOTTOM = 0.58

interface Column {
  topFace: number // world y of the walkable top face
  botFace: number // world y of the bottom face
}

const _c = new THREE.Color()

class VoxelMeshBuilder {
  positions: number[] = []
  normals: number[] = []
  colors: number[] = []

  /** Push one axis-aligned quad (two triangles). Corners in CCW order. */
  quad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    nx: number, ny: number, nz: number,
    color: THREE.Color, shade: number,
  ) {
    this.positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz)
    for (let i = 0; i < 6; i++) this.normals.push(nx, ny, nz)
    const r = color.r * shade, g = color.g * shade, b = color.b * shade
    for (let i = 0; i < 6; i++) this.colors.push(r, g, b)
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3))
    geo.computeBoundingSphere()
    return geo
  }
}

/** Column bottom (stepped stalactite underside): deepest at the center. */
function columnBottom(x: number, z: number, r: number, rb: number): number {
  const inward = Math.max(0, 1 - r / rb)
  const hang =
    Math.sin(x * 0.9 + 2.1) * Math.sin(z * 0.8 - 1.3) * 0.9 +
    Math.sin(x * 0.33 - 0.5) * Math.cos(z * 0.41 + 0.9) * 1.3
  const depth = 3.1 + Math.pow(inward, 1.2) * 6.2 + Math.max(0, hang) * (0.6 + inward) * 1.5
  return -Math.ceil(depth / VOXEL) * VOXEL
}

/** Per-voxel color for a column cell. depth = voxels below the walkable top. */
function voxelColor(ix: number, iz: number, depth: number, y: number, nearEdge: boolean, out: THREE.Color, stream = false): THREE.Color {
  if (depth === 0) {
    if (stream) return out.copy(STREAM_TONES[Math.floor(hash2(ix, iz, 5) * STREAM_TONES.length)])
    if (nearEdge) return out.copy(hash2(ix, iz, 7) < 0.35 ? SAND_DARK : SAND)
    return out.copy(GRASS_TONES[Math.floor(hash2(ix, iz, 1) * GRASS_TONES.length)])
  }
  if (depth === 1) return out.copy(SOIL).multiplyScalar(0.94 + hash2(ix, iz, 2) * 0.1)
  if (y < -4.6) {
    const t = Math.min(1, (-y - 4.6) / 3.2)
    return out.copy(UNDER_TOP).lerp(UNDER_BOTTOM, t).multiplyScalar(0.93 + hash2(ix, iz, 3 + depth) * 0.12)
  }
  // stone strata: a per-column base tone + per-voxel jitter, banded vertically
  const band = Math.abs(Math.floor(-y / (VOXEL * 2)))
  const tone = STONE_TONES[(Math.floor(hash2(ix, iz, 11) * 2) + (band % 2)) % STONE_TONES.length]
  return out.copy(tone).multiplyScalar(0.9 + hash2(ix, iz, 20 + depth) * 0.16)
}

let islandGeo: THREE.BufferGeometry | null = null

export function voxelIslandGeometry(): THREE.BufferGeometry {
  if (islandGeo) return islandGeo

  // 1) occupancy + column extents
  const cols = new Map<number, Column>()
  const key = (ix: number, iz: number) => (ix + 128) * 512 + (iz + 128)
  for (let ix = -GRID; ix <= GRID; ix++) {
    for (let iz = -GRID; iz <= GRID; iz++) {
      const x = ix * VOXEL, z = iz * VOXEL
      const r = Math.hypot(x, z)
      const rb = boundaryRadius(Math.atan2(z, x))
      if (r > rb) continue
      cols.set(key(ix, iz), { topFace: terrainHeight(x, z), botFace: columnBottom(x, z, r, rb) })
    }
  }

  // 2) emit faces
  const b = new VoxelMeshBuilder()
  const DIRS: Array<[number, number, number, number]> = [
    [1, 0, 1, 0], [-1, 0, -1, 0], [0, 1, 0, 1], [0, -1, 0, -1],
  ]

  for (const [k, col] of cols) {
    const ix = Math.floor(k / 512) - 128
    const iz = (k % 512) - 128
    const x0 = ix * VOXEL, x1 = x0 + VOXEL
    const z0 = iz * VOXEL, z1 = z0 + VOXEL

    // edge detection for the sand ring: any missing 4-neighbor
    let nearEdge = false
    for (const [dx, , dz] of DIRS) {
      if (!cols.has(key(ix + dx, iz + dz))) { nearEdge = true; break }
    }

    // top face (stream voxels tint blue along the waterfall channels)
    const cx = x0 + VOXEL / 2, cz = z0 + VOXEL / 2
    voxelColor(ix, iz, 0, col.topFace, nearEdge, _c, isWaterChannel(cx, cz))
    b.quad(x0, col.topFace, z0, x0, col.topFace, z1, x1, col.topFace, z1, x1, col.topFace, z0, 0, 1, 0, _c, SHADE_TOP)

    // bottom face
    voxelColor(ix, iz, 99, col.botFace, false, _c)
    b.quad(x0, col.botFace, z0, x1, col.botFace, z0, x1, col.botFace, z1, x0, col.botFace, z1, 0, -1, 0, _c, SHADE_BOTTOM)

    // side faces, per exposed voxel
    for (const [dx, dz, nx, nz] of DIRS) {
      const n = cols.get(key(ix + dx, iz + dz))
      const nTop = n ? n.topFace : -Infinity
      const nBot = n ? n.botFace : Infinity

      const emitRange = (fromY: number, toY: number) => {
        // spans (fromY, toY], one voxel-tall quad each
        const steps = Math.round((toY - fromY) / VOXEL)
        for (let s = 0; s < steps; s++) {
          const yTop = toY - s * VOXEL
          const yBot = yTop - VOXEL
          const depth = Math.round((col.topFace - yTop) / VOXEL)
          voxelColor(ix, iz, depth, yTop, nearEdge, _c)
          const shade = nx !== 0 ? SHADE_X : SHADE_Z
          if (nx === 1) b.quad(x1, yBot, z1, x1, yBot, z0, x1, yTop, z0, x1, yTop, z1, 1, 0, 0, _c, shade)
          else if (nx === -1) b.quad(x0, yBot, z0, x0, yBot, z1, x0, yTop, z1, x0, yTop, z0, -1, 0, 0, _c, shade)
          else if (nz === 1) b.quad(x0, yBot, z1, x1, yBot, z1, x1, yTop, z1, x0, yTop, z1, 0, 0, 1, _c, shade)
          else b.quad(x1, yBot, z0, x0, yBot, z0, x0, yTop, z0, x1, yTop, z0, 0, 0, -1, _c, shade)
        }
      }

      if (!n) {
        emitRange(col.botFace, col.topFace)
      } else {
        // upper exposure: my column rises above the neighbor's top
        if (col.topFace > nTop) emitRange(Math.max(nTop, col.botFace), col.topFace)
        // lower exposure: my column hangs below the neighbor's bottom
        if (col.botFace < nBot) emitRange(col.botFace, Math.min(nBot, col.topFace))
      }
    }
  }

  islandGeo = b.build()
  return islandGeo
}

// --- voxel rocks (orbiting chunks under the island) ---------------------------

let rockGeo: THREE.BufferGeometry | null = null

export function voxelRockGeometry(): THREE.BufferGeometry {
  if (rockGeo) return rockGeo
  const rng = mulberry32(0xbeefcafe)
  const b = new VoxelMeshBuilder()
  const cells = new Set<string>()
  // random-walk blob of ~14 cubes around the origin
  let px = 0, py = 0, pz = 0
  cells.add('0,0,0')
  for (let i = 0; i < 18; i++) {
    const d = Math.floor(rng() * 6)
    px += d === 0 ? 1 : d === 1 ? -1 : 0
    py += d === 2 ? 1 : d === 3 ? -1 : 0
    pz += d === 4 ? 1 : d === 5 ? -1 : 0
    px = Math.max(-1, Math.min(1, px)); py = Math.max(-1, Math.min(1, py)); pz = Math.max(-1, Math.min(1, pz))
    cells.add(`${px},${py},${pz}`)
  }
  const V = VOXEL * 0.9
  const has = (x: number, y: number, z: number) => cells.has(`${x},${y},${z}`)
  for (const cell of cells) {
    const [x, y, z] = cell.split(',').map(Number)
    const x0 = x * V, x1 = x0 + V, y0 = y * V, y1 = y0 + V, z0 = z * V, z1 = z0 + V
    _c.copy(STONE_TONES[Math.floor(hash2(x * 3 + y, z * 5 + y, 9) * STONE_TONES.length)]).multiplyScalar(0.92)
    if (!has(x, y + 1, z)) b.quad(x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, 0, 1, 0, _c, SHADE_TOP)
    if (!has(x, y - 1, z)) b.quad(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0, _c, SHADE_BOTTOM)
    if (!has(x + 1, y, z)) b.quad(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0, _c, SHADE_X)
    if (!has(x - 1, y, z)) b.quad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, _c, SHADE_X)
    if (!has(x, y, z + 1)) b.quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, _c, SHADE_Z)
    if (!has(x, y, z - 1)) b.quad(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1, _c, SHADE_Z)
  }
  rockGeo = b.build()
  return rockGeo
}
