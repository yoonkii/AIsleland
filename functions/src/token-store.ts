import * as admin from 'firebase-admin'

const db = admin.firestore()

// Store and retrieve OAuth tokens for users
// In production, use Google Secret Manager for encryption at rest
// For MVP, we store tokens in a server-only Firestore subcollection

export async function storeOAuthToken(userId: string, token: string, refreshToken?: string): Promise<void> {
  await db.doc(`users/${userId}/secrets/oauth`).set({
    accessToken: token,
    refreshToken: refreshToken || null,
    updatedAt: Date.now(),
  })
}

export async function getOAuthToken(userId: string): Promise<string | null> {
  const snap = await db.doc(`users/${userId}/secrets/oauth`).get()
  if (!snap.exists) return null
  return snap.data()?.accessToken || null
}

// Called after successful Google sign-in on the client
// The client sends the OAuth credential to a Cloud Function which stores it
export async function storeTokenFromCredential(userId: string, credential: any): Promise<void> {
  if (credential?.accessToken) {
    await storeOAuthToken(userId, credential.accessToken, credential.refreshToken)
  }
}
