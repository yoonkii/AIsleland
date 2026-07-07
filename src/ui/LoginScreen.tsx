import { useEffect, useRef } from 'react'

interface Props {
  onGoogle: () => void
  onDemo: () => void
  busy: boolean
  error: string | null
}

export function LoginScreen({ onGoogle, onDemo, busy, error }: Props) {
  const heroRef = useRef<HTMLDivElement>(null)

  // gentle mouse parallax on the island illustration
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    let raf = 0
    let tx = 0, ty = 0, cx = 0, cy = 0
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 14
      ty = (e.clientY / window.innerHeight - 0.5) * 8
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const tick = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      el.style.transform = `translate(${cx}px, ${cy}px)`
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(tick) : 0
    }
    window.addEventListener('pointermove', onMove)
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div className="login">
      <div className="login-sky">
        <div className="login-stars" />
        <div className="login-cloud c1" /><div className="login-cloud c2" /><div className="login-cloud c3" />
      </div>

      <div className="login-hero" ref={heroRef}>
        <IslandArt />
      </div>

      <div className="login-panel">
        <h1 className="login-title">AIsleland</h1>
        <p className="login-tagline">Your work grows an island.</p>
        <p className="login-copy">
          Every real task you finish — a Gmail reply, a Docs edit, a meeting kept —
          plants something on a tiny floating world. Watch it bloom while you work.
        </p>
        <div className="login-actions">
          <button className="btn-primary btn-lg" onClick={onDemo}>
            Try the demo island
          </button>
          <button className="btn-google" onClick={onGoogle} disabled={busy}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="#4285F4"/>
              <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853"/>
              <path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9l3.3-2.5z" fill="#FBBC05"/>
              <path d="M12 6c1.5 0 2.8.5 3.8 1.5L18.7 5A10 10 0 0 0 3 7.5L6.4 10c.8-2.3 3-4 5.6-4z" fill="#EA4335"/>
            </svg>
            {busy ? 'Connecting…' : 'Connect Google Workspace'}
          </button>
        </div>
        {error && <p className="login-error">{error}</p>}
        <div className="login-features">
          <span>🌸 Quests from real work</span>
          <span>🌙 Live day &amp; night</span>
          <span>📮 Postcard photo mode</span>
        </div>
      </div>
    </div>
  )
}

/** Inline-SVG floating island — no image assets. */
function IslandArt() {
  return (
    <svg className="island-art" viewBox="0 0 420 360" role="img" aria-label="A floating island">
      <defs>
        <linearGradient id="cliffG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3B08A" /><stop offset=".6" stopColor="#C98A5E" /><stop offset="1" stopColor="#7A4E33" />
        </linearGradient>
        <linearGradient id="grassG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C8EBB8" /><stop offset="1" stopColor="#A8D8A0" />
        </linearGradient>
        <linearGradient id="fallG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFF0F5" /><stop offset="1" stopColor="#CFF0F5" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="art-bob">
        {/* underside */}
        <path d="M110 205 C 130 290, 290 290, 310 205 L 250 232 L 210 300 L 170 232 Z" fill="url(#cliffG)" />
        {/* cliff ring */}
        <path d="M95 185 C 95 215, 325 215, 325 185 L 325 175 L 95 175 Z" fill="url(#cliffG)" />
        {/* grass top */}
        <ellipse cx="210" cy="175" rx="118" ry="34" fill="url(#grassG)" />
        <ellipse cx="210" cy="171" rx="110" ry="28" fill="#C8EBB8" opacity=".5" />
        {/* waterfall */}
        <rect className="art-fall" x="286" y="180" width="16" height="86" rx="8" fill="url(#fallG)" />
        {/* tree */}
        <g className="art-sway">
          <rect x="160" y="120" width="9" height="34" rx="4" fill="#8A6248" />
          <circle cx="165" cy="104" r="26" fill="#7FC97F" />
          <circle cx="147" cy="116" r="18" fill="#B7E4A8" />
          <circle cx="182" cy="114" r="17" fill="#5FAF6F" />
        </g>
        {/* house */}
        <g>
          <rect x="220" y="128" width="46" height="34" rx="4" fill="#FFF4E0" />
          <path d="M214 132 L 243 106 L 272 132 Z" fill="#E07A6E" />
          <rect x="236" y="142" width="13" height="20" rx="2" fill="#8A6248" />
          <circle className="art-window" cx="228" cy="140" r="4" fill="#FFD98A" />
        </g>
        {/* flowers */}
        <g fill="#F7C8D8">
          <circle cx="130" cy="168" r="5" /><circle cx="196" cy="180" r="4" /><circle cx="292" cy="164" r="5" />
        </g>
        <g fill="#FFD3B6">
          <circle cx="152" cy="180" r="4" /><circle cx="262" cy="176" r="4" />
        </g>
      </g>
      {/* floating rocks */}
      <g fill="#C98A5E">
        <ellipse className="art-rock r1" cx="90" cy="280" rx="14" ry="10" />
        <ellipse className="art-rock r2" cx="330" cy="300" rx="10" ry="7" />
        <ellipse className="art-rock r3" cx="240" cy="330" rx="7" ry="5" />
      </g>
    </svg>
  )
}
