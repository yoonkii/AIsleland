import { signInWithGoogle } from '../firebase/auth'
import { useState } from 'react'
import { FONT } from '../theme'

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
      {/* Animated background clouds */}
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      <div className="cloud cloud-3" />

      {/* Soft radial glow behind card */}
      <div style={styles.glow} />

      {/* Hero island image */}
      <div className="hero-island" style={styles.heroWrap}>
        <img src="/assets/map.png" alt="" style={styles.heroImg} />
      </div>

      {/* Main card */}
      <div className="login-card" style={styles.card}>
        <h1 className="fade-1" style={styles.title}>AIsleland</h1>
        <p className="fade-2" style={styles.subtitle}>
          Complete real work. Grow your island.
        </p>
        <p className="fade-3" style={styles.description}>
          Connect your Google Workspace to turn emails, docs, and meetings
          into quests that grow a beautiful floating island.
        </p>
        <button
          className="btn-primary fade-4"
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <span>Connecting...</span>
          ) : (
            <span style={styles.btnContent}>
              <svg style={styles.googleIcon} viewBox="0 0 24 24">
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </span>
          )}
        </button>
        {error && <p style={styles.error}>{error}</p>}
        <p className="fade-5" style={styles.privacy}>
          We only read metadata (titles, sender names).
          <br />Your content is never stored or shared.
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 'max(40px, env(safe-area-inset-bottom, 40px))',
    background: 'linear-gradient(170deg, #B8D8E8 0%, #C8DFE8 25%, #D4E8D0 50%, #E2DCCC 75%, #D4E8D0 100%)',
    fontFamily: FONT,
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: '25%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80vw',
    maxWidth: 500,
    height: '40vh',
    background: 'radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroWrap: {
    position: 'absolute',
    top: '8%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(70vw, 340px)',
    height: 'min(70vw, 340px)',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.1))',
  },
  heroImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  card: {
    background: 'rgba(255, 253, 248, 0.75)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: 28,
    padding: '36px 32px 28px',
    width: 'calc(100% - 32px)',
    maxWidth: 420,
    textAlign: 'center' as const,
    boxShadow: '0 -4px 40px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8) inset',
    border: '1px solid rgba(255,255,255,0.5)',
    position: 'relative' as const,
    zIndex: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: '#2C2926',
    margin: '0 0 6px',
    fontFamily: FONT,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6560',
    fontWeight: 600,
    margin: '0 0 14px',
    letterSpacing: '-0.2px',
  },
  description: {
    fontSize: 13,
    color: '#9A948E',
    lineHeight: 1.6,
    margin: '0 0 24px',
  },
  button: {
    width: '100%',
    padding: '15px 24px',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg, #6A9EC0, #7BB89A)',
    border: 'none',
    borderRadius: 16,
    cursor: 'pointer',
    fontFamily: FONT,
    boxShadow: '0 4px 20px rgba(106,158,192,0.35)',
    letterSpacing: '-0.2px',
  },
  btnContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIcon: {
    width: 18,
    height: 18,
    flexShrink: 0,
    opacity: 0.9,
  },
  error: {
    color: '#E07A6E',
    fontSize: 13,
    marginTop: 12,
    fontWeight: 500,
  },
  privacy: {
    fontSize: 11,
    color: '#B5AFA9',
    marginTop: 18,
    lineHeight: 1.5,
  },
}
