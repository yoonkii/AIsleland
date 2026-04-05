import { onCall } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { awardXP } from './island-manager'

const db = admin.firestore()

// Client calls this to complete a quest (self-report or confirming auto-detected)
export const completeQuest = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new Error('Unauthenticated')
    }

    const { questId } = request.data
    if (!questId || typeof questId !== 'string') {
      throw new Error('Missing questId')
    }

    const userId = request.auth.uid

    // Get the quest
    const questRef = db.doc(`quests/${questId}`)
    const questSnap = await questRef.get()

    if (!questSnap.exists) {
      throw new Error('Quest not found')
    }

    const quest = questSnap.data()!

    // Verify ownership
    if (quest.userId !== userId) {
      throw new Error('Not your quest')
    }

    // Verify it's still active
    if (quest.status !== 'active') {
      throw new Error('Quest already completed or expired')
    }

    // Rate limit: max 1 completion per source per 5 minutes
    const recent = await db
      .collection('quests')
      .where('userId', '==', userId)
      .where('source', '==', quest.source)
      .where('status', '==', 'completed')
      .where('completedAt', '>', Date.now() - 5 * 60 * 1000)
      .limit(1)
      .get()

    if (!recent.empty) {
      throw new Error('Too fast! Wait a bit between completions.')
    }

    // Mark quest as completed
    await questRef.update({
      status: 'completed',
      completedAt: Date.now(),
    })

    // Award XP and place asset on island
    await awardXP(userId, quest.xpReward, quest.rewardType)

    // Write quest event for client animations
    await db.collection('quest_events').add({
      userId,
      questId,
      type: 'completed',
      timestamp: Date.now(),
    })

    return {
      success: true,
      xpAwarded: quest.xpReward,
      rewardType: quest.rewardType,
    }
  }
)
