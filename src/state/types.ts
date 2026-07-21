// Shared game-state types for the 3D revamp.
// Asset type ids MUST stay compatible with the legacy Firestore data
// written by functions/src/island-manager.ts.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type QuestSource = 'gmail' | 'docs' | 'sheets' | 'slides' | 'calendar'
export type RewardType = 'flower' | 'tree' | 'building' | 'character_chance'

export interface Quest {
  id: string
  source: QuestSource
  title: string
  difficulty: 1 | 2 | 3 | 4
  xpReward: number
  rewardType: RewardType
  status: 'active' | 'completed' | 'expired'
  createdAt: number
}

/** A reward placed on the island grid (8 cols x 7 rows oval clearing). */
export interface PlacedAsset {
  id: string
  type: string // e.g. 'flower-1', 'tree-3', 'small-house', 'windmill-2'
  gridX: number // col 0..7
  gridY: number // row 0..6
  plantedAt: number
  /** 0 = just planted (pop-in animation plays), 1 = fully grown */
  growthStage: number
}

export type CritterSpecies =
  | 'cat' | 'cat-1' | 'rabbit' | 'rabbit-1' | 'small-dog-1'
  | 'hamster-1' | 'hamster-2'

export interface CritterInstance {
  id: string
  species: CritterSpecies
  name: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  /** Home position on the grid; the critter wanders around it. */
  home: { x: number; y: number }
  unlockDate: number
}

export interface IslandSummary {
  level: number
  xp: number
  xpToNextLevel: number
  season: Season
  streakCount: number
  unlockedAssetTypes: string[]
}

export type CelebrationEvent =
  | {
      kind: 'quest'
      id: string
      quest: Quest
      /** id of the PlacedAsset that this quest spawned (already in store.assets) */
      rewardAssetId: string | null
      /** critter spawned instead of an asset, if any */
      rewardCritterId: string | null
    }
  | { kind: 'levelup'; id: string; newLevel: number; unlocked: string[] }
  /** First quest of a new day: the morning rain ritual (rain + rainbow). */
  | { kind: 'rain'; id: string; streakCount: number }

export const LEVEL_THRESHOLDS = [0, 60, 140, 240, 360, 520, 720, 960, 1240, 1600]

export const LEVEL_UNLOCKS: Record<number, string[]> = {
  1: ['flower-1', 'flower-2', 'flower-3'],
  3: ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'road'],
  4: ['small-house', 'stall-1'],
  5: ['street-light-1', 'water-kattle-1'],
  6: ['windmill-1', 'windmill-2', 'windmill-3', 'fruit-baskets'],
  7: ['big-house', 'lumber'],
  8: ['cat', 'rabbit', 'small-dog-1'],
  9: ['hamster-1', 'hamster-2'],
  10: ['cat-1', 'rabbit-1'],
}

export function unlocksUpTo(level: number): string[] {
  const out: string[] = []
  for (let l = 1; l <= level; l++) if (LEVEL_UNLOCKS[l]) out.push(...LEVEL_UNLOCKS[l])
  return out
}

export const CRITTER_SPECIES = new Set<string>([
  'cat', 'cat-1', 'rabbit', 'rabbit-1', 'small-dog-1', 'hamster-1', 'hamster-2',
])
