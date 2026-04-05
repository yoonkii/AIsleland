import { useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, signOut } from './firebase/auth'
import { LoginScreen } from './components/LoginScreen'
import { IslandView } from './components/IslandView'

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => onAuthChange((u) => setUser(u)), [])

  if (user === undefined) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 40%, #98D8C8 70%, #87CEEB 100%)',
        color: '#fff', fontFamily: 'system-ui', fontSize: 18,
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
