// Firestore document types matching the schema in the design doc

export interface UserDoc {
  email: string
  displayName: string
  createdAt: number
  lastActive: number
}

export interface IslandDoc {
  level: number
  xp: number
  xpToNextLevel: number
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  unlockedAssetTypes: string[]
  characters: CharacterDoc[]
  streakCount: number
  lastQuestCompletedAt: number | null
}

export interface IslandAssetDoc {
  type: string
  gridX: number
  gridY: number
  plantedAt: number
  growthStage: number
}

export interface CharacterDoc {
  id: string
  name: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  asset: string
  position: { x: number; y: number }
  unlockDate: number
}

export interface QuestDoc {
  userId: string
  source: 'gmail' | 'docs' | 'sheets' | 'slides' | 'calendar'
  title: string
  difficulty: 1 | 2 | 3 | 4
  xpReward: number
  rewardType: 'flower' | 'tree' | 'building' | 'character_chance'
  status: 'active' | 'completed' | 'expired'
  createdAt: number
  completedAt: number | null
  verificationMethod: 'auto' | 'self_report'
  sourceEventId: string
}

export interface QuestEventDoc {
  userId: string
  questId: string
  type: 'created' | 'completed' | 'expired'
  timestamp: number
}
