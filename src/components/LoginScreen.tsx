import { signInWithGoogle } from '../firebase/auth'
import { useState } from 'react'
import { SKY_GRADIENT, FONT } from '../theme'

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
          className="btn-primary"
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
    background: SKY_GRADIENT,
    fontFamily: FONT,
  },
  card: {
    background: 'rgba(255, 253, 248, 0.88)',
    backdropFilter: 'blur(16px)',
    borderRadius: 24,
    padding: '48px 40px',
    maxWidth: 400,
    textAlign: 'center' as const,
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    border: '1px solid rgba(255,255,255,0.6)',
  },
  island: {
    fontSize: 64,
    marginBottom: 8,
    animation: 'floatBob 3s ease-in-out infinite',
    display: 'inline-block',
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    color: '#3A3632',
    margin: '0 0 8px',
    fontFamily: FONT,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6560',
    fontWeight: 500,
    margin: '0 0 16px',
  },
  description: {
    fontSize: 14,
    color: '#8A847E',
    lineHeight: 1.5,
    margin: '0 0 28px',
  },
  button: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #7EAED4, #8CC5A2)',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    fontFamily: FONT,
    boxShadow: '0 4px 16px rgba(126,174,212,0.3)',
    transition: 'all 0.2s ease',
  },
  error: {
    color: '#E07A6E',
    fontSize: 13,
    marginTop: 12,
  },
  privacy: {
    fontSize: 11,
    color: '#A09A94',
    marginTop: 20,
    lineHeight: 1.4,
  },
}
