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

/** Terrain height at world position — gentle rolling bumps outside the flat clearing. */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  if (r > ISLAND_RADIUS) return SURFACE_Y
  // Flat in the middle clearing, soft rise toward the rim.
  const rim = Math.max(0, (r - 7.5) / (ISLAND_RADIUS - 7.5))
  const bump =
    Math.sin(x * 0.55 + 1.3) * Math.cos(z * 0.5 - 0.7) * 0.18 +
    Math.sin(x * 0.21 - 2.0) * Math.sin(z * 0.27 + 0.5) * 0.3
  return SURFACE_Y + rim * rim * 1.1 + bump * Math.min(1, rim + 0.25)
}
