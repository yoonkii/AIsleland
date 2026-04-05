// Template-based quest generation (100% templates for MVP, no PII to Gemini)

export type QuestSource = 'gmail' | 'docs' | 'sheets' | 'slides' | 'calendar'

interface QuestTemplate {
  source: QuestSource
  title: string
  difficulty: 1 | 2 | 3 | 4
  xpReward: number
  rewardType: 'flower' | 'tree' | 'building' | 'character_chance'
}

export function generateQuest(
  source: QuestSource,
  metadata: { senderName?: string; title?: string; time?: string; isUrgent?: boolean }
): QuestTemplate {
  const sender = metadata.senderName || 'someone'
  const docTitle = metadata.title || 'a document'
  const time = metadata.time || 'soon'
  const urgent = metadata.isUrgent

  switch (source) {
    case 'gmail':
      return {
        source,
        title: `Answer ${sender}'s message`,
        difficulty: urgent ? 3 : 2,
        xpReward: urgent ? 50 : 30,
        rewardType: urgent ? 'tree' : 'flower',
      }

    case 'calendar':
      return {
        source,
        title: `Get ready for ${docTitle} at ${time}`,
        difficulty: 1,
        xpReward: 20,
        rewardType: 'flower',
      }

    case 'docs':
      return {
        source,
        title: `Continue working on ${docTitle}`,
        difficulty: 2,
        xpReward: 50,
        rewardType: 'tree',
      }

    case 'sheets':
      return {
        source,
        title: `Update ${docTitle}`,
        difficulty: 2,
        xpReward: 35,
        rewardType: 'flower',
      }

    case 'slides':
      return {
        source,
        title: `Work on presentation: ${docTitle}`,
        difficulty: 2,
        xpReward: 45,
        rewardType: 'building',
      }
  }
}

// Idempotency: check if quest for this event already exists
export function makeIdempotencyKey(source: QuestSource, eventId: string): string {
  return `${source}:${eventId}`
}
