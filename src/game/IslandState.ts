export interface PlacedAsset {
  id: string
  type: string
  gridX: number
  gridY: number
  plantedAt: number
  growthStage: number
}

export interface IslandCharacter {
  id: string
  name: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  asset: string
  position: { x: number; y: number }
  unlockDate: number
}

export interface IslandState {
  level: number
  xp: number
  xpToNextLevel: number
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  placedAssets: PlacedAsset[]
  unlockedAssetTypes: string[]
  characters: IslandCharacter[]
  streakCount: number
  lastQuestCompletedAt: number | null
}

export function createInitialIsland(): IslandState {
  return {
    level: 1,
    xp: 0,
    xpToNextLevel: 60,
    season: getCurrentSeason(),
    placedAssets: [],
    unlockedAssetTypes: ['flower-1', 'flower-2', 'flower-3'],
    characters: [],
    streakCount: 0,
    lastQuestCompletedAt: null,
  }
}

function getCurrentSeason(): IslandState['season'] {
  const month = new Date().getMonth() // 0-11
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

// Level unlock table
export const LEVEL_UNLOCKS: Record<number, string[]> = {
  1: ['flower-1', 'flower-2', 'flower-3'],
  2: ['flower-1', 'flower-2', 'flower-3'],
  3: ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'road'],
  4: ['small-house', 'stall-1'],
  5: ['street-light-1', 'water-kattle-1'],
  6: ['windmill-1', 'windmill-2', 'windmill-3', 'fruit-baskets'],
  7: ['big-house', 'lumber'],
  8: ['cat', 'rabbit', 'small-dog-1'],
  9: ['hamster-1', 'hamster-2'],
  10: ['cat-1', 'rabbit-1'],
}

export function getUnlocksForLevel(level: number): string[] {
  const unlocked: string[] = []
  for (let l = 1; l <= level; l++) {
    const items = LEVEL_UNLOCKS[l]
    if (items) unlocked.push(...items)
  }
  return unlocked
}
