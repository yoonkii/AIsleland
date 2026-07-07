import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthChange, signInWithGoogle, signOut } from './firebase/auth'
import { createDemoAdapter } from './data/demoAdapter'
import { createFirebaseAdapter } from './data/firebaseAdapter'
import { useGameStore } from './state/gameStore'
import { IslandScene } from './three/IslandScene'
import { HUD } from './ui/HUD'
import { QuestJournal } from './ui/QuestJournal'
import { CelebrationOverlay } from './ui/CelebrationOverlay'
import { PhotoModeBar } from './ui/PhotoModeBar'
import { LoginScreen } from './ui/LoginScreen'
import { ToastHost } from './ui/ToastHost'
import { initAudio } from './audio/SoundManager'
import './ui/ui.css'

const hasFirebaseConfig = Boolean(import.meta.env.VITE_FIREBASE_API_KEY)

export function App() {
  const mode = useGameStore((s) => s.mode)
  const startSession = useGameStore((s) => s.startSession)
  const endSession = useGameStore((s) => s.endSession)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioStarted = useRef(false)

  // Any first pointer gesture unlocks audio (browser autoplay policy).
  useEffect(() => {
    const unlock = () => {
      if (!audioStarted.current) {
        audioStarted.current = true
        initAudio()
      }
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Resume a Firebase session if the user is already signed in.
  useEffect(() => {
    if (!hasFirebaseConfig) return
    return onAuthChange(async (user) => {
      const state = useGameStore.getState()
      if (user && state.mode === null) {
        try {
          const adapter = await createFirebaseAdapter(
            user.uid, user.email ?? '', user.displayName ?? 'Islander')
          state.startSession('firebase', {
            uid: user.uid,
            displayName: user.displayName ?? 'Islander',
            email: user.email ?? '',
            photoURL: user.photoURL,
          }, adapter)
        } catch (e) {
          console.error('firebase session failed', e)
          setError('Could not load your island. Try the demo instead.')
        }
      }
      if (!user && state.mode === 'firebase') state.endSession()
    })
  }, [startSession])

  const onGoogle = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (!hasFirebaseConfig) {
        setError('Firebase is not configured — try the demo island!')
        return
      }
      const user = await signInWithGoogle()
      const adapter = await createFirebaseAdapter(
        user.uid, user.email ?? '', user.displayName ?? 'Islander')
      startSession('firebase', {
        uid: user.uid,
        displayName: user.displayName ?? 'Islander',
        email: user.email ?? '',
        photoURL: user.photoURL,
      }, adapter)
    } catch (e) {
      console.error(e)
      setError('Sign-in failed. You can still try the demo island!')
    } finally {
      setBusy(false)
    }
  }, [startSession])

  const onDemo = useCallback(() => {
    const adapter = createDemoAdapter()
    startSession('demo', {
      uid: 'demo',
      displayName: 'Visitor',
      email: 'demo@aisleland.app',
    }, adapter)
  }, [startSession])

  const onSignOut = useCallback(async () => {
    const wasFirebase = useGameStore.getState().mode === 'firebase'
    endSession()
    if (wasFirebase) {
      try { await signOut() } catch { /* already signed out */ }
    }
  }, [endSession])

  if (mode === null) {
    return <LoginScreen onGoogle={onGoogle} onDemo={onDemo} busy={busy} error={error} />
  }

  return (
    <div className="game-root">
      <IslandScene />
      <HUD onSignOut={onSignOut} />
      <QuestJournal />
      <CelebrationOverlay />
      <PhotoModeBar />
      <ToastHost />
    </div>
  )
}
