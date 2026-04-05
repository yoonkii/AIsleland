import { onCall } from 'firebase-functions/v2/https'
import { getOAuthToken } from './token-store'

// Sets up Gmail push notifications for the authenticated user.
// Calls Gmail API users.watch() to register the Pub/Sub topic.
// Must be called once after sign-in, and renewed every 7 days.
export const setupGmailWatch = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new Error('Unauthenticated')
    }

    const userId = request.auth.uid
    const token = await getOAuthToken(userId)

    if (!token) {
      throw new Error('No OAuth token found. Please sign out and sign in again.')
    }

    // Call Gmail API directly (gws CLI doesn't support watch easily)
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: 'projects/flashcard-generator-2be4a/topics/gmail-push',
        labelIds: ['INBOX'],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Gmail watch setup failed:', error)
      throw new Error(`Gmail watch failed: ${response.status} ${error}`)
    }

    const data = await response.json()
    console.log('Gmail watch setup success:', data)

    return {
      success: true,
      historyId: data.historyId,
      expiration: data.expiration,
    }
  }
)
