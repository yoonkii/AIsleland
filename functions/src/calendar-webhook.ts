import { onRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { generateQuest, makeIdempotencyKey } from './quest-generator'

const db = admin.firestore()

// Calendar watch API push notification handler
export const onCalendarEvent = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

    try {
      // Calendar push notifications come with headers, not body
      const channelId = req.headers['x-goog-channel-id'] as string
      const resourceState = req.headers['x-goog-resource-state'] as string

      if (resourceState === 'sync') {
        // Initial sync message, acknowledge
        res.status(200).send('Sync acknowledged')
        return
      }

      if (!channelId) {
        res.status(400).send('Missing channel ID')
        return
      }

      // Look up which user this channel belongs to
      // In production: store channel->user mapping when setting up watch
      // For now, we'll need the userId from a lookup table
      const channelSnap = await db
        .collection('calendar_channels')
        .doc(channelId)
        .get()

      if (!channelSnap.exists) {
        res.status(200).send('Unknown channel')
        return
      }

      const { userId } = channelSnap.data()!
      const eventId = `cal-${channelId}-${Date.now()}`
      const idempotencyKey = makeIdempotencyKey('calendar', eventId)

      // Rate limit
      const recent = await db
        .collection('quests')
        .where('userId', '==', userId)
        .where('source', '==', 'calendar')
        .where('createdAt', '>', Date.now() - 5 * 60 * 1000)
        .limit(1)
        .get()

      if (!recent.empty) {
        res.status(200).send('Rate limited')
        return
      }

      const quest = generateQuest('calendar', {
        title: 'upcoming event',
        time: 'soon',
      })

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
        verificationMethod: 'self_report',
        sourceEventId: idempotencyKey,
      })

      await db.collection('quest_events').add({
        userId,
        questId: questRef.id,
        type: 'created',
        timestamp: Date.now(),
      })

      res.status(200).send('Quest created')
    } catch (err) {
      console.error('Calendar webhook error:', err)
      res.status(500).send('Internal error')
    }
  }
)
