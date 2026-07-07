import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore'

function sfx(name: string) {
  window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name } }))
}

const FILTERS = ['none', 'peach', 'mint', 'dusk', 'mono'] as const
type Filter = (typeof FILTERS)[number]

export function PhotoModeBar() {
  const photoMode = useGameStore((s) => s.photoMode)
  const timeOverride = useGameStore((s) => s.timeOverride)
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const setTimeOverride = useGameStore((s) => s.setTimeOverride)
  const setPhotoMode = useGameStore((s) => s.setPhotoMode)
  const [filter, setFilter] = useState<Filter>('none')

  // film filter is a CSS filter on the canvas container
  useEffect(() => {
    const rootEl = document.querySelector('.game-root')
    if (rootEl) {
      if (photoMode && filter !== 'none') rootEl.setAttribute('data-filter', filter)
      else rootEl.removeAttribute('data-filter')
    }
  }, [filter, photoMode])

  if (!photoMode) return null

  const t = timeOverride ?? timeOfDay

  return (
    <div className="photo-bar ui-card">
      <div className="photo-time">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><circle cx="12" cy="12" r="5" fill="#FFD98A"/><g stroke="#FFD98A" strokeWidth="2" strokeLinecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></g></svg>
        <input
          type="range" min={0} max={1} step={0.002} value={t}
          onChange={(e) => setTimeOverride(parseFloat(e.target.value))}
          aria-label="Time of day"
        />
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="#B8C7F0"/></svg>
      </div>
      <div className="photo-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => { setFilter(f); sfx('ui_tap') }}
          >
            {f === 'none' ? 'Natural' : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="photo-actions">
        <button
          className="btn-primary"
          onClick={() => window.dispatchEvent(new CustomEvent('aisleland-snapshot'))}
        >
          Save postcard
        </button>
        <button
          className="btn-ghost"
          onClick={() => { setPhotoMode(false); setTimeOverride(null); setFilter('none'); sfx('ui_tap') }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
