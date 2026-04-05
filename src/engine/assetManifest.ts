export type AssetCategory = 'background' | 'flora' | 'structure' | 'character' | 'decoration' | 'path'

export interface AssetDef {
  key: string
  file: string
  category: AssetCategory
  displayWidth: number
  displayHeight: number
  anchorX: number
  anchorY: number
  zLayer: number  // higher = rendered on top
  unlockLevel: number
}

// Display sizes are scaled down from originals for the island view
// Anchor at bottom-center so sprites "stand" on the grid
export const ASSET_MANIFEST: AssetDef[] = [
  // Background (not placed on grid, rendered as base layer)
  { key: 'map', file: 'map.png', category: 'background', displayWidth: 1024, displayHeight: 1024, anchorX: 0.5, anchorY: 0.5, zLayer: 0, unlockLevel: 1 },

  // Flora - flowers (small, unlocked early)
  { key: 'flower-1', file: 'flower-1.png', category: 'flora', displayWidth: 60, displayHeight: 40, anchorX: 0.5, anchorY: 0.85, zLayer: 2, unlockLevel: 1 },
  { key: 'flower-2', file: 'flower-2.png', category: 'flora', displayWidth: 45, displayHeight: 33, anchorX: 0.5, anchorY: 0.85, zLayer: 2, unlockLevel: 1 },
  { key: 'flower-3', file: 'flower-3.png', category: 'flora', displayWidth: 45, displayHeight: 34, anchorX: 0.5, anchorY: 0.85, zLayer: 2, unlockLevel: 1 },
  { key: 'pumpkin-farm', file: 'pumpkin-farm.png', category: 'flora', displayWidth: 70, displayHeight: 49, anchorX: 0.5, anchorY: 0.85, zLayer: 2, unlockLevel: 6 },

  // Flora - trees (medium, unlocked at level 3)
  { key: 'tree-1', file: 'tree-1.png', category: 'flora', displayWidth: 70, displayHeight: 88, anchorX: 0.5, anchorY: 0.9, zLayer: 3, unlockLevel: 3 },
  { key: 'tree-2', file: 'tree-2.png', category: 'flora', displayWidth: 80, displayHeight: 104, anchorX: 0.5, anchorY: 0.9, zLayer: 3, unlockLevel: 3 },
  { key: 'tree-3', file: 'tree-3.png', category: 'flora', displayWidth: 80, displayHeight: 104, anchorX: 0.5, anchorY: 0.9, zLayer: 3, unlockLevel: 3 },
  { key: 'tree-4', file: 'tree-4.png', category: 'flora', displayWidth: 80, displayHeight: 104, anchorX: 0.5, anchorY: 0.9, zLayer: 3, unlockLevel: 3 },

  // Structures (unlocked progressively)
  { key: 'small-house', file: 'small-house.png', category: 'structure', displayWidth: 90, displayHeight: 104, anchorX: 0.5, anchorY: 0.85, zLayer: 4, unlockLevel: 4 },
  { key: 'big-house', file: 'big-house.png', category: 'structure', displayWidth: 110, displayHeight: 84, anchorX: 0.5, anchorY: 0.85, zLayer: 4, unlockLevel: 7 },
  { key: 'stall-1', file: 'stall-1.png', category: 'structure', displayWidth: 70, displayHeight: 76, anchorX: 0.5, anchorY: 0.85, zLayer: 4, unlockLevel: 4 },
  { key: 'windmill-1', file: 'windmill-1.png', category: 'structure', displayWidth: 80, displayHeight: 127, anchorX: 0.5, anchorY: 0.9, zLayer: 5, unlockLevel: 6 },
  { key: 'windmill-2', file: 'windmill-2.png', category: 'structure', displayWidth: 85, displayHeight: 122, anchorX: 0.5, anchorY: 0.9, zLayer: 5, unlockLevel: 6 },
  { key: 'windmill-3', file: 'windmill-3.png', category: 'structure', displayWidth: 60, displayHeight: 89, anchorX: 0.5, anchorY: 0.9, zLayer: 5, unlockLevel: 6 },

  // Decorations
  { key: 'signpost-1', file: 'signpost-1.png', category: 'decoration', displayWidth: 35, displayHeight: 57, anchorX: 0.5, anchorY: 0.9, zLayer: 2, unlockLevel: 3 },
  { key: 'street-light-1', file: 'street-light-1.png', category: 'decoration', displayWidth: 30, displayHeight: 87, anchorX: 0.5, anchorY: 0.95, zLayer: 3, unlockLevel: 5 },
  { key: 'water-kattle-1', file: 'water-kattle-1.png', category: 'decoration', displayWidth: 40, displayHeight: 35, anchorX: 0.5, anchorY: 0.85, zLayer: 2, unlockLevel: 5 },
  { key: 'fruit-baskets', file: 'fruit-baskets.png', category: 'decoration', displayWidth: 55, displayHeight: 36, anchorX: 0.5, anchorY: 0.85, zLayer: 2, unlockLevel: 6 },
  { key: 'lumber', file: 'lumber.png', category: 'decoration', displayWidth: 55, displayHeight: 45, anchorX: 0.5, anchorY: 0.85, zLayer: 2, unlockLevel: 7 },
  { key: 'road', file: 'road.png', category: 'path', displayWidth: 70, displayHeight: 44, anchorX: 0.5, anchorY: 0.5, zLayer: 1, unlockLevel: 3 },

  // Characters (animals)
  { key: 'cat', file: 'cat.png', category: 'character', displayWidth: 55, displayHeight: 53, anchorX: 0.5, anchorY: 0.9, zLayer: 6, unlockLevel: 8 },
  { key: 'cat-1', file: 'cat-1.png', category: 'character', displayWidth: 40, displayHeight: 51, anchorX: 0.5, anchorY: 0.9, zLayer: 6, unlockLevel: 10 },
  { key: 'rabbit', file: 'rabbit.png', category: 'character', displayWidth: 40, displayHeight: 78, anchorX: 0.5, anchorY: 0.9, zLayer: 6, unlockLevel: 8 },
  { key: 'rabbit-1', file: 'rabbit-1.png', category: 'character', displayWidth: 35, displayHeight: 53, anchorX: 0.5, anchorY: 0.9, zLayer: 6, unlockLevel: 10 },
  { key: 'small-dog-1', file: 'small-dog-1.png', category: 'character', displayWidth: 35, displayHeight: 40, anchorX: 0.5, anchorY: 0.9, zLayer: 6, unlockLevel: 8 },
  { key: 'hamster-1', file: 'hamster-1.png', category: 'character', displayWidth: 50, displayHeight: 71, anchorX: 0.5, anchorY: 0.9, zLayer: 6, unlockLevel: 9 },
  { key: 'hamster-2', file: 'hamster-2.png', category: 'character', displayWidth: 50, displayHeight: 67, anchorX: 0.5, anchorY: 0.9, zLayer: 6, unlockLevel: 9 },
]

export function getAssetDef(key: string): AssetDef | undefined {
  return ASSET_MANIFEST.find(a => a.key === key)
}

export function getPlaceableAssets(level: number): AssetDef[] {
  return ASSET_MANIFEST.filter(a => a.category !== 'background' && a.unlockLevel <= level)
}
