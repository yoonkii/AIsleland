import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'

const db = admin.firestore()

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Daily cleanup: archive old quests and delete expired events
export const cleanupOldQuests = onSchedule(
  { schedule: 'every day 03:00', region: 'us-central1' },
  async () => {
    const now = Date.now()

    // Delete completed/expired quests older than 30 days
    const oldQuests = await db
      .collection('quests')
      .where('status', 'in', ['completed', 'expired'])
      .where('createdAt', '<', now - THIRTY_DAYS_MS)
      .limit(500)
      .get()

    const questBatch = db.batch()
    oldQuests.docs.forEach(doc => questBatch.delete(doc.ref))
    if (!oldQuests.empty) {
      await questBatch.commit()
      console.log(`Deleted ${oldQuests.size} old quests`)
    }

    // Delete quest events older than 7 days
    const oldEvents = await db
      .collection('quest_events')
      .where('timestamp', '<', now - SEVEN_DAYS_MS)
      .limit(500)
      .get()

    const eventBatch = db.batch()
    oldEvents.docs.forEach(doc => eventBatch.delete(doc.ref))
    if (!oldEvents.empty) {
      await eventBatch.commit()
      console.log(`Deleted ${oldEvents.size} old quest events`)
    }

    // Expire active quests older than 24 hours
    const staleQuests = await db
      .collection('quests')
      .where('status', '==', 'active')
      .where('createdAt', '<', now - 24 * 60 * 60 * 1000)
      .limit(500)
      .get()

    const staleBatch = db.batch()
    staleQuests.docs.forEach(doc =>
      staleBatch.update(doc.ref, { status: 'expired' })
    )
    if (!staleQuests.empty) {
      await staleBatch.commit()
      console.log(`Expired ${staleQuests.size} stale quests`)
    }
  }
)
