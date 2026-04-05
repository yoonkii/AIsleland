// Isometric grid system for the island clearing
// Map.png is 1024x1024 with a clearing in the center (~480x300 usable area)
// Grid positions map to pixel coordinates on the map

export interface GridCell {
  col: number
  row: number
  x: number  // pixel x on the map (center of cell)
  y: number  // pixel y on the map (center of cell)
  occupied: boolean
}

// The clearing area on map.png, roughly centered
const GRID_ORIGIN_X = 180  // left edge of clearing
const GRID_ORIGIN_Y = 200  // top edge of clearing
const CELL_WIDTH = 80      // horizontal spacing
const CELL_HEIGHT = 60     // vertical spacing (foreshortened for isometric feel)
const GRID_COLS = 8
const GRID_ROWS = 7

export function createGrid(): GridCell[] {
  const cells: GridCell[] = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      // Skip cells outside the clearing (the oval shape)
      if (!isInClearing(col, row)) continue

      cells.push({
        col,
        row,
        x: GRID_ORIGIN_X + col * CELL_WIDTH + (row % 2 ? CELL_WIDTH / 2 : 0),
        y: GRID_ORIGIN_Y + row * CELL_HEIGHT,
        occupied: false,
      })
    }
  }
  return cells
}

// Approximate the oval clearing shape on the map
function isInClearing(col: number, row: number): boolean {
  const centerCol = (GRID_COLS - 1) / 2
  const centerRow = (GRID_ROWS - 1) / 2
  const dx = (col - centerCol) / (GRID_COLS / 2)
  const dy = (row - centerRow) / (GRID_ROWS / 2)
  return (dx * dx + dy * dy) <= 1.0
}

export function getRandomEmptyCell(grid: GridCell[]): GridCell | null {
  const empty = grid.filter(c => !c.occupied)
  if (empty.length === 0) return null
  return empty[Math.floor(Math.random() * empty.length)]
}

export const GRID_CONFIG = {
  originX: GRID_ORIGIN_X,
  originY: GRID_ORIGIN_Y,
  cellWidth: CELL_WIDTH,
  cellHeight: CELL_HEIGHT,
  cols: GRID_COLS,
  rows: GRID_ROWS,
}
