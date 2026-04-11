import { signInWithGoogle } from '../firebase/auth'
import { useState, useEffect, useRef, useCallback } from 'react'
import { FONT } from '../theme'

const TITLE_FONT = "'Fredoka', 'Nunito', system-ui, sans-serif"

interface Props {
  onSignedIn: () => void
}

// Time-aware sky palettes
function getSkyClass(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 8)   return 'sky-dawn'
  if (h >= 8 && h < 17)  return 'sky-day'
  if (h >= 17 && h < 20) return 'sky-sunset'
  return 'sky-night'
}

function isNight(): boolean {
  const h = new Date().getHours()
  return h >= 20 || h < 5
}

export function LoginScreen({ onSignedIn }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)
  const [skyClass] = useState(getSkyClass)
  const [night] = useState(isNight)
  const parallaxRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  // Parallax: mouse on desktop, gyroscope on mobile
  const handleParallax = useCallback((nx: number, ny: number) => {
    parallaxRef.current = { x: nx, y: ny }
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        const el = containerRef.current
        if (!el) return
        const { x, y } = parallaxRef.current
        // Apply to layers at different intensities
        const layers = el.querySelectorAll<HTMLElement>('[data-depth]')
        layers.forEach(layer => {
          const depth = parseFloat(layer.dataset.depth || '0')
          const tx = x * depth * 20
          const ty = y * depth * 12
          layer.style.transform = `translate(${tx}px, ${ty}px)`
        })
        rafRef.current = 0
      })
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 3500)

    // Mouse parallax (desktop)
    const onMouse = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      handleParallax(nx, ny)
    }

    // Gyroscope parallax (mobile)
    const onOrientation = (e: DeviceOrientationEvent) => {
      const nx = Math.max(-1, Math.min(1, (e.gamma || 0) / 30))
      const ny = Math.max(-1, Math.min(1, (e.beta || 0 - 45) / 30))
      handleParallax(nx, ny)
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('deviceorientation', onOrientation, { passive: true })

    return () => {
      clearTimeout(t)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('deviceorientation', onOrientation)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleParallax])

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
    <div ref={containerRef} className={`login-scene ${skyClass}`} style={styles.container}>
      {/* Vignette overlay */}
      <div style={styles.vignette} />

      {/* Stars (night only) */}
      {night && <div className="stars-layer" />}

      {/* Sun / moon glow */}
      <div className={night ? 'celestial-moon' : 'celestial-sun'} />

      {/* Light rays */}
      {!night && <div className="light-rays" />}

      {/* Depth layer 1: far clouds */}
      <div data-depth="-0.3">
        <div className="cloud cloud-back-1" />
        <div className="cloud cloud-back-2" />
        <div className="cloud cloud-back-3" />
      </div>

      {/* Horizon glow */}
      <div className="horizon-glow" />

      {/* Depth layer 2: island + reflection */}
      <div className="login-island" style={styles.heroWrap} data-depth="0.5">
        <img src="/assets/map.png" alt="" style={styles.heroImg} />
        {/* Water reflection */}
        <div style={styles.reflection}>
          <img src="/assets/map.png" alt="" style={styles.reflectionImg} />
        </div>
      </div>

      {/* Depth layer 3: front clouds */}
      <div data-depth="0.8">
        <div className="cloud cloud-front-1" />
        <div className="cloud cloud-front-2" />
      </div>

      {/* Depth layer 4: particles */}
      <div className="login-motes" data-depth="0.2">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className={`mote mote-${i + 1}`} />
        ))}
      </div>

      {/* UI layer */}
      <div className="login-ui" style={styles.uiWrap}>
        <h1 className="login-title title-shimmer" style={styles.title}>AIsleland</h1>
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
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.15) 100%)',
    pointerEvents: 'none',
    zIndex: 8,
  },
  heroWrap: {
    position: 'absolute',
    top: '8%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(80vw, 360px)',
    height: 'min(80vw, 360px)',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))',
    zIndex: 3,
  },
  heroImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  reflection: {
    position: 'absolute',
    top: '85%',
    left: '5%',
    width: '90%',
    height: '50%',
    overflow: 'hidden',
    opacity: 0.25,
    filter: 'blur(6px)',
    maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
    WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
    pointerEvents: 'none',
  },
  reflectionImg: {
    width: '100%',
    transform: 'scaleY(-1)',
    objectFit: 'contain',
    animation: 'reflectionRipple 4s ease-in-out infinite',
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
    fontSize: 'clamp(44px, 12vw, 64px)',
    fontWeight: 700,
    color: '#3D3229',
    margin: '0 0 6px',
    fontFamily: TITLE_FONT,
    letterSpacing: '2px',
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(61,50,41,0.65)',
    fontWeight: 600,
    margin: '0 0 32px',
    letterSpacing: '0.5px',
    textShadow: '0 1px 10px rgba(255,255,255,0.5)',
  },
  button: {
    width: '100%',
    maxWidth: 320,
    padding: '16px 24px',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg, #5BAD8A, #4A9E7A)',
    border: 'none',
    borderRadius: 50,
    cursor: 'pointer',
    fontFamily: FONT,
    boxShadow: '0 4px 24px rgba(91,173,138,0.35), inset 0 1px 2px rgba(255,255,255,0.25)',
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
    color: 'rgba(61,50,41,0.35)',
    marginTop: 16,
    letterSpacing: '0.2px',
  },
}
