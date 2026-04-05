import { onRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { getEmailMetadata } from './gws'
import { generateQuest, makeIdempotencyKey } from './quest-generator'
import { getOAuthToken } from './token-store'

const db = admin.firestore()

// Gmail Pub/Sub push notification handler
// When a user's Gmail changes, Google sends a POST to this endpoint
export const onGmailPush = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

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
        res.status(200).send('User not found')
        return
      }

      const userId = usersSnap.docs[0].id

      // Idempotency: skip if this historyId was already processed
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
      const recent = await db
        .collection('quests')
        .where('userId', '==', userId)
        .where('source', '==', 'gmail')
        .where('createdAt', '>', Date.now() - 5 * 60 * 1000)
        .limit(1)
        .get()

      if (!recent.empty) {
        res.status(200).send('Rate limited')
        return
      }

      // Get user's OAuth token and use gws to fetch email metadata
      const token = await getOAuthToken(userId)
      let senderName = 'someone'

      if (token) {
        try {
          // Use gws CLI to get the latest unread message metadata
          const msgList = await getEmailMetadata(token, 'me')
          if (msgList?.payload?.headers) {
            const fromHeader = msgList.payload.headers.find(
              (h: any) => h.name === 'From'
            )
            if (fromHeader?.value) {
              // Extract just the name part: "John Doe <john@example.com>" -> "John"
              const match = fromHeader.value.match(/^"?([^"<]+)"?\s*</)
              senderName = match ? match[1].trim().split(' ')[0] : 'someone'
            }
          }
        } catch (e) {
          console.warn('gws email metadata fetch failed, using fallback:', e)
        }
      }

      // Generate quest from template
      const quest = generateQuest('gmail', { senderName })

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

      res.status(200).send('Quest created')
    } catch (err) {
      console.error('Gmail webhook error:', err)
      res.status(500).send('Internal error')
    }
  }
)
