import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import { queryDriveActivity } from './gws'
import { generateQuest, makeIdempotencyKey } from './quest-generator'
import { getOAuthToken } from './token-store'

const db = admin.firestore()

// Poll Drive Activity API every 5 minutes using gws CLI
// Detects Docs, Sheets, Slides edits and creates quests
export const pollDriveActivity = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1' },
  async () => {
    // Get all users active in the last hour
    const activeUsers = await db
      .collection('users')
      .where('lastActive', '>', Date.now() - 60 * 60 * 1000)
      .get()

    for (const userDoc of activeUsers.docs) {
      const userId = userDoc.id
      const token = await getOAuthToken(userId)
      if (!token) continue

      try {
        // Use gws CLI to query recent drive activity
        const result = queryDriveActivity(token, 10)
        const activities = result?.activities || []

        for (const activity of activities) {
          const action = activity?.primaryActionDetail
          if (!action) continue

          // Detect edit actions
          const isEdit = action.edit || action.create
          if (!isEdit) continue

          // Get the target document info
          const target = activity?.targets?.[0]?.driveItem
          if (!target) continue

          const title = target.title || 'a document'
          const mimeType = target.mimeType || ''

          // Determine source type from MIME type
          let source: 'docs' | 'sheets' | 'slides' = 'docs'
          if (mimeType.includes('spreadsheet')) source = 'sheets'
          else if (mimeType.includes('presentation')) source = 'slides'

          // Idempotency check
          const eventId = `${target.name || ''}-${activity.timestamp || Date.now()}`
          const idempotencyKey = makeIdempotencyKey(source, eventId)

          const existing = await db
            .collection('quests')
            .where('sourceEventId', '==', idempotencyKey)
            .limit(1)
            .get()

          if (!existing.empty) continue

          // Rate limit per source
          const recent = await db
            .collection('quests')
            .where('userId', '==', userId)
            .where('source', '==', source)
            .where('createdAt', '>', Date.now() - 5 * 60 * 1000)
            .limit(1)
            .get()

          if (!recent.empty) continue

          // Generate quest
          const quest = generateQuest(source, { title })

          const questRef = await db.collection('quests').add({
            userId,
            source: quest.source,
            title: quest.title,
            difficulty: quest.difficulty,
            xpReward: quest.xpReward,
            rewardType: quest.rewardType,
            status: 'active',
            createdAt: Date.now(),
            completedAt: null,
            verificationMethod: 'auto',
            sourceEventId: idempotencyKey,
          })

          await db.collection('quest_events').add({
            userId,
            questId: questRef.id,
            type: 'created',
            timestamp: Date.now(),
          })

          console.log(`Created ${source} quest for user ${userId}: ${quest.title}`)
        }
      } catch (err) {
        console.error(`Drive activity poll failed for user ${userId}:`, err)
      }
    }
  }
)
