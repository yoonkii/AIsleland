import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-aisleland',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Use the new cache API instead of deprecated enableIndexedDbPersistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

export const functions = getFunctions(app, 'us-central1')

// Google OAuth with GWS scopes
export const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly')
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send')
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly')
googleProvider.addScope('https://www.googleapis.com/auth/drive.activity.readonly')
googleProvider.addScope('https://www.googleapis.com/auth/documents.readonly')
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly')
