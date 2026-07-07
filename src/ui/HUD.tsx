import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../state/gameStore'

function sfx(name: string) {
  window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name } }))
}

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R

export function HUD({ onSignOut }: { onSignOut: () => void }) {
  const island = useGameStore((s) => s.island)
  const player = useGameStore((s) => s.player)
  const quests = useGameStore((s) => s.quests)
  const muted = useGameStore((s) => s.muted)
  const photoMode = useGameStore((s) => s.photoMode)
  const journalOpen = useGameStore((s) => s.journalOpen)
  const toggleMuted = useGameStore((s) => s.toggleMuted)
  const setPhotoMode = useGameStore((s) => s.setPhotoMode)
  const setJournalOpen = useGameStore((s) => s.setJournalOpen)
  const setTimeOverride = useGameStore((s) => s.setTimeOverride)

  // animate xp ring
  const frac = Math.min(1, island.xp / Math.max(1, island.xpToNextLevel))
  const [shownFrac, setShownFrac] = useState(frac)
  const shownRef = useRef(frac)
  useEffect(() => {
    let raf = 0
    const animate = () => {
      const next = shownRef.current + (frac - shownRef.current) * 0.08
      shownRef.current = next
      setShownFrac(next)
      if (Math.abs(next - frac) > 0.002) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [frac])

  if (photoMode) return null

  const name = player?.displayName?.split(' ')[0] ?? 'Islander'

  return (
    <>
      <div className="hud-topleft">
        <div className="hud-level-card ui-card">
          <div className="hud-ring">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={RING_R} fill="none" stroke="var(--card-border)" strokeWidth="5" />
              <circle
                cx="32" cy="32" r={RING_R} fill="none"
                stroke="var(--accent-green)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - shownFrac)}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <span className="hud-level-num">{island.level}</span>
          </div>
          <div className="hud-level-text">
            <span className="hud-island-name">{name}&apos;s Isle</span>
            <span className="hud-xp">{island.xp} / {island.xpToNextLevel} xp</span>
          </div>
          {island.streakCount > 0 && (
            <div className="hud-streak" title={`${island.streakCount} quest streak`}>
              <svg width="14" height="17" viewBox="0 0 14 17">
                <path d="M7 0C8 4 12 5.5 12 10a5 5 0 0 1-10 0C2 7 4.5 5.5 5 3c.8 1.2 1.6 2 2 3.5C8.2 5 7.5 2.5 7 0Z" fill="url(#flameG)" />
                <defs>
                  <linearGradient id="flameG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FFB347" /><stop offset="1" stopColor="#FFE29A" />
                  </linearGradient>
                </defs>
              </svg>
              <span>{island.streakCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="hud-topright">
        <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => { toggleMuted(); sfx('ui_tap') }}>
          {muted ? (
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 9v6h4l5 5V4L7 9H3zm14.5 3 3-3-1.4-1.4-3 3-3-3L11.7 9l3 3-3 3 1.4 1.4 3-3 3 3 1.4-1.4-3-3z" fill="currentColor"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>
          )}
        </button>
        <button className="icon-btn" aria-label="Photo mode"
          onClick={() => { setPhotoMode(true); sfx('ui_tap') }}>
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9zm3 5.5A4.5 4.5 0 1 1 7.5 13 4.5 4.5 0 0 1 12 8.5zm0 2A2.5 2.5 0 1 0 14.5 13 2.5 2.5 0 0 0 12 10.5z" fill="currentColor"/></svg>
        </button>
        <button className="icon-btn" aria-label="Sign out"
          onClick={() => { sfx('ui_tap'); onSignOut() }}>
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3zm4.6 4L13.2 8.4 16 11H8v2h8l-2.8 2.6L14.6 17l5.4-5-5.4-5z" fill="currentColor"/></svg>
        </button>
      </div>

      <button
        className={`journal-fab ${journalOpen ? 'open' : ''}`}
        onClick={() => { setJournalOpen(!journalOpen); setTimeOverride(null); sfx('ui_tap') }}
        aria-label="Quest journal"
      >
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H6zm1 2h10v14H7V4zm2 3v2h6V7H9zm0 4v2h6v-2H9z" fill="currentColor"/></svg>
        <span className="journal-fab-label">Quests</span>
        {quests.length > 0 && <span className="journal-badge">{quests.length}</span>}
      </button>
    </>
  )
}
