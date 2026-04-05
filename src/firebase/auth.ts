import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User, GoogleAuthProvider } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, googleProvider, functions } from './config'

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)

  // Extract OAuth access token and store it server-side for gws CLI usage
  const credential = GoogleAuthProvider.credentialFromResult(result)
  if (credential?.accessToken) {
    // Step 1: Store the token first
    try {
      const storeToken = httpsCallable(functions, 'storeUserToken')
      await storeToken({ accessToken: credential.accessToken })
      console.log('OAuth token stored')
    } catch (e) {
      console.warn('Failed to store OAuth token:', e)
    }

    // Step 2: Set up Gmail watch (after token is stored)
    try {
      const setupWatch = httpsCallable(functions, 'setupGmailWatch')
      await setupWatch({})
      console.log('Gmail push notifications enabled')
    } catch (e) {
      console.warn('Gmail watch setup failed:', e)
    }
  }

  return result.user
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
