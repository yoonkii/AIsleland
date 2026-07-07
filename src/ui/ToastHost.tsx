import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore'

interface Toast {
  id: string
  text: string
}

/** Small non-celebration notifications (a new quest flew in). */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // Seed with the current quests so the initial list doesn't toast.
    const seen = new Set(useGameStore.getState().quests.map((q) => q.id))
    return useGameStore.subscribe((s, prev) => {
      if (s.quests === prev.quests) return
      for (const q of s.quests) {
        if (seen.has(q.id)) continue
        seen.add(q.id)
        const toast = { id: q.id, text: `New quest: ${q.title}` }
        setToasts((t) => [...t.slice(-2), toast])
        window.dispatchEvent(new CustomEvent('aisleland-sfx', { detail: { name: 'owl_delivery' } }))
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 4500)
      }
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className="toast ui-card">
          <span className="toast-owl">📮</span>
          {t.text}
        </div>
      ))}
    </div>
  )
}
