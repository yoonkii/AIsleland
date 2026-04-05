import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, googleProvider } from './config'

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
