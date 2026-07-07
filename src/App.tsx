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

  // Resume/attach a Firebase session whenever auth produces a user. This is
  // the ONLY code path that creates a firebase adapter — onGoogle just signs
  // in and lets this listener do the wiring, so the two can never race into
  // creating (and leaking) two adapters. `connecting` closes the async
  // check-then-act window against duplicate auth events.
  const connecting = useRef(false)
  useEffect(() => {
    if (!hasFirebaseConfig) return
    return onAuthChange(async (user) => {
      const state = useGameStore.getState()
      if (user && state.mode === null && !connecting.current) {
        connecting.current = true
        try {
          const adapter = await createFirebaseAdapter(
            user.uid, user.email ?? '', user.displayName ?? 'Islander')
          if (useGameStore.getState().mode === null) {
            state.startSession('firebase', {
              uid: user.uid,
              displayName: user.displayName ?? 'Islander',
              email: user.email ?? '',
              photoURL: user.photoURL,
            }, adapter)
          } else {
            adapter.dispose()
          }
        } catch (e) {
          console.error('firebase session failed', e)
          setError('Could not load your island. Try the demo instead.')
        } finally {
          connecting.current = false
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
      // The onAuthChange listener above builds the adapter and starts the
      // session as soon as the popup resolves.
      await signInWithGoogle()
    } catch (e) {
      console.error(e)
      setError('Sign-in failed. You can still try the demo island!')
    } finally {
      setBusy(false)
    }
  }, [])

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
