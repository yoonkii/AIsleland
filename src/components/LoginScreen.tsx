import { signInWithGoogle } from '../firebase/auth'
import { useState } from 'react'

interface Props {
  onSignedIn: () => void
}

export function LoginScreen({ onSignedIn }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
      onSignedIn()
    } catch (e: any) {
      console.error('Login failed:', e)
      setError(e?.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.island}>🏝️</div>
        <h1 style={styles.title}>AIsleland</h1>
        <p style={styles.subtitle}>
          Complete real work. Grow your island.
        </p>
        <p style={styles.description}>
          Connect your Google Workspace to turn emails, docs, and meetings
          into quests that grow a beautiful floating island.
        </p>
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>
        {error && <p style={styles.error}>{error}</p>}
        <p style={styles.privacy}>
          We only read metadata (titles, sender names). Your email content is never stored or shared.
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 40%, #98D8C8 70%, #7FB069 100%)',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: 'rgba(255, 250, 240, 0.92)',
    backdropFilter: 'blur(16px)',
    borderRadius: 24,
    padding: '48px 40px',
    maxWidth: 400,
    textAlign: 'center' as const,
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.5)',
  },
  island: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: '#2D1B0E',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: 16,
    color: '#5A3E1B',
    fontWeight: 500,
    margin: '0 0 16px',
  },
  description: {
    fontSize: 14,
    color: '#7A6040',
    lineHeight: 1.5,
    margin: '0 0 28px',
  },
  button: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #4285F4, #34A853)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    boxShadow: '0 4px 12px rgba(66,133,244,0.3)',
  },
  error: {
    color: '#EA4335',
    fontSize: 13,
    marginTop: 12,
  },
  privacy: {
    fontSize: 11,
    color: '#999',
    marginTop: 20,
    lineHeight: 1.4,
  },
}
