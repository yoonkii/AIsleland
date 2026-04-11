import { signInWithGoogle } from '../firebase/auth'
import { useState, useEffect } from 'react'
import { FONT } from '../theme'

const TITLE_FONT = "'Fredoka', 'Nunito', system-ui, sans-serif"

interface Props {
  onSignedIn: () => void
}

export function LoginScreen({ onSignedIn }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)

  // After entrance animation, enable idle pulse on button
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 3200)
    return () => clearTimeout(t)
  }, [])

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
    <div className="login-bg" style={styles.container}>
      {/* Depth layer 1: distant clouds (blurry, faint) */}
      <div className="cloud cloud-back-1" />
      <div className="cloud cloud-back-2" />

      {/* Depth layer 2: horizon glow */}
      <div className="horizon-glow" />

      {/* Depth layer 3: hero island */}
      <div className="login-island" style={styles.heroWrap}>
        <img src="/assets/map.png" alt="" style={styles.heroImg} />
      </div>

      {/* Depth layer 4: front clouds (sharper, more opaque) */}
      <div className="cloud cloud-front-1" />
      <div className="cloud cloud-front-2" />

      {/* Depth layer 5: ambient particles */}
      <div className="login-motes">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className={`mote mote-${i + 1}`} />
        ))}
      </div>

      {/* UI layer */}
      <div className="login-ui" style={styles.uiWrap}>
        <h1 className="login-title" style={styles.title}>AIsleland</h1>
        <p className="login-tag" style={styles.tagline}>
          Complete real work. Grow your island.
        </p>

        <button
          className={`btn-primary login-btn ${entered ? 'login-btn-idle' : ''}`}
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Connecting...' : (
            <span style={styles.btnContent}>
              <svg style={styles.googleIcon} viewBox="0 0 533.5 544.3">
                <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z"/>
                <path fill="#34A853" d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z"/>
                <path fill="#FBBC04" d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z"/>
                <path fill="#EA4335" d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z"/>
              </svg>
              Sign in with Google
            </span>
          )}
        </button>

        {error && <p style={styles.error}>{error}</p>}

        <p className="login-fine" style={styles.fineprint}>
          Metadata only. Your content stays private.
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
    fontFamily: FONT,
    position: 'relative',
    overflow: 'hidden',
  },
  heroWrap: {
    position: 'absolute',
    top: '6%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(80vw, 380px)',
    height: 'min(80vw, 380px)',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 24px 50px rgba(0,0,0,0.12))',
    zIndex: 2,
  },
  heroImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  uiWrap: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    padding: '0 24px',
    paddingBottom: 'max(48px, env(safe-area-inset-bottom, 48px))',
  },
  title: {
    fontSize: 'clamp(40px, 10vw, 56px)',
    fontWeight: 700,
    color: '#3D3229',
    margin: '0 0 6px',
    fontFamily: TITLE_FONT,
    letterSpacing: '1.5px',
    textShadow: '0 2px 20px rgba(255,255,255,0.5)',
  },
  tagline: {
    fontSize: 15,
    color: '#6B5B4E',
    fontWeight: 600,
    margin: '0 0 28px',
    letterSpacing: '0.3px',
    textShadow: '0 1px 8px rgba(255,255,255,0.4)',
  },
  button: {
    width: '100%',
    maxWidth: 340,
    padding: '16px 24px',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg, #5BAD8A, #4A9E7A)',
    border: 'none',
    borderRadius: 24,
    cursor: 'pointer',
    fontFamily: FONT,
    boxShadow: '0 4px 20px rgba(91,173,138,0.3), inset 0 1px 2px rgba(255,255,255,0.25)',
    letterSpacing: '0.2px',
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
  },
  error: {
    color: '#D4654E',
    fontSize: 13,
    marginTop: 12,
    fontWeight: 600,
    textShadow: '0 1px 4px rgba(255,255,255,0.3)',
  },
  fineprint: {
    fontSize: 11,
    color: 'rgba(61,50,41,0.4)',
    marginTop: 16,
    letterSpacing: '0.2px',
  },
}
