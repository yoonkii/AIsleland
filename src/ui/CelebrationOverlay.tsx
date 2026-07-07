import { useEffect, useRef, useState } from 'react'
import { SOURCE_COLORS } from '../design/tokens'
import { useGameStore } from '../state/gameStore'

/** DOM layer of celebrations: XP toast for quests, full banner for level-ups. */
export function CelebrationOverlay() {
  const celebration = useGameStore((s) => s.celebration)
  const [xpShown, setXpShown] = useState(0)
  const raf = useRef(0)

  // count-up for the XP number
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (celebration?.kind !== 'quest') return
    const target = celebration.quest.xpReward
    const start = performance.now()
    const tick = () => {
      const t = Math.min(1, (performance.now() - start - 1100) / 800)
      setXpShown(t <= 0 ? 0 : Math.round(t * target))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [celebration])

  if (!celebration) return null

  if (celebration.kind === 'quest') {
    const q = celebration.quest
    return (
      <div className="cel-toast">
        <span className="cel-check" style={{ background: SOURCE_COLORS[q.source] }}>
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="m5 13 4 4L19 7" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
        <div className="cel-toast-text">
          <span className="cel-toast-title">{q.title}</span>
          <span className="cel-toast-xp">+{xpShown} xp</span>
        </div>
      </div>
    )
  }

  const label = `LEVEL ${celebration.newLevel}`
  return (
    <div className="cel-levelup">
      <div className="cel-flash" />
      <div className="cel-level-banner">
        {label.split('').map((ch, i) => (
          <span key={i} className="cel-letter" style={{ animationDelay: `${900 + i * 40}ms` }}>
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </div>
      {celebration.unlocked.length > 0 && (
        <div className="cel-unlocks">
          <span>New on your island:</span>
          <div className="cel-unlock-chips">
            {celebration.unlocked.slice(0, 5).map((u) => (
              <span key={u} className="cel-unlock-chip">{prettyName(u)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function prettyName(type: string): string {
  return type.replace(/-\d+$/, '').replace(/-/g, ' ')
}
