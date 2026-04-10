import { useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, signOut } from './firebase/auth'
import { LoginScreen } from './components/LoginScreen'
import { IslandView } from './components/IslandView'
import { SKY_GRADIENT, FONT } from './theme'

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => onAuthChange((u) => setUser(u)), [])

  if (user === undefined) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: SKY_GRADIENT,
        color: '#6B6560', fontFamily: FONT, fontSize: 18,
      }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onSignedIn={() => {}} />
  }

  return <IslandView user={user} onSignOut={signOut} />
}
