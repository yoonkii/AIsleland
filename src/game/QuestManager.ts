export type QuestSource = 'gmail' | 'docs' | 'sheets' | 'slides' | 'calendar'
export type QuestStatus = 'active' | 'completed' | 'expired'
export type RewardType = 'flower' | 'tree' | 'building' | 'character_chance'

export interface Quest {
  id: string
  source: QuestSource
  title: string
  difficulty: 1 | 2 | 3 | 4
  xpReward: number
  rewardType: RewardType
  status: QuestStatus
  createdAt: number
  completedAt: number | null
  verificationMethod: 'auto' | 'self_report'
  sourceEventId: string
}

export function getSourceIcon(source: QuestSource): string {
  switch (source) {
    case 'gmail': return '\u2709\uFE0F'
    case 'docs': return '\uD83D\uDCC4'
    case 'sheets': return '\uD83D\uDCCA'
    case 'slides': return '\uD83C\uDFA8'
    case 'calendar': return '\uD83D\uDCC5'
  }
}

export function getSourceLabel(source: QuestSource): string {
  switch (source) {
    case 'gmail': return 'Gmail'
    case 'docs': return 'Google Docs'
    case 'sheets': return 'Google Sheets'
    case 'slides': return 'Google Slides'
    case 'calendar': return 'Calendar'
  }
}

export function getDifficultyStars(difficulty: number): string {
  return '\u2B50'.repeat(difficulty)
}

export function getDifficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1: return 'Normal'
    case 2: return 'Important'
    case 3: return 'Urgent'
    case 4: return 'Special'
    default: return 'Normal'
  }
}
