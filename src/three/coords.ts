// Island coordinate system shared by every 3D module.
//
// World units: 1 unit ~= 1 meter. Island is a floating disc centered at origin.
// The buildable clearing is the legacy 8x7 grid mapped onto the top surface.

export const ISLAND_RADIUS = 13
/** Height of the island's top surface (grass plateau) at the center. */
export const SURFACE_Y = 0

export const GRID_COLS = 8
export const GRID_ROWS = 7
/** World size of one grid cell. */
export const CELL = 2.2

/** Convert a grid cell (col 0..7, row 0..6) to world [x, z] at the cell center. */
export function gridToWorld(col: number, row: number): [number, number] {
  const x = (col - (GRID_COLS - 1) / 2) * CELL
  const z = (row - (GRID_ROWS - 1) / 2) * CELL
  return [x, z]
}

/** Inverse of gridToWorld, clamped to the grid. Returns null outside the clearing. */
export function worldToGrid(x: number, z: number): { col: number; row: number } | null {
  const col = Math.round(x / CELL + (GRID_COLS - 1) / 2)
  const row = Math.round(z / CELL + (GRID_ROWS - 1) / 2)
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null
  if (!isInClearing(col, row)) return null
  return { col, row }
}

/** Matches the oval clearing used by the Cloud Function that auto-places rewards. */
export function isInClearing(col: number, row: number): boolean {
  const cx = 3.5, cy = 3
  const dx = (col - cx) / 4
  const dy = (row - cy) / 3.5
  return dx * dx + dy * dy <= 1.0
}

/** Voxel edge length — the island is built from cubes of this size. */
export const VOXEL = 0.55

/** Organic island boundary radius at a given angle (voxel diorama outline). */
export function boundaryRadius(theta: number): number {
  return ISLAND_RADIUS + Math.sin(theta * 3 + 1.7) * 0.5 + Math.sin(theta * 7 + 0.4) * 0.3
}

/**
 * Waterfall channel directions ("azimuth" convention: direction = (sin a, cos a)).
 * The rim terraces are carved flat along these bearings so water can spill
 * from the clearing over the cliff edge.
 */
export const WATERFALL_AZIMUTHS = [2.62, 2.62 + Math.PI] as const

export function isWaterChannel(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  if (r < 6) return false
  for (let i = 0; i < WATERFALL_AZIMUTHS.length; i++) {
    const a = WATERFALL_AZIMUTHS[i]
    const c = (x * Math.sin(a) + z * Math.cos(a)) / r
    if (c > 0.994) return true
    // spring pond: the first channel widens into a small pool at its source
    if (i === 0 && r < 8.1 && c > 0.962) return true
  }
  return false
}

/** Smooth pre-quantization height: flat clearing, terraced meadow rise at the rim. */
function smoothHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  if (isWaterChannel(x, z)) return 0
  const t = Math.min(1, Math.max(0, (r - 8.4) / (12.4 - 8.4)))
  const rim = t * t * (3 - 2 * t)
  const bump =
    Math.sin(x * 0.55 + 1.3) * Math.cos(z * 0.5 - 0.7) * 0.5 +
    Math.sin(x * 0.21 - 2.0) * Math.sin(z * 0.27 + 0.5) * 0.7
  return rim * (1.4 + Math.max(0, bump) * 0.9)
}

/**
 * Terrain height at world position — quantized to whole voxels so props and
 * critters stand exactly on the terraced voxel surface.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  if (r > ISLAND_RADIUS + 1.2) return SURFACE_Y
  // the stream bed is recessed one voxel below the meadow (grass banks)
  if (isWaterChannel(x, z)) return SURFACE_Y - VOXEL
  return SURFACE_Y + Math.floor(Math.max(0, smoothHeight(x, z)) / VOXEL) * VOXEL
}
