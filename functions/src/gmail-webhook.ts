import { onRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { generateQuest, makeIdempotencyKey } from './quest-generator'
import { awardXP } from './island-manager'

const db = admin.firestore()

// Gmail Pub/Sub push notification handler
// Google sends POST to this endpoint when a user's Gmail changes
export const onGmailPush = onRequest(
  { minInstances: 1, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

    // TODO: Validate OIDC token from Pub/Sub
    // const authHeader = req.headers.authorization
    // if (!validateOIDCToken(authHeader)) { res.status(403).send('Forbidden'); return }

    try {
      const message = req.body?.message
      if (!message?.data) {
        res.status(400).send('No message data')
        return
      }

      const decoded = JSON.parse(
        Buffer.from(message.data, 'base64').toString()
      )
      const { emailAddress, historyId } = decoded

      if (!emailAddress || !historyId) {
        res.status(400).send('Missing emailAddress or historyId')
        return
      }

      // Find user by email
      const usersSnap = await db
        .collection('users')
        .where('email', '==', emailAddress)
        .limit(1)
        .get()

      if (usersSnap.empty) {
        res.status(200).send('User not found, ignoring')
        return
      }

      const userId = usersSnap.docs[0].id

      // Idempotency check: skip if this historyId was already processed
      const idempotencyKey = makeIdempotencyKey('gmail', historyId)
      const existing = await db
        .collection('quests')
        .where('sourceEventId', '==', idempotencyKey)
        .limit(1)
        .get()

      if (!existing.empty) {
        res.status(200).send('Already processed')
        return
      }

      // Rate limit: max 1 gmail quest per 5 minutes
      const recentQuests = await db
        .collection('quests')
        .where('userId', '==', userId)
        .where('source', '==', 'gmail')
        .where('createdAt', '>', Date.now() - 5 * 60 * 1000)
        .limit(1)
        .get()

      if (!recentQuests.empty) {
        res.status(200).send('Rate limited')
        return
      }

      // Generate quest from template (no PII sent to Gemini)
      const quest = generateQuest('gmail', {
        senderName: 'someone', // We don't extract sender in MVP for privacy
      })

      // Write quest to Firestore
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

      // Write quest event for client
      await db.collection('quest_events').add({
        userId,
        questId: questRef.id,
        type: 'created',
        timestamp: Date.now(),
      })

      res.status(200).send('Quest created')
    } catch (err) {
      console.error('Gmail webhook error:', err)
      res.status(500).send('Internal error')
    }
  }
)
