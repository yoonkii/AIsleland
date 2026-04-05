import { onCall } from 'firebase-functions/v2/https'
import { storeOAuthToken } from './token-store'

// Called by the client after Google sign-in to store the OAuth access token
// This token is used by gws CLI in Cloud Functions to access the user's GWS data
export const storeUserToken = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new Error('Unauthenticated')
    }

    const { accessToken } = request.data
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Missing accessToken')
    }

    await storeOAuthToken(request.auth.uid, accessToken)

    return { success: true }
  }
)
